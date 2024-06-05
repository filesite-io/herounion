/**
 * Express router of api/
 */

import express from 'express';
import common from './common.mjs';
import HeroUnion from './heroUnion.mjs';

//初始化爬虫联盟
let configFile = 'config.json';

//命令行参数支持，格式：npm start -- my_config.json
if (process.argv.length >= 3) {
    configFile = process.argv[2];
}

//环境变量支持，格式：CONFIGFILE=my_config.json pm2 start server.mjs
if (typeof(process.env.CONFIGFILE) != 'undefined') {
    configFile = process.env.CONFIGFILE;
}
const heroUnion = new HeroUnion(configFile);
heroUnion.init();


const router = express.Router();

//获取联盟公开接口列表
router.get('/', async (req, res) => {
    const apiList = {
        "/api/": "查看所有API",

        "/api/stats/": "查看联盟状态",
        "/api/heros/": "获取联盟中的爬虫数据",

        "/api/newtask/": "向联盟提交新的爬虫任务",
        "/api/querytask/": "根据任务ID查询任务数据",

        "/api/onboard/": "爬虫状态上报到联盟",
        "/api/gettask/": "爬虫从联盟获取待处理任务",
        "/api/savetask/": "爬虫完成任务后保存结果到联盟",
    };

    const data = {
        name: heroUnion.config.name,
        version: heroUnion.config.version,
        apis: apiList
    };
    return res.status(200).json(data);
});

/**
 * 联盟成员向联盟提交数据抓取任务
 * 
 * 参数：
 * uuid: 用户ID
 * url: 目标网址
 * platform: 目标网址所属平台，可选值：[douyin, kuaishou, xigua, bilibili]
 * contract: 需要抓取的数据合约，凡是支持此合约的爬虫将根据合约内容抓取数据（具体参考爬虫所支持的合约）
 * data_mode: 返回数据格式，可选值：[json, html]
 * country: 国家代码
 * lang: 语言代码
 * notify_url: 通知回调网址
 * sign: 参数签名，签名方法见README.md“接口参数签名方法”
 **/
router.post('/newtask/', async (req, res) => {
    let uuid = req.body.uuid,
        url = req.body.url,
        platform = req.body.platform,
        contract = req.body.contract,
        data_mode = req.body.data_mode,
        country = req.body.country,
        lang = req.body.lang,
        notify_url = req.body.notify_url,
        sign = req.body.sign;
    
    let data = {code: 0, message: ''};

    //参数格式检查
    if (!uuid || !url || !platform || !contract || !sign) {
        data.message = '必选参数uuid、url、platform、contract、sign不能为空';
    }else if (common.isUuidOk(uuid) == false) {
        data.message = '参数uuid应为6-32位的英文字符串，请联系管理员获得';
    }else if (common.isUrlOk(url) == false) {
        data.message = '参数url必须是一个网址';
    }else if (common.isNormalName(platform, 5) == false) {
        data.message = '平台名platform应为5-32位的英文字符串';
    }else if (common.isNormalName(contract, 5) == false) {
        data.message = '合约contract应为5-32位的英文字符串';
    }else if (data_mode && data_mode != 'json' && data_mode != 'html') {
        data.message = '数据格式data_mode可选值：json, html';
    }else if (country && common.isIosCountryCode(country) == false) {
        data.message = '国家代码country请传小写的两位字母，参考两位ISO CODES：https://countrycode.org/';
    }else if (lang && common.isIosLangCode(lang) == false) {
        data.message = '语言代码lang请传小写的两位字母，参考ISO 639-1 Code：https://www.loc.gov/standards/iso639-2/php/code_list.php';
    }else if (notify_url && common.isUrlOk(notify_url) == false) {
        data.message = '参数notify_url必须是一个网址';
    }else if (common.isNormalName(sign, 32, 32) == false) {
        data.message = '签名sign应为32位的英文字符串';
    }

    //签名检查
    let userToken = await heroUnion.getUserToken(uuid);
    if (!userToken) {
        data.message = `用户 ${uuid} 不存在，请检查参数uuid并确认大小写完整正确`;
    }else {
        let paramsCheck = {};
        for (const key in req.body) {
            if (key != 'sign') {
                paramsCheck[key] = req.body[key];
            }
        }

        let mySign = common.sign(paramsCheck, userToken);
        if (mySign.toLowerCase() != sign.toLowerCase()) {
            data.message = `签名 ${sign} 不匹配，请确保token正确及签名方法跟文档一致`;
        }
    }

    if (!data.message) {
        data.task = await heroUnion.createTask(uuid, url, platform, contract, data_mode, notify_url, country, lang);
        data.code = 1;
        data.message = '新爬虫任务提交完成';
    }

    return res.status(200).json(data);
});

