/**
 * HeroBot测试用例
 * 执行此测试之前，请先启动主程序，在根目录执行命令：npm start
 */

import test from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import common from '../common.mjs';
import HeroBot from '../heroBot.mjs';

let server_url = 'http://127.0.0.1:8080',
    bot_name = 'test_hero_bot',
    bot_description = '测试爬虫 test',
    support_platforms = 'douyin,xigua',
    support_contracts = 'tajiantv',
    bot_country = 'cn',
    bot_lang = 'zh',
    bot_contact = 'https://tajian.tv',
    data_mode = 'json';

let heroBot = new HeroBot(
        server_url,
        bot_name,
        bot_description,
        support_platforms,
        support_contracts,
        bot_country,
        bot_lang,
        bot_contact,
        data_mode
    );

test('Hero onboard test', async (t) => {
    let status = 'idle';
    const res = await heroBot.heartBeat(status);
    console.log(res);

    assert.ok(res);
    assert.equal(res.code, 1);
});

test('Hero get task and data save test', async (t) => {
    const task = await heroBot.getNewTask();
    console.log(task);

    assert.ok(task);

    let task_data = {
        "title": "标题测试：HeroUnion英雄联盟",
        "description": "描述内容，联盟简介",
        "others": "其它内容"
    };
    let res = await heroBot.saveTaskData(task.id, task.token, task_data);
    console.log(res);

    assert.equal(res.code, 1);
});