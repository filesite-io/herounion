/**
 * 多国语言管理
 * 
 * node i18n.mjs init [默认语言代号]
 * node i18n.mjs build [语言代号]
 */

import fs from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import common from './common.mjs';

class I18N {

	//构造函数，设置默认配置
    constructor(defaultLang, templateDir, langDir, buildDir) {
    	this.defaultLang = typeof(defaultLang) != 'undefined' && defaultLang ? defaultLang : 'en';
    	this.templateDir = typeof(templateDir) != 'undefined' && templateDir ? templateDir : './public/template/';
    	this.langDir = typeof(langDir) != 'undefined' && langDir ? langDir : './i18n/';
    	this.buildDir = typeof(buildDir) != 'undefined' && buildDir ? buildDir : './public/';
    }

    //从模板文件中解析语言占位变量，并生成语言包文件
    async init() {
        const _self = this;

        try {
			const files = await readdir(_self.templateDir);
			let parseLangRes = null;
			for (const file of files) {
				parseLangRes = await _self.parseLangFromTemplate(_self.templateDir + file);
				if (parseLangRes) {
					console.log('Template file [%s] parse lang config done', file);
				}
			}
		} catch (err) {
			console.error('Read dir in function init failed', err);
			return false;
		}

		return true;
    }

    //根据语言包文件以及模板文件，生成对应语言的html文件
    async build(lang) {
        const _self = this;

        const langFiles = await _self.getLangFiles(lang);
        console.log('Lang json files', langFiles);

        if (langFiles && langFiles.length > 0) {
        	try {
        		let langData = null;
				let newHtml = '', saved = false;
        		for (const langFile of langFiles) {
	        		const langJson = await readFile(_self.langDir + langFile, { encoding: 'utf8' });
	        		if (!langJson) {
	        			continue;
	        		}
	        		langData = JSON.parse(langJson);

					const files = await readdir(_self.templateDir);
					for (const file of files) {
						newHtml = await _self.replaceLangToTemplate(_self.templateDir + file, langData);
						if (newHtml) {
							saved = await _self.saveBuildHtml(langFile.replace('.json', ''), file, newHtml);
							console.log('Template file [%s] lang data replace with [%s] done, html build [%s].', file, langFile, (saved ? 'success' : 'failed'));
						}
					}
        		}
			} catch (err) {
				console.error('Read dir in function build failed', err);
				return false;
			}
        }

        return true;
    }

    //判断语言代码格式是否符合国际标准
    isIosLangCode(lang) {
    	return /^[a-z]{2}(\-[a-z]{2})?$/i.test(lang);
    }

    //判断是否是语言包文件
    isIosLangFile(filename) {
    	return /^[a-z]{2}(\-[a-z]{2})?\.json$/i.test(filename);
    }

    //更新语言包文件内容，合并新的数据到已有内容中
    async updateLangFile(langFile, langJson) {
    	const _self = this;
    	let updated = false;

    	try {
			let json = await readFile(langFile, { encoding: 'utf8'});
			if (json) {
				let data = JSON.parse(json);
				for (const key in langJson) {
					data[key] = langJson[key];
				}

				await writeFile(langFile, JSON.stringify(data, null, 4));
			}else {
				await writeFile(langFile, JSON.stringify(langJson, null, 4));
			}

			updated = true;
		} catch (err) {
			console.error('updateLangFile failed', err);
		}

    	return updated;
    }

    //解析单个模板文件，并生成语言包文件
    async parseLangFromTemplate(templateFilepath) {
        const _self = this;

        let langJson = {},
        	total = 0;
        try {
			const html_template = await readFile(templateFilepath, { encoding: 'utf8' });

			const regHtmlLang = /[\s\S]*<html lang="([^"]+)">[\s\S]*/i;
			let htmlLang = html_template.replace(regHtmlLang, "$1");
			if (htmlLang == html_template || _self.isIosLangCode(htmlLang) == false) {
				htmlLang = _self.defaultLang;
			}else {
				htmlLang = htmlLang.toLowerCase();
			}

			//模版语法不能包含：换行符、英文冒号、英文分号
			const regLang = /\{([^\}\r\n:;]+)\}/ig;
			const matches = html_template.matchAll(regLang);
			for (const match of matches) {
			    langJson[match[1]] = match[1];
			    total ++;
			}

			//更新语言包文件
			if (total > 0) {
				let langFile = _self.langDir + `${htmlLang}.json`;
				const saved = await _self.updateLangFile(langFile, langJson);
				if (!saved) {
					return false;
				}
			}
		} catch (err) {
			console.error('parseLangFromTemplate failed', err);
			return false;
		}

		return langJson;
    }

    //获取所有语言包json文件
    async getLangFiles(lang) {
    	const _self = this;

    	let langFiles = [];

    	try {
			const files = await readdir(_self.langDir);
			let parseLangRes = null;
			for (const file of files) {
				if (_self.isIosLangFile(file)) {
					if (typeof(lang) == 'undefined') {
						langFiles.push(file);
					}else if (file.indexOf(lang) > -1) {
						langFiles.push(file);
					}
				}
			}
		} catch (err) {
			console.error('Read dir in function getLangFiles failed', err);
			return false;
		}

		return langFiles;
    }

    //根据语言包替换单个模板文件，返回新的html代码
    async replaceLangToTemplate(templateFilepath, langData) {
        const _self = this;

        let html = '';
        try {
			const html_template = await readFile(templateFilepath, { encoding: 'utf8' });

			html = html_template;
			for (let key in langData) {
				html = html.replaceAll(`{${key}}`, langData[key]);
			}
		} catch (err) {
			console.error('replaceLangToTemplate failed', err);
			return false;
		}

		return html;
    }

    //保存替换了语言包的html文件
    async saveBuildHtml(lang, htmlFilename, htmlContent) {
    	const _self = this;
    	let saved = false;

    	try {
			let langDir = _self.buildDir + lang;
			if (!fs.existsSync(langDir)) {
				fs.mkdirSync(langDir);
			}

			let htmlFile = `${langDir}/${htmlFilename}`;
			await writeFile(htmlFile, htmlContent);
			saved = true;
		} catch (err) {
			console.error('saveBuildHtml failed', err);
		}

    	return saved;
    }

}

export default I18N;