/**
 * 联盟成员向联盟查询某个任务的数据
 * 
 * 参数：
 * uuid: 用户ID
 * task_id: 任务ID
 * sign: 参数签名，签名方法见README.md“接口参数签名方法”
 **/
router.get('/querytask/', async (req, res) => {
    let uuid = req.query.uuid,
        task_id = req.query.task_id,
        sign = req.query.sign;
    
    let data = {code: 0, message: ''};

    //参数检查
    if (!uuid || !task_id || !sign) {
        data.message = '必选参数uuid、task_id、sign不能为空';
    }else if (common.isUuidOk(uuid) == false) {
        data.message = '参数uuid应为6-32位的英文字符串，请联系管理员获得';
    }else if (common.isTaskIdOk(task_id) == false) {
        data.message = '任务编号task_id格式错误，请使用接口/api/newtask/返回数据里的任务id属性值';
    }else if (common.isNormalName(sign, 32, 32) == false) {
        data.message = '签名sign应为32位的英文字符串';
    }

    //签名检查
    let userToken = await heroUnion.getUserToken(uuid);
    if (!userToken) {
        data.message = `用户 ${uuid} 不存在，请检查参数uuid并确认大小写完整正确`;
    }else {
        let paramsCheck = {
            uuid: uuid,
            task_id: task_id
        };
        let mySign = common.sign(paramsCheck, userToken);
        if (mySign.toLowerCase() != sign.toLowerCase()) {
            data.message = `签名 ${sign} 不匹配，请确保token正确及签名方法跟文档一致`;
        }
    }

    if (!data.message) {
        data.task = heroUnion.getTaskById(task_id);

        if (data.task) {
            data.code = 1;
            data.message = '获取任务数据完成';
        }else {
            data.message = `找不到编号为${task_id}相关的任务数据`;
        }
    }

    return res.status(200).json(data);
});

/**
 * hero爬虫从联盟获取等待中的数据抓取任务
 * 
 * 参数：
 * platforms: 爬虫支持的平台
 * contracts: 爬虫支持的合约
 * country: 爬虫所在国家
 * lang: 爬虫支持的语言
 * data_mode: 爬虫支持的返回数据格式
 **/
router.get('/gettask/', async (req, res) => {
    let platforms = req.query.platforms,
        contracts = req.query.contracts,
        country = req.query.country ? req.query.country : 'cn',
        lang = req.query.lang ? req.query.lang : 'zh',
        data_mode = req.query.data_mode ? req.query.data_mode : 'json';

    let data = {code: 0, message: ''};

    //参数检查
    if (!platforms || !contracts) {
        data.message = '必选参数platforms、contracts不能为空';
    }else if (common.isPlatformsOk(platforms) == false) {
        data.message = '支持的平台platforms应为英文逗号间隔的3 - 100个英文字符串';
    }else if (common.isContractsOk(contracts) == false) {
        data.message = '支持的合约contracts应为英文逗号间隔的3 - 100个英文字符串';
    }else if (country && common.isIosCountryCode(country) == false) {
        data.message = '国家代码country请传小写的两位字母，参考两位ISO CODES：https://countrycode.org/';
    }else if (lang && common.isIosLangCode(lang) == false) {
        data.message = '语言代码lang请传小写的两位字母，参考ISO 639-1 Code：https://www.loc.gov/standards/iso639-2/php/code_list.php';
    }else if (data_mode && data_mode != 'json' && data_mode != 'html') {
        data.message = '数据格式data_mode可选值：json, html';
    }

    //获取等待中的任务
    if (!data.message) {
        data.task = heroUnion.getWaitingTask(platforms, contracts, country, lang, data_mode);
        if (data.task) {
            data.code = 1;
            data.message = '获取待处理任务完成';
        }else {
            data.message = '暂时没有跟你支持的平台、合约匹配的待处理任务';
        }
    }

    return res.status(200).json(data);
});

/**
 * hero爬虫向联盟提交某个任务的抓取结果
 * 
 * 参数：
 * name: 爬虫名字
 * task_id: 任务ID
 * task_result: 抓取结果数据
 * sign: 参数签名
 **/
