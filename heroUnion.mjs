/**
 * Hero管理、调度
 * --使用流程--
 * 1. 本地启动machete_hero爬虫，它会主动连接本联盟，并加入到爬虫队列等待处理任务（爬虫会定时上报自己的状态给联盟）；
 * 2. 联盟收到新任务时，存入待处理队列，等待在线的爬虫来获取；
 * 3. 爬虫获取到新任务处理完成后，将结果回传给联盟；
 * 4. 联盟收到爬虫处理结果触发回调通知并将数据结果发送给任务提交者；
 * 5. 任务提交者可自行根据任务编号来联盟查询任务结果；
 * 
 * --并发处理规则--
 * 同一个任务可以被分配给多个爬虫
 * 同一个任务可以接收不同爬虫回传的数据，并完成回调
 * 
 * --数据缓存规则--
 * 任务结果数据最大不超过1M，超过的当任务处理失败处理
 * 任务数据保存最长 1 天
 *
 * --异常处理规则--
 * 任务处理超时后将进行中的任务状态改为等待中，以便其它爬虫处理
 * 任务处理超过最多尝试次数，则标记为失败
 */

import fs from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import cron from 'node-cron';
import axios from 'axios';
import common from './common.mjs';
import md5 from 'md5';

class HeroUnion {

    //构造函数，设置默认配置
    constructor(configFilename) {
        this.config = null;
        this.configFile = typeof(configFilename) != 'undefined' && configFilename ? configFilename : 'config.json';

        //默认配置
        this.systemLogDir = 'log/';                            //系统日志保存目录
        this.task_cache_time = 86400;                          //任务数据最长缓存时间，单位：秒
        this.task_data_max_size = 1024;                        //任务数据最大字节数，单位：KB，默认最大1M
        this.task_timeout = 600;                               //任务处理超时时长，单位：秒
        this.task_max_try = 5;                                 //任务处理最多尝试次数
        this.notify_timeout = 8;                               //回调通知请求超时时长，单位：秒
        this.notify_max_try = 5;                               //回调通知最多尝试次数
        this.heroHeartTimeout = 600;                           //爬虫心跳超时时长，单位：秒
        this.max_list_hero_num = 1000;                         //在接口getHeros()里最多返回的爬虫数量
        this.axios_proxy = false;                              //axios库发送请求时是否使用系统代理

        this.stats = {
            start_time: common.getTimestampInSeconds()
        };

        this.heros = [];    //hero爬虫队列
        this.tasks = [];    //任务队列

        //任务相关数据
        this.taskStatus = {
            'total':    0,
            'waiting':  0,
            'running':  0,
            'done':     0,
            'failed':   0
        };

        //任务通知回调相关数据
        this.taskNotifyStatus = {
            'total':    0,
            'done':     0,
            'failed':   0
        };

        this.statusCode = {
            'waiting':  '待处理',
            'running':  '处理中',
            'done':     '完成',
            'failed':   '失败'
        };

        this.supportedPlatforms = {
            'douyin': true,
            'kuaishou': true,
            'xigua': true,
            'bilibili': true
        };

        //爬虫相关数据
        this.heroStatus = {
            'total':        0,
            'idle':         0,    //空闲
            'busy':         0,    //繁忙
            'offline':      0     //离线
        };
    }

    isDataTooLarge(data) {
        return common.byteSize(JSON.stringify(data)) > this.task_data_max_size * 1024;
    }

    async getConfig(forceReload) {
        const _self = this;

        if ( !this.config || (typeof(forceReload) != 'undefined' && forceReload) ) {
            common.log("Load config from %s", this.configFile);
            let config = await common.getConfigFromJsonFile(this.configFile);

            //覆盖默认配置
            for (const key in config) {
                if (typeof(_self[key]) != 'undefined') {
                    _self[key] = config[key];
                }
            }

            this.config = config;
        }

        return this.config;
    }

    //--任务相关功能--

    //根据任务提交者ID和时间戳生成任务ID编号
    generateTaskId(uuid) {
        let timestamp = common.getTimestamp();
        return `${uuid}_${timestamp}`;
    }

