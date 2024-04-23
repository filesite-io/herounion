# HeroUnion - 英雄联盟

Union of hero bots，一个Hero的爬虫联盟。

HeroUnion主要做两件事：

* 加入联盟的爬虫定期到联盟领取网页抓取任务，并将任务结果回传
* 对外提供提交网页抓取任务和获取任务结果的接口供联盟成员使用，并支持任务完成回调通知


## 本文档目录

* [HeroUnion英雄联盟源码使用方法](#herounion英雄联盟源码使用方法)
* [HeroUnion英雄联盟使用流程](#herounion英雄联盟使用流程)
  1. [联盟成员使用流程](#联盟成员使用流程)
  2. [联盟的爬虫工作流程](#联盟的爬虫工作流程)
* [HeroUnion联盟接口](#herounion联盟接口)
  1. [提交网页抓取任务接口](#提交网页抓取任务接口)
  2. [查询网页抓取任务结果接口](#查询网页抓取任务结果接口)
  3. [爬虫任务完成回调通知接口](#爬虫任务完成回调通知接口)
  4. [Hero爬虫查询接口](#Hero爬虫查询接口)
  5. [联盟状态查询接口](#联盟状态查询接口)
  6. [爬虫状态上报接口](#爬虫状态上报接口)
  7. [爬虫任务领取接口](#爬虫任务领取接口)
  8. [爬虫任务完成回传接口](#爬虫任务完成回传接口)
* [接口参数签名方法](#接口参数签名方法)
* [国内知名平台名称列表](#国内知名平台名称列表)
* [HeroUnion英雄联盟开发进度](#herounion英雄联盟开发进度)
* [其它参考](#其它参考)


## HeroUnion英雄联盟源码使用方法

1. 用git下载源码
```
git clone "https://git.filesite.io/filesite/hero_union.git"
```

2. 安装Node.js依赖包
```
npm install
```

如果因为网络问题部分依赖包无法下载，请参考：[其它参考](#其它参考) 里的代理使用方法。


3. 启动HeroUnion英雄联盟
```
npm start
```


## HeroUnion英雄联盟使用流程

### 联盟成员使用流程

1. 调用接口向联盟提交网页抓取任务
2. 任务完成时联盟会主动通知回传任务结果
3. 也可以调用接口查询任务结果


### 联盟的爬虫工作流程

1. 本地启动爬虫后，定期向联盟上报爬虫状态
2. 爬虫定期从联盟领取新的网页抓取任务
3. 爬虫完成网页抓取任务时调用接口上报给联盟


## HeroUnion联盟接口

HeroUnion联盟网站：[HeroUnion英雄联盟](https://herounion.filesite.io/)。

接口返回值示例及其说明：

执行成功：
```
{
    "code": 1,
    "message": "完成",
    其它数据...
}
```

执行失败：
```
{
    "code": 0,
    "message": "错误信息"
}
```


以下为联盟所有接口的详细文档：

### 提交网页抓取任务接口

* 接口网址：
```
https://herounion.filesite.io/api/newtask/
```
* 请求方法：**POST**
* 请求参数：
```
uuid
url
platform
contract
data_mode
selectors
notify_url
country
lang
sign
```

参数说明：
* platform: url所属平台，目前支持的：抖音、快手、西瓜视频、bilibili
* contract: 数据抓取合约，目前支持的：tajiantv，可由爬虫自定义并实现合约规则
* data_mode: 返回数据格式，默认：json，可选值：json、html
* sign: 对所有参数进行签名，具体方法见文档底部[接口参数签名方法](#接口参数签名方法)

返回值（以下其它接口返回值类似）：
* 如果提交完成，返回code=1、及新任务数据task
* 如果提交失败，返回code=0、及错误信息message


### 查询网页抓取任务结果接口

* 接口网址：
```
https://herounion.filesite.io/api/querytask/
```
* 请求方法：**GET**
* 请求参数：
```
uuid
task_id
sign
```


### 爬虫任务完成回调通知接口

* 接收通知网址：
```
见提交网页抓取任务接口中的参数：notify_url
```
* 数据格式：JSON，返回header：{Content-Type: application/json}
* 请求方法：**POST**
* 请求参数：
```
task_id
task_result
timestamp
sign
```

notify_url返回值：
* 处理成功返回http status 200，其它状态码被视为失败
* 如果回调通知收到失败的状态码，将会在一定时间内再次重试


### Hero爬虫查询接口

* 接口网址：
```
https://herounion.filesite.io/api/heros/
```
* 请求方法：**GET**
* 请求参数：
```
page: 可选，从1开始的页码
limit: 可选，每页数量
```

返回值：
* 最多返回联盟最新的1000个爬虫


### 联盟状态查询接口

* 接口网址：
```
https://herounion.filesite.io/api/stats/
```
* 请求方法：**GET**
* 请求参数：**无**

返回值示例：
```
{
  start_time: 1712826714,
  taskStatus: { total: 6, waiting: 6, running: 0, done: 0, failed: 0 },
  heroStatus: { total: 4, idle: 4, busy: 0, offline: 0 },
  run_seconds: 94
}
```


### 爬虫状态上报接口

* 接口网址：
```
https://herounion.filesite.io/api/onboard/
```
* 请求方法：**POST**
* 请求参数：
```
name
description
status: [idle, busy]
platforms: 爬虫支持的平台，可由爬虫定义，也可参考本文档底部[国内知名平台名称列表](#国内知名平台名称列表)
contracts: 支持的数据抓取合约，具体内容由爬虫定义
timestamp
country
lang
contact: 可选，爬虫提供方联系方式，将在英雄联盟网站展示，便于大家相互联系
```

参数说明，其中country国家代码和lang语言代码参数值请参考下面标准：
* [country代码参考两位ISO CODES](https://countrycode.org/)
* [lang语言代码参考ISO 639-1 Code](https://www.loc.gov/standards/iso639-2/php/code_list.php)


### 爬虫任务领取接口

* 接口网址：
```
https://herounion.filesite.io/api/gettask/
```
* 请求方法：**GET**
* 请求参数：
```
platforms: 爬虫支持的平台
contracts: 爬虫支持的合约
country: 可选，爬虫所在国家
lang: 可选，爬虫支持的语言
data_mode: 可选，爬虫支持的返回数据格式
```


### 爬虫任务完成回传接口

* 接口网址：
```
https://herounion.filesite.io/api/savetask/
```
* 请求方法：**POST**
* 请求参数：
```
name
task_id
task_result
sign
```


## 接口参数签名方法

将所有参数按字母排序之后转换成JSON字符串（注意需保持斜杠/和unicode字符串不转义），最后再拼接上token计算MD5值。

示例如下：
```
var token = 'hello world';        //注册联盟后获得的密钥
var params = {                    //参数示例
    "b": 2,
    "a": 1,
    "t": 234343
};

var sortObj = function(obj) {     //参数排序方法
    return Object.keys(obj).sort().reduce(function(result, key) {
        result[key] = obj[key];
        return result;
    }, {});
};

//1. 排序参数
var sortedParams = sortObj(params);
//2. 计算MD5值
var sign = md5( JSON.stringify(sortedParams) + token );
```


## 国内知名平台名称列表

以下平台名可作为爬虫支持的平台参考：
* douyin       - 抖音
* kuaishou     - 快手
* xigua        - 西瓜视频
* bilibili     - B站


## HeroUnion英雄联盟开发进度

* v0.1 - beta 2024-04-11 已完成
* v0.2 - stable稳定版，2024-04-16发布


## 其它参考

### 本地把socks端口转发http端口方法

npm install 使用代理，本地socks转web proxy软件：
```
https://www.npmjs.com/package/http-proxy-to-socks
```

启动代理软件：
```
hpts -s 127.0.0.1:1080 -p 8002
```

上述示例会把本机socks端口1080转发到8002端口（socks代理如何安装本文档不展开讨论，请自行研究）。


### 为npm配置代理方法

修改npm的配置文件：~/.npmrc，添加下面配置：
```
proxy=http://127.0.0.1:8002
https-proxy=http://127.0.0.1:8002
```

如果你的home目录下没有.npmrc文件，先创建。

配置代理后，下面命令将默认走代理：
```
npm install
```