router.post('/savetask/', async (req, res) => {
    let name = req.body.name,
        task_id = req.body.task_id,
        task_result = req.body.task_result,
        task_status = req.body.status,
        sign = req.body.sign;

    let data = {code: 0, message: ''};

    //参数检查
    if (!name || !task_id || !task_result || !sign) {
        data.message = '必选参数不能为空';
    }else if (common.isBotNameOk(name) == false) {
        data.message = '爬虫名字必须是6 - 32位英文字母、下划线的组合';
    }else if (common.isTaskIdOk(task_id) == false) {
        data.message = '任务编号task_id格式错误，请使用接口/api/gettask/返回数据里的任务id属性值';
    }

    //检查爬虫是否存在及其状态
    if (!data.message) {
        let heroBot = heroUnion.getHeroByName(name);
        if (!heroBot || heroBot.status == 'offline') {
            data.message = `爬虫${name}不存在或已下线`;
        }
    }

    //签名检查，如果通过则保存任务数据
    if (!data.message) {
        let task = heroUnion.getTaskById(task_id);
        if (task) {
            let paramsCheck = {
                name: name,
                task_id: task_id,
                task_result: task_result
            };

            if (typeof(task_status) != 'undefined' && task_status == 'failed') {
                paramsCheck.status = task_status;
            }

            let mySign = common.sign(paramsCheck, task.token);
            if (mySign.toLowerCase() != sign.toLowerCase()) {
                data.message = `签名 ${sign} 不匹配，请确保token正确及签名方法跟文档一致`;
            }else {
                let saved = heroUnion.saveTaskById(name, task_id, task_result, task_status);
                if (saved) {
                    data.code = 1;
                    data.message = '保存任务数据完成';
                }else {
                    data.message = `任务${task_id}已经完成，请勿重复提交数据`;
                }
            }
        }else {
            data.message = `任务${task_id}不存在`;
        }
    }

    return res.status(200).json(data);
});

/**
 * 爬虫向联盟上报自己的状态，以保持在线
 * 
 * 参数列表
 * name
 * description
 * status: [idle, busy]
 * platforms: '',    //支持的平台，可由爬虫定义
 * contracts: '',    //支持的数据抓取合约，具体内容由爬虫定义
 * timestamp
 * country
 * lang
 * contact           //爬虫提供方的联系方式
 */
router.post('/onboard/', async (req, res) => {
    let bot_name = req.body.name,
        bot_desc = req.body.description,
        status = req.body.status,
        platforms = req.body.platforms,    //多个则用英文逗号间隔
        contracts = req.body.contracts,    //多个则用英文逗号间隔
        timestamp = req.body.timestamp,
        country = req.body.country,
        lang = req.body.lang,
        contact = req.body.contact;
    
    let data = {
        "code": 0,
        "message": ""
    };

    //参数格式检查
    if (!bot_name || !bot_desc || !status || !timestamp || !platforms || !contracts) {
        data.message = '必填参数name、description、status、platforms、contracts、timestamp不能为空';
    }else if (common.isBotNameOk(bot_name) == false) {
        data.message = '爬虫名字必须是6 - 32位英文字母、下划线的组合';
    }else if (typeof(bot_desc) != 'string' || bot_desc.length > 100) {
        data.message = '爬虫简介必须是100个字符以内的字符串';
    }else if (common.isBotStatus(status) == false) {
        data.message = '爬虫状态status传参错误，其可选值：idle、busy';
    }else if (common.isTimestampInSeconds(timestamp) == false) {
        data.message = '时间戳timestamp请传秒数';
    }else if (common.isPlatformsOk(platforms) == false) {
        data.message = '支持的平台platforms应为英文逗号间隔的3 - 100个英文字符串';
    }else if (common.isContractsOk(contracts) == false) {
        data.message = '支持的合约contracts应为英文逗号间隔的3 - 100个英文字符串';
    }else if (country && common.isIosCountryCode(country) == false) {
        data.message = '国家代码country请传小写的两位字母，参考两位ISO CODES：https://countrycode.org/';
    }else if (lang && common.isIosLangCode(lang) == false) {
        data.message = '语言代码lang请传小写的两位字母，参考ISO 639-1 Code：https://www.loc.gov/standards/iso639-2/php/code_list.php';
    }else if (contact && common.isContactOk(contact) == false) {
        data.message = '联系方式contact应为6 - 50个字符';
    }

    if (!data.message) {
        let bot = {
            name: bot_name.toLowerCase(),
            description: bot_desc,
            status: status,
            timestamp: timestamp,
            platforms: platforms.split(','),
            contracts: contracts.split(','),
            contact: contact,
            //如果没传则填充默认值
            country: country ? country.toLowerCase() : 'cn',
            lang: lang ? lang.toLowerCase() : 'zh'
        };

        heroUnion.heroOnboard(bot);
        data.code = 1;
        data.message = `${bot.name}，欢迎上船，因为有你，联盟将更健壮！`;
    }

    return res.status(200).json(data);
});

//获取联盟的hero爬虫列表
router.get('/heros/', async (req, res) => {
    let page = req.query.page,
        limit = req.query.limit;

    if (!page || typeof(page) != 'number') {
        page = 1;
    }
    if (!limit || typeof(limit) != 'number') {
        limit = 20;
    }

    return res.status(200).json(heroUnion.getHeros(page, limit));
});

//获取联盟状态
router.get('/stats/', async (req, res) => {
    return res.status(200).json(heroUnion.getStats());
});

export default router;