    //根据当前时间生成任务的密钥
    generateTaskToken(id) {
        let timestamp = common.getTimestamp();
        return md5(`${id}_${timestamp}`);
    }

    isSupportedPlatform(platform) {
        return typeof(this.supportedPlatforms[platform]) != 'undefined' && this.supportedPlatforms[platform];
    }

    //提交新任务
    /**
     * {
     *  id: '',
     *  status: '',
     *  uuid: '',
     *  country: '',
     *  lang: '',
     *  url: '',
     *  platform: '',        //目标网址所属平台，具体参考爬虫所支持的平台
     *  contract: '',        //需要抓取的数据合约，凡是支持此合约的爬虫将根据合约内容抓取数据
     *  data_mode: '',       //json, html
     *  notify_url: '',
     *  results: [],
     *  created: 0,    //timestamp in seconds
     *  updated: 0,    //timestamp in seconds
     *  error: '',
     *  notified: false,      //是否成功发送回调通知
     *  notify_time: 0,       //回调通知次数
     *  try_time: 0,          //任务处理次数
     *  token: ''             //任务密钥，爬虫完成任务回传数据的时候用它签名
     * }
     **/
    async createTask(uuid, url, platform, contract, data_mode, notify_url, country, lang) {
        let timestamp = common.getTimestampInSeconds();

        let task = {
            id: this.generateTaskId(uuid),
            status: 'waiting',

            notified: false,
            notify_time: 0,
            try_time: 0,

            //必选
            uuid: uuid,
            url: url,
            platform: platform,
            contract: contract,

            //可选
            data_mode: 'json',
            country: 'cn',
            lang: 'zh',
            notify_url: '',
            results: [],

            created: timestamp,
            updated: timestamp
        };

        if (typeof(data_mode) != 'undefined' && data_mode) {
            task.data_mode = data_mode;
        }
        if (typeof(notify_url) != 'undefined' && notify_url) {
            task.notify_url = notify_url;
        }
        if (typeof(country) != 'undefined' && country) {
            task.country = country;
        }
        if (typeof(lang) != 'undefined' && lang) {
            task.lang = lang;
        }

        this.tasks.push(task);
        this.taskStatus.total ++;
        this.taskStatus.waiting ++;

        //保存任务日志
        let config = await this.getConfig();
        let logFile = path.resolve(config.systemLogDir) + '/tasks.log';
        common.saveLog(logFile, JSON.stringify(task) + "\n");

        common.log('Task %s created, url %s, notify url %s.', task.id, url, notify_url);

        return task;
    }

    //参数均可选，获取 1 个待处理的任务
    getWaitingTask(platforms, contracts, country, lang, data_mode) {
        let searchResult = null;

        let taskIndex = this.tasks.findIndex(function(item) {
            if (item.status != 'waiting') {return false;}

            if (typeof(platforms) != 'undefined' && platforms && platforms.indexOf(item.platform) == -1) {
                return false;
            }

            if (typeof(contracts) != 'undefined' && contracts && contracts.indexOf(item.contract) == -1) {
                return false;
            }

            if (typeof(country) != 'undefined' && country && item.country != country) {
                return false;
            }

            if (typeof(lang) != 'undefined' && lang && item.lang != lang) {
                return false;
            }

            if (typeof(data_mode) != 'undefined' && data_mode && item.data_mode != data_mode) {
                return false;
            }

            return true;
        });

        if (taskIndex > -1) {
            this.tasks[taskIndex].status = 'running';
            //为task生成一个随机密钥，便于爬虫处理完成后回传的时候对数据进行签名
            this.tasks[taskIndex].token = this.generateTaskToken(this.tasks[taskIndex].id);
            //任务处理次数计数
            this.tasks[taskIndex].try_time ++;
            //更新任务修改时间
            this.tasks[taskIndex].updated = common.getTimestampInSeconds();

            //更新统计数据
            this.taskStatus.waiting --;
            this.taskStatus.running ++;

            searchResult = this.tasks[taskIndex];
        }

        return searchResult;
    }

