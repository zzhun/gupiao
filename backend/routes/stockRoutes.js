import express from 'express';
import StockService from '../services/StockService.js';
import CrawlerService from '../services/CrawlerService.js';

const router = express.Router();

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