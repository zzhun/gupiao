import express from 'express';
import StockService from '../services/StockService.js';
import CrawlerService from '../services/CrawlerService.js';

const router = express.Router();

// 生成日期范围内的所有日期（排除周末）
function generateDateRange(startDate, endDate) {
    const dates = [];
    const start = new Date(
        startDate.slice(0, 4),
        startDate.slice(4, 6) - 1,
        startDate.slice(6, 8)
    );
    const end = new Date(
        endDate.slice(0, 4),
        endDate.slice(4, 6) - 1,
        endDate.slice(6, 8)
    );
    
    const current = new Date(start);
    while (current <= end) {
        // 排除周末（周六=6，周日=0）
        if (current.getDay() !== 0 && current.getDay() !== 6) {
            const dateStr = current.getFullYear().toString() +
                          (current.getMonth() + 1).toString().padStart(2, '0') +
                          current.getDate().toString().padStart(2, '0');
            dates.push(dateStr);
        }
        current.setDate(current.getDate() + 1);
    }
    
    return dates;
}

// 获取所有股票列表
router.get('/stocks', async (req, res) => {
    try {
        const stocks = await StockService.getAllStocks();
        res.json({
            success: true,
            data: stocks,
            count: stocks.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 手动触发爬虫
router.post('/crawl', async (req, res) => {
    try {
        // 设置响应头，支持流式传输
        res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        // 发送开始消息
        res.write('data: {"type": "start", "message": "开始爬取股票数据..."}\n\n');

        // 调用爬虫服务，传入进度回调
        const progressCallback = (progress) => {
            res.write(`data: ${JSON.stringify(progress)}\n\n`);
        };

        const count = await CrawlerService.crawlStockList(progressCallback);
        
        // 发送完成消息
        res.write(`data: {"type": "complete", "message": "爬取完成！总共爬取 ${count} 只股票信息", "count": ${count}}\n\n`);
        res.end();
    } catch (error) {
        res.write(`data: {"type": "error", "message": "爬取失败: ${error.message}"}\n\n`);
        res.end();
    }
});

// 获取板块统计信息
router.get('/stocks/statistics', async (req, res) => {
    try {
        const [rows] = await StockService.getBoardStatistics();
        
        res.json({
            success: true,
            data: rows
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 按板块获取股票
router.get('/stocks/board/:board', async (req, res) => {
    try {
        const { board } = req.params;
        const stocks = await StockService.findByBoard(board);
        
        res.json({
            success: true,
            data: stocks,
            count: stocks.length,
            board: board
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取股票当日分时数据
router.get('/stocks/:code/minute', async (req, res) => {
    try {
        const { code } = req.params;
        const minuteData = await CrawlerService.getMinuteData(code);
        
        res.json({
            success: true,
            data: minuteData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取股票当日K线数据
router.get('/stocks/:code/kline', async (req, res) => {
    try {
        const { code } = req.params;
        const klineData = await CrawlerService.getDailyKLine(code);
        
        res.json({
            success: true,
            data: klineData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取股票当日详细数据
router.get('/stocks/:code/daily', async (req, res) => {
    try {
        const { code } = req.params;
        const stock = await StockService.getStockByCode(code);
        
        if (!stock) {
            return res.status(404).json({
                success: false,
                error: '股票不存在'
            });
        }

        // 获取实时行情数据
        const realTimeData = await CrawlerService.getRealTimeData(code);
        
        res.json({
            success: true,
            data: {
                ...stock,
                realTime: realTimeData
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取实时行情
router.get('/stocks/:code/quote', async (req, res) => {
    try {
        const { code } = req.params;
        const quote = await StockService.getRealTimeQuote(code);
        
        res.json({
            success: true,
            data: quote
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取股票当日完整数据（所有数据）
router.get('/stocks/:code/full', async (req, res) => {
    try {
        const { code } = req.params;
        const stock = await StockService.getStockByCode(code);
        
        if (!stock) {
            return res.status(404).json({
                success: false,
                error: '股票不存在'
            });
        }

        // 获取所有当日数据
        const dailyDetail = await CrawlerService.getStockDailyDetail(code);
        
        res.json({
            success: true,
            data: {
                ...stock,
                ...dailyDetail
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取指定日期的涨停股票列表
router.get('/stocks/limit-up/:date', async (req, res) => {
    try {
        const { date } = req.params;
        console.log(`开始获取 ${date} 的涨停股票列表...`);
        
        // 验证日期格式 (YYYYMMDD)
        const dateRegex = /^\d{8}$/;
        if (!dateRegex.test(date)) {
            return res.status(400).json({
                success: false,
                error: '日期格式错误，请使用 YYYYMMDD 格式',
                message: '日期格式错误'
            });
        }
        
        const limitUpStocks = await CrawlerService.getLimitUpStocks(date);
        
        console.log(`获取 ${date} 涨停股票完成，共 ${limitUpStocks.count} 只`);
        
        res.json({
            success: true,
            data: limitUpStocks.data,
            count: limitUpStocks.count,
            date: date,
            timestamp: limitUpStocks.timestamp,
            message: `获取成功，共找到 ${limitUpStocks.count} 只 ${date} 的涨停股票`
        });
    } catch (error) {
        console.error(`获取 ${req.params.date} 涨停股票失败:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: `获取 ${req.params.date} 涨停股票失败`
        });
    }
});

// 获取日期范围内的涨停股票列表
router.get('/stocks/limit-up-range/:startDate/:endDate', async (req, res) => {
    try {
        const { startDate, endDate } = req.params;
        console.log(`开始获取 ${startDate} 到 ${endDate} 的涨停股票列表...`);
        
        // 验证日期格式 (YYYYMMDD)
        const dateRegex = /^\d{8}$/;
        if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
            return res.status(400).json({
                success: false,
                error: '日期格式错误，请使用 YYYYMMDD 格式',
                message: '日期格式错误'
            });
        }
        
        // 验证日期范围
        if (startDate > endDate) {
            return res.status(400).json({
                success: false,
                error: '开始日期不能晚于结束日期',
                message: '日期范围错误'
            });
        }
        
        // 生成日期范围内的所有日期
        const dates = generateDateRange(startDate, endDate);
        console.log(`查询日期范围: ${dates.join(', ')}`);
        
        // 并发获取所有日期的涨停股票数据
        const allLimitUpStocks = [];
        const dateResults = [];
        
        for (const date of dates) {
            try {
                console.log(`正在获取 ${date} 的涨停股票...`);
                const dayResult = await CrawlerService.getLimitUpStocks(date);
                if (dayResult.success && dayResult.data) {
                    allLimitUpStocks.push(...dayResult.data);
                    dateResults.push({
                        date: date,
                        count: dayResult.data.length,
                        success: true
                    });
                } else {
                    dateResults.push({
                        date: date,
                        count: 0,
                        success: false,
                        error: '无数据或API错误'
                    });
                }
            } catch (error) {
                console.error(`获取 ${date} 涨停股票失败:`, error.message);
                dateResults.push({
                    date: date,
                    count: 0,
                    success: false,
                    error: error.message
                });
            }
            
            // 添加延迟避免请求过于频繁
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 统计信息
        const successDates = dateResults.filter(r => r.success);
        const totalCount = allLimitUpStocks.length;
        
        console.log(`日期范围查询完成，共 ${dates.length} 个交易日，成功 ${successDates.length} 个，总计 ${totalCount} 只涨停股票`);
        
        res.json({
            success: true,
            data: allLimitUpStocks,
            count: totalCount,
            dateRange: {
                startDate: startDate,
                endDate: endDate,
                totalDays: dates.length,
                successDays: successDates.length,
                failedDays: dateResults.length - successDates.length
            },
            dateResults: dateResults,
            timestamp: new Date().toISOString(),
            message: `获取成功，${startDate} 到 ${endDate} 共找到 ${totalCount} 只涨停股票`
        });
    } catch (error) {
        console.error(`获取日期范围涨停股票失败:`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '获取日期范围涨停股票失败'
        });
    }
});

// 获取今天的涨停股票列表
router.get('/stocks/limit-up-today', async (req, res) => {
    try {
        // 获取今天的日期，格式为YYYYMMDD
        const today = new Date();
        const date = today.getFullYear().toString() + 
                    (today.getMonth() + 1).toString().padStart(2, '0') + 
                    today.getDate().toString().padStart(2, '0');
        
        console.log(`开始获取今天 ${date} 的涨停股票列表...`);
        
        const limitUpStocks = await CrawlerService.getLimitUpStocks(date);
        
        console.log(`获取今天涨停股票完成，共 ${limitUpStocks.count} 只`);
        
        res.json({
            success: true,
            data: limitUpStocks.data,
            count: limitUpStocks.count,
            date: date,
            timestamp: limitUpStocks.timestamp,
            message: `获取成功，共找到 ${limitUpStocks.count} 只今天 ${date} 的涨停股票`
        });
    } catch (error) {
        console.error('获取今天涨停股票失败:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: '获取今天涨停股票失败'
        });
    }
});

// 获取单只股票信息（放在最后，作为通用路由）
router.get('/stocks/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const stock = await StockService.getStockByCode(code);
        
        if (!stock) {
            return res.status(404).json({
                success: false,
                error: '股票不存在'
            });
        }

        res.json({
            success: true,
            data: stock
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

export default router; 