    //保存处理中任务结果
    //增加失败状态设置
    saveTaskById(bot_name, id, data, status) {
        let done = false;

        let taskIndex = this.tasks.findIndex((item) => item.id == id && item.status == 'running');
        if (taskIndex > -1) {
            if (this.isDataTooLarge(data)) {
                //更新统计数据
                this.taskStatus.running --;
                this.taskStatus.failed ++;

                this.tasks[taskIndex].status = 'failed';
                this.tasks[taskIndex].error = 'Result is too large to save.';

                common.error('Task %s save data failed by bot %s, data is too large.', id, bot_name);
                return false;
            }

            data.provider = bot_name;        //记录数据提供者
            this.tasks[taskIndex].results = data;
            this.tasks[taskIndex].updated = common.getTimestampInSeconds();
            
            //更新统计数据
            this.taskStatus.running --;
            if (typeof(status) == 'undefined' || status == 'done') {
                this.taskStatus.done ++;
                this.tasks[taskIndex].status = 'done';
            }else if (typeof(status) != 'undefined' && status == 'failed') {
                this.taskStatus.failed ++;
                this.tasks[taskIndex].status = 'failed';
                this.tasks[taskIndex].error = typeof(data.error) != 'undefined' && data.error ?
                                                data.error : 'HeroBot says it failed.';
                common.error('Task %s is failed, save by bot %s', id, bot_name);
            }

            common.log('Task %s save data done by bot %s.', id, bot_name);
            done = true;
        }

        return done;
    }

    //查询某个任务的状态及其数据
    getTaskById(id) {
        return this.tasks.find((item) => item.id == id);
    }

    //根据uuid获取用户的签名密钥
    async getUserToken(uuid) {
        let config = await this.getConfig();
        return config && typeof(config.tokens[uuid]) != 'undefined' ? config.tokens[uuid] : '';
    }

    //任务完成触发回调通知
    async handleTaskDone(task) {
        let notified = false;
        let notify_url = task.notify_url;

        try {
            common.log('[%s] Try to notify task %s via %s', task.notify_time, task.id, notify_url);

            let params = {
                "task_id": task.id,
                "task_result": task.results,
                "timestamp": common.getTimestamp(),
            };
            let token = await this.getUserToken(task.uuid);
            params.sign = common.sign(params, token);

            const response = await axios.post(notify_url, params, {
                timeout: this.notify_timeout*1000,
                proxy: this.axios_proxy
            });
            if (response.status == 200) {
                notified = true;
                common.log('Task %s done by %s, notify to %s done, response data:', task.id, task.results.provider, notify_url, response.data);
            }else {
                common.error('[FAILED] Notify to %s failed, response status: %s, status text: %s, result: %s',
                        notify_url, response.status, response.statusText, response.data);
            }
        }catch(err) {
            common.error('[ERROR] Notify to %s failed: %s', notify_url, err);
        }

        //更新任务notified状态以及notify_time通知次数
        let taskIndex = this.tasks.findIndex((item) => item.id == task.id);
        if (taskIndex > -1) {
            this.tasks[taskIndex].notified = notified;
            this.tasks[taskIndex].notify_time ++;

            //更新任务通知状态数据
            if (notified) {
                this.taskNotifyStatus.done ++;
                this.taskNotifyStatus.total = this.taskNotifyStatus.done + this.taskNotifyStatus.failed;
            }else if (!notified && this.tasks[taskIndex].notify_time == this.notify_max_try) {
                this.taskNotifyStatus.failed ++;
                this.taskNotifyStatus.total = this.taskNotifyStatus.done + this.taskNotifyStatus.failed;
                common.error('[FAILED] Finally failed after %s try, notify to %s', this.notify_max_try, notify_url);
            }
        }

        return notified;
    }


    //--爬虫相关功能--

