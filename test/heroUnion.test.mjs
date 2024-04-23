/**
 * HeroUnion测试用例
 * 执行此测试之前，请先启动主程序，在根目录执行命令：npm start
 */

import test from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import common from '../common.mjs';
import HeroUnion from '../heroUnion.mjs';

const axiosConfig = {
    timeout: 5000,
    proxy: false
};

test('HeroUnion api list test', async (t) => {
    let api = 'http://127.0.0.1:8080/api/';

    const response = await axios.get(api, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
});

test('Hero onboard test', async (t) => {
    let params = {
        name: 'test_hero',
        description: 'Hero test 测试爬虫',
        status: 'idle',
        timestamp: common.getTimestampInSeconds(),
        platforms: 'douyin,xigua',
        contracts: 'tajiantv',
        country: 'cn',
        lang: 'zh',
        contact: 'https://tajian.tv'
    };

    let api = 'http://127.0.0.1:8080/api/onboard/';

    const response = await axios.post(api, params, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
    assert.equal(response.data.code, 1);


    params.name = 'test_hero_2';
    const response2 = await axios.post(api, params, axiosConfig);
    console.log(response2.data);

    assert.equal(response2.status, 200);
    assert.equal(response2.data.code, 1);
});

test('HeroUnion get heros test', async (t) => {
    let api = 'http://127.0.0.1:8080/api/heros/';

    const response = await axios.get(api, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
});

test('HeroUnion create task test', async (t) => {
    let params = {
        uuid: 'herounion_demo',
        url: 'https://v.douyin.com/xxx',
        platform: 'douyin',
        contract: 'tajiantv',
        data_mode: 'json',
        country: 'cn',
        lang: 'zh',
        notify_url: 'https://tajian.tv/test/'
    };
    let token = 'hello#world!';
    params.sign = common.sign(params, token);

    let api = 'http://127.0.0.1:8080/api/newtask/';

    const response = await axios.post(api, params, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
    assert.equal(response.data.code, 1);
});

test('HeroUnion task query test', async (t) => {
    let params = {
        uuid: 'herounion_demo',
        url: 'https://v.douyin.com/yyy',
        platform: 'douyin',
        contract: 'tajiantv',
        data_mode: 'json',
        country: 'cn',
        lang: 'zh',
        notify_url: 'http://127.0.0.1:8080/test/'
    };
    let token = 'hello#world!';
    params.sign = common.sign(params, token);

    let api = 'http://127.0.0.1:8080/api/newtask/';

    const response = await axios.post(api, params, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
    assert.equal(response.data.code, 1);
    assert.ok(response.data.task);

    //调用查询接口
    let task_id = response.data.task.id;
    assert.ok(task_id);

    api = 'http://127.0.0.1:8080/api/querytask/';
    params = {
        uuid: 'herounion_demo',
        task_id: task_id
    };
    params.sign = common.sign(params, token);

    let queryOption = axiosConfig;
    queryOption.method = 'get';
    queryOption.url = api;
    queryOption.params = params;

    const response2 = await axios(queryOption);
    console.log('Query task params', params,);
    console.log('Query task result', response2.data);

    assert.equal(response2.status, 200);
    assert.equal(response2.data.code, 1);
    assert.ok(response2.data.task);
});

test('HeroUnion get waiting task test', async (t) => {
    //case 1
    let params = {
        platforms: 'douyin,kuaishou,xigua,bilibili',
        contracts: 'tajiantv',
        data_mode: 'json',
        country: 'cn',
        lang: 'zh'
    };

    let api = 'http://127.0.0.1:8080/api/gettask/';

    let queryOption = axiosConfig;
    queryOption.method = 'get';
    queryOption.url = api;
    queryOption.params = params;

    const response = await axios(queryOption);
    console.log(response.data);

    assert.equal(response.status, 200);
    assert.equal(response.data.code, 1);
    assert.ok(response.data.task);

    //case 2
    params.platforms = 'youku';
    const response2 = await axios(queryOption);
    console.log(response2.data);

    assert.equal(response2.status, 200);
    assert.equal(response2.data.code, 0);
    assert.ifError(response2.data.task);
});

test('HeroUnion task data save test', async (t) => {
    let params = {
        platforms: 'douyin,kuaishou,xigua,bilibili',
        contracts: 'tajiantv',
        data_mode: 'json',
        country: 'cn',
        lang: 'zh'
    };

    let api = 'http://127.0.0.1:8080/api/gettask/';

    let queryOption = axiosConfig;
    queryOption.method = 'get';
    queryOption.url = api;
    queryOption.params = params;

    const response = await axios(queryOption);
    console.log(response.data);

    assert.equal(response.status, 200);
    assert.equal(response.data.code, 1);
    assert.ok(response.data.task);

    let task = response.data.task;
    let task_data = {
        "title": "标题：HeroUnion英雄联盟",
        "description": "描述内容，联盟简介",
        "others": "其它内容"
    };

    api = 'http://127.0.0.1:8080/api/savetask/';
    params = {
        name: "test_hero",
        task_id: task.id,
        task_result: task_data
    };
    params.sign = common.sign(params, task.token);    //对参数进行签名

    //case 1
    const response2 = await axios.post(api, params, axiosConfig);
    console.log(response2.data);

    assert.equal(response2.status, 200);
    assert.equal(response2.data.code, 1);

    //case 2
    const response3 = await axios.post(api, params, axiosConfig);
    console.log(response3.data);

    assert.equal(response3.status, 200);
    assert.equal(response3.data.code, 0);
});

test('HeroUnion stats test', async (t) => {
    let api = 'http://127.0.0.1:8080/api/stats/';

    const response = await axios.get(api, axiosConfig);
    console.log(response.data);

    assert.equal(response.status, 200);
});