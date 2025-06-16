
# i18n 多语言辅助工具

脚本入口：translate.mjs，模板文件放在public/目录下方便调试，根据模板和多语言json配置文件生成的html文件也放在public/目录下，
并以语言代号为子目录。

多语言配置文件以json格式保存在当前目录下，
文件名格式为：语言代号.json


国际语言代号参考：

* https://www.andiamo.co.uk/resources/iso-language-codes/


其中：

* zh - 简体中文
* zh-cn - 简体中文
* zh-tw - 台湾繁体中文
* zh-hk - 香港繁体中文
* zh-sg - 新加坡繁体中文


所有语言代码均为小写字母。



## 语言包命令


### 从模板文件解析默认语言包


```
node i18n.mjs init [默认语言代号]
```

如果不传参数“默认语言代号”，默认从模板文件的<html lang="{语言代码}">标签中解析，如果解析失败，则默认为英文en；  
从template/里的模板文件中解析出语言模版代码，并保存到i18n/{默认语言代码}.json文件中。



### 使用语言包生成html文件

```
node i18n.mjs build [语言代号]
```

如果不传参数“语言代号”，则生成i18n/目录下的所有已配置语言对应的html文件。

