/**
 * i18n测试用例
 */

import fs from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert';
import common from '../common.mjs';
import I18N from '../i18n.mjs';


let initTest = async function(t) {
    const i18n = new I18N();
    const res = await i18n.init();

    assert.ok(res);
};

let buildTest = async function(t) {
    let lang = process.argv[3];
    let configFilename = process.argv[4];
    if (!configFilename) {configFilename = 'config.json';}
    const i18n = new I18N(configFilename);
    const res = await i18n.build(lang);

    assert.ok(res);
};

let getLangKeys = async function(t) {
    const i18n = new I18N();
    let langFiles = await i18n.getLangFiles('en-us');
    const langJson = await readFile(i18n.langDir + langFiles[0], { encoding: 'utf8' });
    if (langJson) {
        let langData = JSON.parse(langJson);
        for (const key in langData) {
            console.log(key);
        }
    }

    assert.ok(langJson);
};


let command = process.argv[2];
if (!command) {
    console.error('Test command usage: node test/i18n.test.mjs "command"');
    console.error('Test commands: init, build, langKeys');
}else {
    switch (command) {
        case 'init':
            //根据模板文件生成默认语言包
            test('Init test', initTest);
            break;

        case 'build':
            //根据语言包生成对应语言的html
            test('Build test', buildTest);
            break;

        case 'langKeys':
            test('Lang file content get test', getLangKeys);
            break;

        default:
            console.error('Test command usage: node test/i18n.test.mjs "command"');
            console.error('Test commands: init, build, langKeys');
    }
}