    //接收爬虫状态上报
    /**
     * bot爬虫属性
     * name
     * description
     * status: [idle, busy]
     * platforms: [],    //支持的平台，可由爬虫定义
     * contracts: [],    //支持的数据抓取合约，具体内容由爬虫定义
     * timestamp
     * country
     * lang
     * contact
     */
    heroOnboard(bot) {
        let cachedBotIndex = this.heros.findIndex((item) => item.name == bot.name),
            cachedBot = cachedBotIndex > -1 ? this.heros[cachedBotIndex] : null;

        if (cachedBot) {    //如果是已经存在的爬虫
            if (cachedBot.status != bot.status) {
                common.log('Hero %s status change from %s to %s', cachedBot.name, cachedBot.status, bot.status);
                this.heroStatus[cachedBot.status] --;
                this.heroStatus[bot.status] ++;
            }

            this.heros[cachedBotIndex] = bot;             //数据更新

            common.log('Hero %s is %s at %s', bot.name, bot.status, bot.timestamp);
        }else {
            this.heros.push(bot);        //添加新爬虫

            this.heroStatus.total ++;
            if (bot.status == 'idle') {
                this.heroStatus.idle ++;
            }else {
                this.heroStatus.busy ++;
            }

            common.log('Hero %s is onboard at %s', bot.name, bot.timestamp);
        }
    }

    //定期检查爬虫是否在线
    //如果上一次上报状态时间在10分钟前，则设置该爬虫已下线
    heroHeartCheck() {
        const _self = this;

        const frequence = typeof(this.config.heroHeartCheckFrequence) != 'undefined'
                            && this.config.heroHeartCheckFrequence ? this.config.heroHeartCheckFrequence : 1;    //1 分钟检查一次
        const cronjob = cron.schedule(`*/${frequence} * * * *`, () =>  {
            let timestamp = common.getTimestampInSeconds();
            _self.heros.forEach(function(item, index) {
                if (item.status != 'offline' && timestamp - item.timestamp > _self.heroHeartTimeout) {
                    _self.heroStatus[item.status] --;

                    _self.heros[index].status = 'offline';
                    _self.heroStatus.offline ++;
                    common.log('Hero %s is offline, last heart beat at %s', item.name, item.timestamp);
                }
            });
        }, {
            scheduled: false
        });

        cronjob.start();
        common.log('Cronjob of hero heart check started.');
    }

    //自动重新加载配置文件
    autoReloadConfigs() {
        const _self = this;

        const frequence = typeof(this.config.reloadConfigFrequence) != 'undefined'
                            && this.config.reloadConfigFrequence ? this.config.reloadConfigFrequence : 5;    //5 分钟重新加载一次
        const cronjob = cron.schedule(`*/${frequence} * * * *`, () =>  {
            const forceReload = true;
            _self.getConfig(forceReload);
        }, {
            scheduled: false
        });

        cronjob.start();
        common.log('Cronjob of config auto reload started.');
    }

    //定期清理过期的任务
    autoCleanExpiredTasks() {
        const _self = this;

        const frequence = typeof(this.config.autoCleanTaskFrequence) != 'undefined'
                            && this.config.autoCleanTaskFrequence ? this.config.autoCleanTaskFrequence : 10;    //10 分钟检查一次
        const cronjob = cron.schedule(`*/${frequence} * * * *`, () =>  {
            let timestamp = common.getTimestampInSeconds();

            let tasksLeft = _self.tasks.reduce(function(accumulator, item) {
                if (
                    (item.status == 'done' || item.status == 'failed')
                    && timestamp - item.created > _self.task_cache_time
                ) {
                    if (_self.taskStatus[item.status] >= 1) {
                        _self.taskStatus[item.status] --;

                        if (_self.taskStatus.total >= 1) {
                            _self.taskStatus.total --;
                        }
                    }

                    let notify_status = item.notified ? 'done' : 'failed';
                    if (_self.taskNotifyStatus[notify_status] >= 1) {
                        _self.taskNotifyStatus[notify_status] --;

                        _self.taskNotifyStatus.total = _self.taskNotifyStatus.done + _self.taskNotifyStatus.failed;
                    }

                    common.log('Task %s is expired, which is created at %s', item.id, item.created);
                }else {
                    accumulator.push(item);
                }

                return accumulator;
            }, []);

            if (tasksLeft) {
                _self.tasks = tasksLeft;
            }
        }, {
            scheduled: false
        });

        cronjob.start();
        common.log('Cronjob of auto clean expired tasks started.');
    }

