import axios from 'axios';
import randomUseragent from 'random-useragent';
import Stock from '../models/Stock.js';

class CrawlerService {
    // 创建axios实例
    static createAxiosInstance() {
        return axios.create({
            timeout: 30000,  // 增加到30秒
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Referer': 'https://www.eastmoney.com/',
                'Cache-Control': 'max-age=0',
                'DNT': '1'
            }
        });
    }

    // 根据股票代码和名称判断板块
    static getMarketInfo(code, name = '') {
        // 先判断是否为 ST 股票
        if (name && (name.includes('ST') || name.includes('*ST'))) {
            // 根据代码前缀判断市场
            if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003')) {
                return { market: '深圳', board: 'ST板' };
            } else if (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605')) {
                return { market: '上海', board: 'ST板' };
            } else {
                return { market: '未知', board: 'ST板' };
            }
        }
        
        // 深圳市场
        if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003')) {
            return { market: '深圳', board: '主板' };
        } else if (code.startsWith('30')) {
            // 创业板：30开头的6位数字
            return { market: '深圳', board: '创业板' };
        }
        // 上海市场
        else if (code.startsWith('688')) {
            return { market: '上海', board: '科创板' };
        } else if (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605')) {
            return { market: '上海', board: '主板' };
        }
        // 8开头的股票 - 需要进一步判断是北交所还是三板
        else if (code.startsWith('8')) {
            // 暂时标记为"待判断"，在后续异步判断中确定
            return { market: '待判断', board: '待判断' };
        }
        // 其他情况
        else {
            return { market: '未知', board: '未知' };
        }
    }

    // 爬取东方财富网股票列表（支持进度回调）
    static async crawlStockList(progressCallback = null) {
        try {
            let totalCount = 0;
            let page = 1;
            const pageSize = 100;
            let retryCount = 0;
            const maxRetries = 3;
            let emptyPageCount = 0;
            const maxEmptyPages = 10;
            
            // 记录已爬取的股票代码，避免重复
            const crawledCodes = new Set();
            
            // 板块统计
            const boardCounts = {
                '主板': 0,
                '创业板': 0,
                '科创板': 0,
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
            
            while (true) {
                try {
                    console.log(`正在爬取第 ${page} 页...`);
                    
                    // 发送页面开始进度
                    if (progressCallback) {
                        progressCallback({
                            type: 'page_start',
                            currentPage: page,
                            totalCount: totalCount,
                            message: `正在爬取第 ${page} 页...`
                        });
                    }
                    
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
                        // 使用更准确的板块参数
                        // m:0+t:6 - 深圳主板, m:0+t:80 - 深圳创业板
                        // m:1+t:2 - 上海主板, m:1+t:23 - 上海科创板
                        // 添加更多板块确保覆盖完整
                        fs: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:14,m:1+t:3',
                        // 字段说明：
                        // f12: 股票代码, f14: 股票名称, f100: 行业
                        // f20: 总市值(亿元), f21: 流通市值(亿元), f22: 涨跌幅
                        // f23: 涨跌额, f24: 成交量, f25: 成交额
                        fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152,f100'
                    };

                    console.log(`第 ${page} 页API参数:`, { pn: page, pz: pageSize, fs: params.fs });

                    const axiosInstance = this.createAxiosInstance();
                    const response = await axiosInstance.get(url, { params });
                    const data = response.data;

                    if (data.data && data.data.diff && data.data.diff.length > 0) {
                        const stocks = data.data.diff;
                        let pageStockCount = 0;
                        
                        console.log(`第 ${page} 页获取到 ${stocks.length} 只股票数据`);
                        
                        for (const stock of stocks) {
                            // 检查是否已经爬取过
                            if (stock.f14.includes('退市') || stock.f14.endsWith('退')  || crawledCodes.has(stock.f12)) {
                                continue;
                            }
                            
                            // 根据股票代码和名称判断板块
                            const marketInfo = this.getMarketInfo(stock.f12, stock.f14);
                            
                            // 添加创业板调试日志
                            if (stock.f12.startsWith('30')) {
                                console.log(`发现创业板股票: ${stock.f12} ${stock.f14} -> ${marketInfo.market} ${marketInfo.board}`);
                            }
                            
                            // 对于"待判断"板块的股票，放到未知板块
                            let finalMarketInfo = marketInfo;
                            if (finalMarketInfo.board === '待判断') {
                                finalMarketInfo = { market: '未知', board: '未知' };
                                console.log(`股票 ${stock.f12} 待判断，放到未知板块`);
                            }
                            
                            const stockData = {
                                code: stock.f12,
                                name: stock.f14,
                                market: finalMarketInfo.market,
                                board: finalMarketInfo.board,
                                industry: stock.f100 || '未知',
                                totalMarketValue: parseFloat(stock.f20) || 0, // 总市值
                                circulatingMarketValue: parseFloat(stock.f21) || 0, // 流通市值
                                currentPrice: parseFloat(stock.f2) || 0, // 当前价格
                                changePercentage: parseFloat(stock.f22) || 0, // 涨跌幅
                                changeAmount: parseFloat(stock.f23) || 0, // 涨跌额
                                volume: parseFloat(stock.f24) || 0, // 成交量
                                turnover: parseFloat(stock.f25) || 0 // 成交额
                            };

                            try {
                                await Stock.create(stockData);
                                totalCount++;
                                pageStockCount++;
                                crawledCodes.add(stock.f12);
                                
                                // 统计板块数量
                                if (boardCounts.hasOwnProperty(finalMarketInfo.board)) {
                                    boardCounts[finalMarketInfo.board]++;
                                    
                                    // 创业板专门调试
                                    if (finalMarketInfo.board === '创业板') {
                                        console.log(`创业板计数更新: ${boardCounts['创业板']}, 股票: ${stock.f12} ${stock.f14}`);
                                    }
                                }
                                
                                console.log(`成功插入股票: ${stock.f12} ${stock.f14} -> ${finalMarketInfo.market} ${finalMarketInfo.board}`);
                            } catch (error) {
                                console.error(`插入股票失败 ${stock.f12}:`, error.message);
                                crawledCodes.add(stock.f12);
                            }
                        }
                        
                        console.log(`第 ${page} 页完成，插入 ${pageStockCount} 只股票，当前总计: ${totalCount} 只股票`);
                        
                        // 每页输出详细的板块统计
                        console.log(`第 ${page} 页板块统计:`, boardCounts);
                        
                        // 如果当前页没有插入新股票，增加空页计数
                        if (pageStockCount === 0) {
                            emptyPageCount++;
                            console.log(`第 ${page} 页没有新股票，连续空页: ${emptyPageCount}`);
                            
                            if (emptyPageCount >= maxEmptyPages) {
                                console.log(`连续 ${maxEmptyPages} 页没有新股票，爬取完成`);
                                console.log(`最终统计: 总共爬取 ${totalCount} 只股票`);
                                break;
                            }
                        } else {
                            emptyPageCount = 0;
                        }
                        
                        // 发送页面完成进度
                        if (progressCallback) {
                            progressCallback({
                                type: 'page_complete',
                                currentPage: page,
                                totalCount: totalCount,
                                message: `第 ${page} 页完成，当前总计: ${totalCount} 只股票`
                            });
                        }
                        
                        // 每100只股票输出一次统计
                        if (totalCount % 100 === 0) {
                            console.log(`当前板块统计:`, boardCounts);
                        }
                        
                        // 发送实时进度更新
                        if (progressCallback && totalCount % 10 === 0) {
                            progressCallback({
                                type: 'progress',
                                currentPage: page,
                                totalCount: totalCount,
                                message: `已爬取 ${totalCount} 只股票，当前板块统计: ${JSON.stringify(boardCounts)}`
                            });
                        }
                        
                        // 添加最大页数限制，防止无限爬取
                        if (page > 200) {
                            console.log(`已达到最大页数限制(200页)，爬取完成`);
                            break;
                        }
                        
                        page++;
                        retryCount = 0;
                        
                        const delay = Math.floor(Math.random() * 500) + 500;
                        await new Promise(resolve => setTimeout(resolve, delay));
                        
                    } else {
                        console.log('没有更多数据，爬取完成');
                        break;
                    }
                    
                } catch (error) {
                    retryCount++;
                    console.error(`第 ${page} 页爬取失败 (重试 ${retryCount}/${maxRetries}):`, error.message);
                    
                    // 发送错误进度
                    if (progressCallback) {
                        progressCallback({
                            type: 'error',
                            currentPage: page,
                            totalCount: totalCount,
                            message: `第 ${page} 页爬取失败: ${error.message}`
                        });
                    }
                    
                    if (retryCount >= maxRetries) {
                        console.error(`第 ${page} 页重试次数已达上限，跳过此页`);
                        page++;
                        retryCount = 0;
                        continue;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
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

    // 获取实时股票数据（使用东方财富API，更稳定）
    static async getRealTimeData(code, retryCount = 0) {
        const maxRetries = 3;
        
        try {
            // 添加随机延迟，避免请求过快
            const delay = Math.floor(Math.random() * 2000) + 1000; // 1-3秒随机延迟
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // 使用东方财富API，更稳定
            const url = 'http://push2.eastmoney.com/api/qt/ulist.np/get';
            const params = {
                secids: code.startsWith('6') ? `1.${code}` : `0.${code}`,
                fields: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f128,f136,f115,f152',
                ut: 'bd1d9ddb04089700cf9c27f6f7426281',
                fltt: 2,
                invt: 2,
                fid: 'f3'
            };
            
            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url, { params });
            
            if (response.data && response.data.data && response.data.data.diff && response.data.data.diff.length > 0) {
                const stock = response.data.data.diff[0];
                return {
                    f43: parseFloat(stock.f2) || 0,  // 当前价格
                    f57: stock.f14 || '',  // 股票名称
                    f58: code,  // 股票代码
                    f169: parseFloat(stock.f3) || 0,  // 涨跌幅
                    f170: parseFloat(stock.f4) || 0,  // 涨跌额
                    f46: parseFloat(stock.f17) || 0,   // 今开
                    f44: parseFloat(stock.f15) || 0,   // 最高
                    f51: parseFloat(stock.f16) || 0,   // 最低
                    f168: parseFloat(stock.f18) || 0,  // 昨收
                    f47: parseFloat(stock.f5) || 0,   // 成交量
                    f48: parseFloat(stock.f6) || 0,   // 成交额
                    totalMarketValue: parseFloat(stock.f20) || 0, // 总市值
                    circulatingMarketValue: parseFloat(stock.f21) || 0 // 流通市值
                };
            } else {
                throw new Error('API返回数据格式错误');
            }
        } catch (error) {
            console.error(`获取股票 ${code} 实时数据失败 (重试 ${retryCount}/${maxRetries}):`, error.message);
            
            // 如果还有重试次数，等待后重试
            if (retryCount < maxRetries) {
                const waitTime = (retryCount + 1) * 2000; // 递增等待时间
                console.log(`等待 ${waitTime}ms 后重试...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                return this.getRealTimeData(code, retryCount + 1);
            }
            
            // 如果东方财富API失败，尝试使用新浪财经API作为备用
            try {
                console.log(`尝试使用新浪财经API获取股票 ${code} 数据...`);
                const sinaUrl = `http://hq.sinajs.cn/list=${code.startsWith('6') ? 'sh' : 'sz'}${code}`;
                const sinaResponse = await axios.get(sinaUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                        'Referer': 'http://finance.sina.com.cn/'
                    },
                    timeout: 10000
                });
                
                const data = sinaResponse.data;
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
            } catch (sinaError) {
                console.error(`新浪财经API也失败:`, sinaError.message);
                throw new Error(`无法获取股票 ${code} 的实时数据，两个API都失败`);
            }
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
                iscca: 1
            };

            const axiosInstance = this.createAxiosInstance();
            const response = await axiosInstance.get(url, { params });
            
            if (response.data && response.data.data) {
                return response.data;
            } else {
                throw new Error('分时数据API返回格式错误');
            }
        } catch (error) {
            console.error(`获取股票 ${code} 分时数据失败:`, error.message);
            return null;
        }
    }

    // 获取股票当日K线数据
    static async getDailyKLine(code, days = 1, maxRetries = 3) {
        // 随机User-Agent列表
        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
        ];
        
        // 随机Referer列表
        const referers = [
            'https://www.eastmoney.com/',
            'https://quote.eastmoney.com/',
            'https://data.eastmoney.com/',
            'https://www.baidu.com/',
            'https://www.google.com/'
        ];
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
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
                    lmt: days    // 获取指定天数的数据
                };

                // 随机选择User-Agent和Referer
                const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
                const randomReferer = referers[Math.floor(Math.random() * referers.length)];
                
                const axiosInstance = this.createAxiosInstance();
                
                // 添加随机请求头
                const response = await axiosInstance.get(url, { 
                    params,
                    timeout: 15000, // 增加超时时间到15秒
                    headers: {
                        'User-Agent': randomUserAgent,
                        'Referer': randomReferer,
                        'Accept': 'application/json, text/plain, */*',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'Accept-Encoding': 'gzip, deflate',
                        'Connection': 'keep-alive',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });
                
                if (response.data && response.data.data) {
                    console.log(`股票 ${code} K线数据获取成功 (尝试 ${attempt}/${maxRetries})`);
                    return response.data;
                } else {
                    throw new Error('K线数据API返回格式错误');
                }
            } catch (error) {
                console.error(`获取股票 ${code} K线数据失败 (尝试 ${attempt}/${maxRetries}):`, error.message);
                
                // 如果是最后一次尝试，抛出错误
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // 如果不是最后一次尝试，等待后重试
                // 使用指数退避策略，避免被识别为机器人
                const baseDelay = 2000; // 基础延迟2秒
                const exponentialDelay = baseDelay * Math.pow(2, attempt - 1); // 指数增长
                const jitter = Math.random() * 1000; // 随机抖动0-1秒
                const finalDelay = Math.min(exponentialDelay + jitter, 10000); // 最大延迟10秒
                
                console.log(`等待 ${Math.round(finalDelay)}ms 后重试... (指数退避策略)`);
                await new Promise(resolve => setTimeout(resolve, finalDelay));
            }
        }
        
        // 这里不应该到达，因为最后一次尝试会抛出错误
        throw new Error(`获取股票 ${code} K线数据失败，已重试 ${maxRetries} 次`);
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