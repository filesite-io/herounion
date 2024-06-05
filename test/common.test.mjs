/**
 * Common公用方法测试用例
 */

import test from 'node:test';
import assert from 'node:assert';
import common from '../common.mjs';
import md5 from 'md5';

test('Common function sortDict test', (t) => {
    let params = {
        b: 2,
        a: 1
    };

    const expectRes = {
        a: 1,
        b: 2
    };

    assert.deepEqual(common.sortDict(params), expectRes);
});

test('Common function getConfigFromJsonFile test', async (t) => {
    let filename = 'config.json';
    let config = await common.getConfigFromJsonFile(filename);

    assert.ok(config);

    const expectName = 'Hero Union';
    assert.strictEqual(config.name, expectName);
});

test('Common function getLocalTimeString test', async (t) => {
    let timeString = common.getLocalTimeString('zh-CN', 'Asia/Shanghai');
    console.log('北京时间：%s', timeString);
    assert.ok(timeString);

    timeString = common.getLocalTimeString('zh-HK', 'UTC');
    console.log('香港UTC时间：%s', timeString);
    assert.ok(timeString);
});

test('Common function log/info/warn/error test', async (t) => {
    let string = '测试log输出';
    let args = [];

    args = common.log(string);
    assert.ok(args);
    assert.equal(/^\[%s\] /i.test(args[0]), true);
    assert.equal(args.length, 2);

    args = common.log('console.log替换测试：%s', string);
    assert.ok(args);
    assert.equal(/^\[%s\] /i.test(args[0]), true);
    assert.equal(args.length, 3);
    assert.equal(args[args.length - 1], string);

    args = common.info('console.info替换测试：%s', string);
    assert.ok(args);
    assert.equal(/^\[%s\] /i.test(args[0]), true);
    assert.equal(args.length, 3);
    assert.equal(args[args.length - 1], string);

    args = common.warn('console.warn替换测试：%s', string);
    assert.ok(args);
    assert.equal(/^\[%s\] /i.test(args[0]), true);
    assert.equal(args.length, 3);
    assert.equal(args[args.length - 1], string);

    args = common.error('console.error替换测试：%s，再重复一次：%s', string, string);
    assert.ok(args);
    assert.equal(/^\[%s\] /i.test(args[0]), true);
    assert.equal(args.length, 4);
    assert.equal(args[args.length - 1], string);

    console.log("插入日期后的参数：\n%s", args);
});

test('Common function isNormalName test', async (t) => {
    let case1 = common.isNormalName('test01', 5);
    assert.equal(case1, true);

    let case2 = common.isNormalName('test01', 8);
    assert.equal(case2, false);

    let case3 = common.isNormalName('test0123456', 6, 10);
    assert.equal(case3, false);

    let case4 = common.isNormalName('test0123456', 6, 15);
    assert.equal(case4, true);

    let case5 = common.isNormalName(md5('test0123456'), 32, 32);
    assert.equal(case5, true);
});


test('Common function isTaskIdOk test', async (t) => {
    let case1 = common.isTaskIdOk('test01');
    assert.equal(case1, false);

    let case2 = common.isTaskIdOk('test01_hello');
    assert.equal(case2, false);

    let case3 = common.isTaskIdOk('test0_123456');
    assert.equal(case3, false);

    let case4 = common.isTaskIdOk('test01_0123456789');
    assert.equal(case4, false);

    let case5 = common.isTaskIdOk('test01_1234567890123');
    assert.equal(case5, true);
});

test('Common function byteSize test', async (t) => {
    let case1 = common.byteSize('a');
    assert.equal(case1, 1);

    let case2 = common.byteSize('0');
    assert.equal(case2, 1);

    let case3 = common.byteSize('你');
    assert.equal(case3, 3);

    let case4 = common.byteSize('😃');
    assert.equal(case4, 4);

    let case5 = common.byteSize('hello 你');
    assert.equal(case5, 9);
});

test('Common function saveLog test', async (t) => {
    let data = {a: 1, b:2};
    let filename = './log/test.log';
    let saved = await common.saveLog(filename, JSON.stringify(data));
    assert.equal(saved, true);

    //case 2
    filename = './logs/test.log';
    saved = await common.saveLog(filename, JSON.stringify(data));
    assert.equal(saved, false);
});

test('Common function isUrlOk test', async (t) => {
    let url = 'https://www.bilibili.com/video/BV1AM41137LB/?share_source=copy_web';
    let urlOk = common.isUrlOk(url);
    assert.equal(urlOk, true);

    //case 2
    url = 'https://www.bilibili.com/video/BV1AM41137LB/';
    urlOk = common.isUrlOk(url);
    assert.equal(urlOk, true);

    //case 3
    url = 'http://127.0.0.1:8080/video/BV1AM41137LB.html';
    urlOk = common.isUrlOk(url);
    assert.equal(urlOk, true);

    //case 4
    url = '//127.0.0.1:8080/video/BV1AM41137LB.html';
    urlOk = common.isUrlOk(url);
    assert.equal(urlOk, false);

    //case 5
    url = 'https://www.bil-ibili.com/video/BV1AM4_1137LB/';
    urlOk = common.isUrlOk(url);
    assert.equal(urlOk, true);

    //case 6
    url = 'https://tajian.tv/1000/frontapi/hunotify/';
    urlOk = common.isUrlOk(url);
    assert.equal(urlOk, true);
});