    //定期重置处理过期的任务
    autoResetRunningTimeoutTasks() {
        const _self = this;

        const frequence = typeof(this.config.autoResetWaitingTaskFrequence) != 'undefined'
                            && this.config.autoResetWaitingTaskFrequence ? this.config.autoResetWaitingTaskFrequence : 6;    //6 分钟检查一次
        const cronjob = cron.schedule(`*/${frequence} * * * *`, () =>  {
            let timestamp = common.getTimestampInSeconds();

            _self.tasks.forEach(function(item, index) {
                if (
                    item.status == 'running'
                    && item.try_time < _self.task_max_try
                    && timestamp - item.updated > _self.task_timeout
                ) {
                    _self.taskStatus.running --;
                    _self.taskStatus.waiting ++;
                    _self.tasks[index].status = 'waiting';
                    common.log('Task %s running timeout, and reset it to waiting list, url: %s', item.id, item.url);
                }else if (item.status == 'running' && item.try_time >= _self.task_max_try) {
                    //设置任务失败
                    _self.taskStatus.running --;
                    _self.taskStatus.failed ++;
                    _self.tasks[index].status = 'failed';
                    _self.tasks[index].error = 'Task max try time got.';
                    common.error('Task %s failed, got the max try time, url: %s.', item.id, item.url);
                }
            });
        }, {
            scheduled: false
        });

        cronjob.start();
        common.log('Cronjob of auto reset expired running tasks started.');
    }

    //定期尝试给已完成状态的任务notify_url发送通知回调
    //bug fix：忽略没有notify_url的任务
    autoNotifyTasks() {
        const _self = this;

        const frequence = typeof(this.config.autoNotifyTaskFrequence) != 'undefined'
                            && this.config.autoNotifyTaskFrequence ? this.config.autoNotifyTaskFrequence : 2;    //2 分钟检查一次
        const cronjob = cron.schedule(`*/${frequence} * * * *`, () =>  {
            let task = _self.tasks.find((item)  =>  common.isUrlOk(item.notify_url) &&
                                                    item.status == 'done' &&
                                                    item.notified == false &&
                                                    item.notify_time < _self.notify_max_try
                                        );
            if (task) {
                _self.handleTaskDone(task);
            }
        }, {
            scheduled: false
        });

        cronjob.start();
        common.log('Cronjob of auto notify done tasks started.');
    }

    //获取联盟状态
    getStats() {
        this.stats.taskStatus = this.taskStatus;
        this.stats.taskNotifyStatus = this.taskNotifyStatus;
        this.stats.heroStatus = this.heroStatus;
        this.stats.run_seconds = common.getTimestampInSeconds() - this.stats.start_time;
        this.stats.cache_time = this.task_cache_time;

        return this.stats;
    }

    //获取爬虫列表
    getHeros(page, limit) {
        if (typeof(page) == 'undefined') {
            page = 1;
        }

        if (typeof(limit) == 'undefined') {
            limit = 20;
        }

        if (page < 1) {
            page = 1;
        }
        if (limit > 100) {
            limit = 100;
        }

        let start = (page - 1)*limit,
            end = start + limit;

        if (start >= this.heros.length) {
            return [];
        }

        if (end > this.heros.length) {
            end = this.heros.length;
        }else if (end > this.max_list_hero_num) {
            end = this.max_list_hero_num;
        }

        //根据心跳时间从新到旧排序
        this.heros.sort(function(itemA, itemB) {
            if (itemA.timestamp > itemB.timestamp) {
                return -1;
            }else if (itemA.timestamp < itemB.timestamp){
                return 1;
            }

            return 0;
        });

        return this.heros.slice(start, end);
    }

    getHeroByName(bot_name) {
        return this.heros.find((item) => item.name == bot_name);
    }

    //初始化
    async init() {
        await this.getConfig();
        this.autoReloadConfigs();
        this.heroHeartCheck();
        this.autoCleanExpiredTasks();
        this.autoNotifyTasks();
        this.autoResetRunningTimeoutTasks();
    }

}


export default HeroUnion;
