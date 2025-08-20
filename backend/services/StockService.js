import Stock from '../models/Stock.js';
import CrawlerService from './CrawlerService.js';

class StockService {
    // 获取所有股票基本信息
    static async getAllStocks() {
        return await Stock.findAll();
    }

    // 获取单只股票信息
    static async getStockByCode(code) {
        return await Stock.findByCode(code);
    }

    // 获取实时行情数据
    static async getRealTimeQuote(code) {
        const stock = await Stock.findByCode(code);
        if (!stock) {
            throw new Error('股票不存在');
        }

        const realTimeData = await CrawlerService.getRealTimeData(code);
        return {
            ...stock,
            realTimeData
        };
    }

    // 批量获取实时行情
    static async getBatchRealTimeQuotes(codes) {
        const promises = codes.map(code => 
            this.getRealTimeQuote(code).catch(err => ({
                code,
                error: err.message
            }))
        );
        return await Promise.all(promises);
    }

    // 按板块查找股票
    static async findByBoard(board) {
        return await Stock.findByBoard(board);
    }

    // 获取板块统计信息
    static async getBoardStatistics() {
        return await Stock.getBoardStatistics();
    }
}

export default StockService; 