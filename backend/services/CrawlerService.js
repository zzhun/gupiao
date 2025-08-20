import axios from 'axios';
import randomUseragent from 'random-useragent';
import Stock from '../models/Stock.js';

class CrawlerService {
    // 创建axios实例
    static createAxiosInstance() {
        return axios.create({
            timeout: 30000,  // 增加到30秒
            headers: {
                'User-Agent': randomUseragent.getRandom(),
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Referer': 'http://www.eastmoney.com/',
                'Cache-Control': 'max-age=0'
            }
        });
    }

    // 根据股票代码和名称判断板块
    static getMarketInfo(code, name = '') {
        // 添加调试信息
        console.log(`判断股票板块: 代码=${code}, 名称=${name}`);
        
        // 先判断是否为 ST 股票
        if (name && (name.includes('ST') || name.includes('*ST'))) {
            // 根据代码前缀判断市场
            if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003')) {
                console.log(`ST股票 ${code} 识别为: 深圳 ST板`);
                return { market: '深圳', board: 'ST板' };
            } else if (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605')) {
                console.log(`ST股票 ${code} 识别为: 上海 ST板`);
                return { market: '上海', board: 'ST板' };
            } else {
                console.log(`ST股票 ${code} 识别为: 未知 ST板`);
                return { market: '未知', board: 'ST板' };
            }
        }
        
