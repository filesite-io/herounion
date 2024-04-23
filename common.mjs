/**
 * 公用方法
 */

import fs from 'node:fs';
import { readdir, readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import md5 from 'md5';

class Common {

    //构造函数，设置默认配置
    constructor() {
        this.configDir = resolve('conf/');
    }

    getTimestamp() {
        return Math.floor(Date.now());
    }

    getTimestampInSeconds() {
        return Math.floor(Date.now() / 1000);
    }

    getLocalTimeString(locales, timezone) {
        if (typeof(locales) == 'undefined' || !locales) {
            locales = 'zh-Hans-CN';
        }

        if (typeof(timezone) == 'undefined' || !timezone) {
            timezone = 'Asia/Shanghai';
        }

        let date = new Date();
        let option = {"timeZone": timezone};
        return date.toLocaleString(locales, option);
    }

    sortDict(obj) {                         //dict按key排序
        return Object.keys(obj).sort().reduce(function(result, key) {
            result[key] = obj[key];
            return result;
        }, {});
    }

    sign(params, token) {                    //对参数做MD5签名
        return md5( JSON.stringify(this.sortDict(params)) + token );
    }

    //从conf/目录读取配置文件内容
    async getConfigFromJsonFile(filename) {
        let data = null;

        let filePath = this.configDir + `/${filename}`;
        if (fs.existsSync(filePath)) {
            try {
                const contents = await readFile(filePath, { encoding: 'utf8' });
                if (contents) {
                    data = JSON.parse(contents);
                }
            } catch (err) {
                console.error(`[FAILED] get config content from %s failed, error: %s`, filePath, err.message);
            }
        }else {
            console.error("[ERROR] file %s not exist.", filePath);
        }

        return data;
    }

    //判断语言代码是否符合国际标准
    isIosLangCode(lang) {
        return /^[a-z]{2}$/i.test(lang);
    }

    //判断国家代码是否符合国际标准
    isIosCountryCode(country) {
        return /^[a-z]{2}$/i.test(country);
    }

    //判断爬虫状态代码是否正确
    isBotStatus(status) {
        const codes = [
            "idle",
            "busy"
        ];

        return codes.findIndex((item) => item == status) > -1;
    }

    //判断是否单位为毫秒的时间戳
    isTimestamp(timestamp) {
        try {
            timestamp = parseInt(timestamp);
        }catch(err) {
            console.error('Timestamp %s is not a number!', timestamp);
        }

        return typeof(timestamp) == 'number' && /^1[0-9]{12}$/.test(timestamp);
    }

    //判断是否单位为秒的时间戳
    isTimestampInSeconds(timestamp) {
        try {
            timestamp = parseInt(timestamp);
        }catch(err) {
            console.error('Timestamp %s is not a number!', timestamp);
        }

        return typeof(timestamp) == 'number' && /^1[0-9]{9}$/.test(timestamp);
    }

    //检查爬虫名字是否符合标准：6 - 32位字母和下划线的组合
    isBotNameOk(bot_name) {
        return /^\w{6,32}$/i.test(bot_name);
    }

    //检查爬虫支持的平台是否符合标准：用英文逗号间隔的最长3 - 100个字符的英文字符串
    isPlatformsOk(platforms) {
        return /^[\w,]{3,100}$/i.test(platforms);
    }

    //检查爬虫支持的合约是否符合标准：用英文逗号间隔的最长3 - 100个字符的英文字符串
    isContractsOk(contracts) {
        return /^[\w,]{3,100}$/i.test(contracts);
    }

    //检查爬虫提供方联系方式是否符合标准：6 - 50个非空白字符
    isContactOk(contact) {
        return /^\S{6,50}$/i.test(contact);
    }

    //检查url是否符合要求
    isUrlOk(url) {
        return /^http(s)?:\/\/[\w\.\/:]{6,100}$/i.test(url);
    }

    //检查uuid是否符合要求：6-32位的英文字符串
    isUuidOk(uuid) {
        return /^\w{6,32}$/i.test(uuid);
    }

    //检查task_id是否符合要求：uuid_timestamp
    isTaskIdOk(task_id) {
        let arr = task_id.split('_');
        if (arr.length < 2) {
            return false;
        }

        let uuid = arr[0];
        let timestamp = arr[arr.length - 1];
        if (arr.length > 2) {
            uuid = task_id.replace(`_${timestamp}`, '');
        }

        return this.isUuidOk(uuid) && this.isTimestamp(timestamp);
    }

    //检查英文名等参数是否符合标准：5 - 32位字母和下划线的组合
    isNormalName(name, minLength, maxLength) {
        if (typeof(minLength) == 'undefined') {minLength = 6;}
        if (typeof(maxLength) == 'undefined') {maxLength = 32;}
        return /^\w+$/i.test(name) && name.length >= minLength && name.length <= maxLength;
    }

    getLogArguments() {
        let args = [];
        let localTime = this.getLocalTimeString('zh-Hans-CN', 'Asia/Shanghai');

        if (arguments[0]) {
            let logFormat = `[%s] ${arguments[0]}`;
            args.push(logFormat);
            args.push(localTime);
        }

        if (arguments && arguments.length > 1) {
            for (const index in arguments) {
                if (index > 0) {
                    args.push(arguments[index]);
                }
            }
        }

        return args;
    }

    log() {
        let args = this.getLogArguments.apply(this, arguments);
        console.log.apply(this, args);
        return args;
    }

    info() {
        let args = this.getLogArguments.apply(this, arguments);
        console.info.apply(this, args);
        return args;
    }

    warn() {
        let args = this.getLogArguments.apply(this, arguments);
        console.warn.apply(this, args);
        return args;
    }

    error() {
        let args = this.getLogArguments.apply(this, arguments);
        console.error.apply(this, args);
        return args;
    }

    byteSize(str) {
        return Buffer.byteLength(str, 'utf8');
    }

    //保存log到指定文件
    async saveLog(filePath, content) {
        let saved = false;

        try {
            let saveRes = await appendFile(filePath, content);
            if (saveRes == undefined) {
                saved = true;
            }
        } catch (err) {
            console.error(`Log save to %s failed: %s`, filePath, err.message);
        }

        return saved;
    }

}

let commonFuns = new Common();
export default commonFuns;