        // 深圳市场
        if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003')) {
            console.log(`股票 ${code} 识别为: 深圳 主板`);
            return { market: '深圳', board: '主板' };
        } else if (code.startsWith('300')) {
            console.log(`股票 ${code} 识别为: 深圳 创业板`);
            return { market: '深圳', board: '创业板' };
        }
        // 上海市场
        else if (code.startsWith('688')) {
            console.log(`股票 ${code} 识别为: 上海 科创板`);
            return { market: '上海', board: '科创板' };
        } else if (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605')) {
            console.log(`股票 ${code} 识别为: 上海 主板`);
            return { market: '上海', board: '主板' };
        }
        // 8开头的股票需要进一步判断是三板还是北交所
        else if (code.startsWith('8')) {
            // 暂时标记为"待判断"，在后续异步判断中确定
            console.log(`股票 ${code} 标记为待判断板块`);
            return { market: '待判断', board: '待判断' };
        }
        // 其他情况
        else {
            console.log(`股票 ${code} 无法识别，标记为: 未知 未知`);
            return { market: '未知', board: '未知' };
        }
    }

    // 判断是否为北证50指数成分股
    static isBeiZheng50Stock(code, name) {
        // 北证50指数成分股列表（需要定期更新）
        const beiZheng50Stocks = [
            // 这里可以添加北证50指数成分股的代码列表
            // 或者通过API动态获取
        ];
        
        // 如果代码在列表中，直接返回true
        if (beiZheng50Stocks.includes(code)) {
            return true;
        }
        
        // 如果不在列表中，可以通过其他方式判断
        // 比如通过股票名称包含特定关键词，或者通过API查询
        if (name && (name.includes('北交所') || name.includes('北证'))) {
            return true;
        }
        
        return false;
    }

    // 动态获取北证50指数成分股列表
    static async getBeiZheng50Stocks() {
        try {
            const url = 'http://push2.eastmoney.com/api/qt/clist/get';
            const params = {
                pn: 1,
                pz: 100, // 北证50通常不超过100只
                po: 1,
                np: 1,
                ut: 'bd1d9ddb04089700cf9c27f6f7426281',
                fltt: 2,
                invt: 2,
                fid: 'f3',
                fs: 'm:0+t:81', // 北交所板块
                fields: 'f12,f14' // 只需要代码和名称
            };

            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url, { params });
            const data = response.data;

            if (data.data && data.data.diff) {
                const stocks = data.data.diff;
                const stockCodes = stocks.map(stock => stock.f12);
                console.log(`获取到北交所股票 ${stockCodes.length} 只:`, stockCodes);
                return stockCodes;
            }
            
            return [];
        } catch (error) {
            console.error('获取北证50指数成分股失败:', error.message);
            return [];
        }
    }

    // 改进的北交所股票判断方法
    static async isBeiZheng50StockAsync(code, name) {
        try {
            // 获取北交所股票列表
            const beiZhengStocks = await this.getBeiZheng50Stocks();
            
            // 如果代码在列表中，直接返回true
            if (beiZhengStocks.includes(code)) {
                return true;
            }
            
            // 如果不在列表中，通过名称判断
            if (name && (name.includes('北交所') || name.includes('北证'))) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error(`判断北交所股票失败 ${code}:`, error.message);
            // 出错时通过名称判断作为备选方案
            return name && (name.includes('北交所') || name.includes('北证'));
        }
    }

    // 爬取东方财富网股票列表（支持进度回调）
    static async crawlStockList(progressCallback = null) {
        try {
            let totalCount = 0;
            
            // 定义各板块的爬取参数
            const boardConfigs = [
                { name: '深圳主板', fs: 'm:0+t:6', market: '深圳', board: '主板' },
                { name: '深圳创业板', fs: 'm:0+t:13', market: '深圳', board: '创业板' },
                { name: '上海主板', fs: 'm:1+t:2', market: '上海', board: '主板' },
                { name: '上海科创板', fs: 'm:1+t:23', market: '上海', board: '科创板' },
                { name: '北交所', fs: 'm:0+t:81', market: '北京', board: '北交所' },
                { name: '三板', fs: 'm:0+t:80', market: '深圳', board: '三板' }
            ];
            
            // 记录已爬取的股票代码，避免重复
            const crawledCodes = new Set();
            
            // 板块统计
            const boardCounts = {
                '主板': 0,
                '创业板': 0,
                '科创板': 0,
                '北交所': 0,
                '三板': 0,
                'ST板': 0,
                '未知': 0
            };
            
            // 发送开始进度
            if (progressCallback) {
                progressCallback({
                    type: 'start',
                    currentPage: 0,
                    totalCount: 0,
                    message: '开始爬取股票数据...'
                });
            }
            
            // 分板块爬取
            for (let boardIndex = 0; boardIndex < boardConfigs.length; boardIndex++) {
                const config = boardConfigs[boardIndex];
                console.log(`开始爬取 ${config.name} 板块...`);
                
                if (progressCallback) {
                    progressCallback({
                        type: 'info',
                        currentPage: 0,
                        totalCount: totalCount,
                        message: `开始爬取 ${config.name} 板块...`
                    });
                }
                
                // 爬取当前板块
                const boardResult = await this.crawlBoard(config, crawledCodes, progressCallback, totalCount);
                totalCount += boardResult.count;
                
                // 更新板块统计
                if (boardCounts.hasOwnProperty(config.board)) {
                    boardCounts[config.board] += boardResult.count;
                }
                
                console.log(`${config.name} 板块爬取完成，新增 ${boardResult.count} 只股票`);
                
                // 板块间延迟
                if (boardIndex < boardConfigs.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            console.log(`爬取完成！最终板块统计:`, boardCounts);
            console.log(`总共爬取 ${totalCount} 只股票，去重后实际插入 ${crawledCodes.size} 只`);
            
            // 爬取完成后清理重复数据
            console.log('开始清理重复数据...');
            if (progressCallback) {
                progressCallback({
                    type: 'info',
                    currentPage: 0,
                    totalCount: totalCount,
                    message: '正在清理重复数据...'
                });
            }
            
            const deletedCount = await Stock.removeDuplicates();
            console.log(`重复数据清理完成，删除了 ${deletedCount} 条记录`);
            
            // 获取清理后的数据库统计
            const dbStats = await Stock.getDatabaseStats();
            console.log('清理后的数据库统计:', dbStats);
            
            // 发送完成进度
            if (progressCallback) {
                progressCallback({
                    type: 'complete',
                    currentPage: 0,
                    totalCount: totalCount,
                    message: `爬取完成！总共爬取 ${totalCount} 只股票信息，清理后剩余 ${dbStats.total} 只`
                });
            }
            
            return totalCount;
        } catch (error) {
            console.error('爬取股票列表失败:', error.message);
            throw error;
        }
    }

    // 爬取单个板块
    static async crawlBoard(config, crawledCodes, progressCallback, baseCount) {
        let page = 1;
        const pageSize = 100;
        let retryCount = 0;
        const maxRetries = 3;
        let emptyPageCount = 0;
        const maxEmptyPages = 5; // 增加空页容忍度
        let boardCount = 0;
        
        while (true) {
            try {
                console.log(`正在爬取 ${config.name} 第 ${page} 页...`);
                
                const url = 'http://80.push2.eastmoney.com/api/qt/clist/get';
                const params = {
                    pn: page,
                    pz: pageSize,
                    po: 1,
                    np: 1,
                    ut: 'bd1d9ddb04089700cf9c27f6f7426281',
                    fltt: 2,
                    invt: 2,
                    fid: 'f3',
                    fs: config.fs,
                    fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152'
                };

                const axiosInstance = this.createAxiosInstance();
                const response = await axiosInstance.get(url, { params });
                const data = response.data;

                if (data.data && data.data.diff && data.data.diff.length > 0) {
                    const stocks = data.data.diff;
                    let pageStockCount = 0;
                    
                    console.log(`${config.name} 第 ${page} 页获取到 ${stocks.length} 只股票数据`);
                    
                    for (const stock of stocks) {
                        // 检查是否已经爬取过
                        if (crawledCodes.has(stock.f12)) {
                            continue;
                        }
                        
                        // 对于三板和北交所，需要特殊处理
                        let marketInfo = { market: config.market, board: config.board };
                        
                        if (config.board === '三板' || config.board === '北交所') {
                            // 8开头的股票需要进一步判断
                            if (stock.f12.startsWith('8')) {
                                // 先尝试判断是否为北交所股票
                                try {
                                    const isBeiZheng = await this.isBeiZheng50StockAsync(stock.f12, stock.f14);
                                    if (isBeiZheng) {
                                        // 北交所股票
                                        marketInfo = { market: '北京', board: '北交所' };
                                        console.log(`股票 ${stock.f12} 识别为: 北京 北交所`);
                                    } else {
                                        // 三板股票
                                        marketInfo = { market: '深圳', board: '三板' };
                                        console.log(`股票 ${stock.f12} 识别为: 深圳 三板`);
                                    }
                                } catch (error) {
                                    console.error(`判断北交所股票失败 ${stock.f12}:`, error.message);
                                    // 出错时，根据爬取的板块来判断
                                    if (config.board === '北交所') {
                                        marketInfo = { market: '北京', board: '北交所' };
                                    } else {
                                        marketInfo = { market: '深圳', board: '三板' };
                                    }
                                }
                            }
                        }
                        
                        // ST股票特殊处理
                        if (stock.f14 && (stock.f14.includes('ST') || stock.f14.includes('*ST'))) {
                            if (stock.f12.startsWith('000') || stock.f12.startsWith('001') || stock.f12.startsWith('002') || stock.f12.startsWith('003')) {
                                marketInfo = { market: '深圳', board: 'ST板' };
                            } else if (stock.f12.startsWith('600') || stock.f12.startsWith('601') || stock.f12.startsWith('603') || stock.f12.startsWith('605')) {
                                marketInfo = { market: '上海', board: 'ST板' };
                            }
                        }
                        
                        const stockData = {
                            code: stock.f12,
                            name: stock.f14,
                            market: marketInfo.market,
                            board: marketInfo.board,
                            industry: stock.f100 || '未知'
                        };

                        try {
                            await Stock.create(stockData);
                            boardCount++;
                            crawledCodes.add(stock.f12);
                            
                            console.log(`成功插入股票: ${stock.f12} ${stock.f14} -> ${marketInfo.market} ${marketInfo.board}`);
                        } catch (error) {
                            console.error(`插入股票失败 ${stock.f12}:`, error.message);
                            crawledCodes.add(stock.f12);
                        }
                    }
                    
                    console.log(`${config.name} 第 ${page} 页完成，插入 ${pageStockCount} 只股票`);
                    
                    if (pageStockCount === 0) {
                        emptyPageCount++;
                        if (emptyPageCount >= maxEmptyPages) {
                            console.log(`${config.name} 连续 ${maxEmptyPages} 页没有新股票，爬取完成`);
                            break;
                        }
                    } else {
                        emptyPageCount = 0;
                    }
                    
                    // 发送进度更新
                    if (progressCallback && boardCount % 10 === 0) {
                        progressCallback({
                            type: 'progress',
                            currentPage: page,
                            totalCount: baseCount + boardCount,
                            message: `${config.name} 已爬取 ${boardCount} 只股票`
                        });
                    }
                    
                    page++;
                    retryCount = 0;
                    
                    // 页面间延迟
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                } else {
                    console.log(`${config.name} 没有更多数据，爬取完成`);
                    break;
                }
                
            } catch (error) {
                retryCount++;
                console.error(`${config.name} 第 ${page} 页爬取失败 (重试 ${retryCount}/${maxRetries}):`, error.message);
                
                if (retryCount >= maxRetries) {
                    console.error(`${config.name} 第 ${page} 页重试次数已达上限，跳过此页`);
                    page++;
                    retryCount = 0;
                    continue;
                }
                
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
        }
        
        return { count: boardCount };
    }

    // 添加请求频率控制
    static requestQueue = [];
    static lastRequestTime = 0;
    static minInterval = 2000; // 最小间隔2秒

    static async makeRequest(url, params) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minInterval) {
            const waitTime = this.minInterval - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.lastRequestTime = Date.now();
        
        const axiosInstance = this.createAxiosInstance();
        return await axiosInstance.get(url, { params });
    }

    // 获取实时股票数据（使用新浪财经API，更稳定）
    static async getRealTimeData(code) {
        try {
            // 添加随机延迟，避免请求过快
            const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3秒随机延迟
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 使用新浪财经API
            const url = `http://hq.sinajs.cn/list=${code.startsWith('6') ? 'sh' : 'sz'}${code}`;
            
            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url);
            
            // 解析新浪财经的数据格式
            const data = response.data;
            const stockData = data.split('=')[1].split(',');
            
            return {
                f43: parseFloat(stockData[3]) || 0,  // 当前价格
                f57: stockData[0].replace(/"/g, ''),  // 股票名称
                f58: code,  // 股票代码
                f169: parseFloat(stockData[4]) || 0,  // 涨跌幅
                f170: parseFloat(stockData[4]) || 0,  // 涨跌幅
                f46: parseFloat(stockData[1]) || 0,   // 今开
                f44: parseFloat(stockData[4]) || 0,   // 最高
                f51: parseFloat(stockData[5]) || 0,   // 最低
                f168: parseFloat(stockData[2]) || 0,  // 昨收
                f47: parseFloat(stockData[8]) || 0,   // 成交量
                f48: parseFloat(stockData[9]) || 0    // 成交额
            };
        } catch (error) {
            console.error(`获取股票 ${code} 实时数据失败:`, error.message);
            throw error;
        }
    }

    // 获取股票当日分时数据
    static async getMinuteData(code) {
        try {
            const url = 'http://push2.eastmoney.com/api/qt/stock/trends2/get';
            const params = {
                ut: 'fa5fd1943c7b386f172d6893dbfba10b',
                fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
                fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
                secid: code.startsWith('6') ? `1.${code}` : `0.${code}`,
                ndays: 1,
                iscca: 1,
                iscca: 1
            };

            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url, { params });
            return response.data;
        } catch (error) {
            console.error(`获取股票 ${code} 分时数据失败:`, error.message);
            return null;
        }
    }

    // 获取股票当日K线数据
    static async getDailyKLine(code) {
        try {
            const url = 'http://push2his.eastmoney.com/api/qt/stock/kline/get';
            const params = {
                ut: 'fa5fd1943c7b386f172d6893dbfba10b',
                fields1: 'f1,f2,f3,f4,f5,f6,f7,f8',
                fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
                klt: 101, // 日K
                fqt: 1,   // 前复权
                secid: code.startsWith('6') ? `1.${code}` : `0.${code}`,
                beg: 0,
                end: 20500101,
                lmt: 1    // 只取最近1天
            };

            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url, { params });
            return response.data;
            return response.data;
        } catch (error) {
            console.error(`获取股票 ${code} K线数据失败:`, error.message);
            return null;
        }
    }

    // 获取股票当日详细数据（综合）
    static async getStockDailyDetail(code) {
        try {
            const [realTimeData, minuteData, klineData] = await Promise.all([
                this.getRealTimeData(code),
                this.getMinuteData(code),
                this.getDailyKLine(code)
            ]);

            return {
                realTime: realTimeData,
                minute: minuteData,
                kline: klineData,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error(`获取股票 ${code} 当日详细数据失败:`, error.message);
            throw error;
        }
    }
}

export default CrawlerService;