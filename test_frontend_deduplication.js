import axios from 'axios';

async function testFrontendDeduplication() {
    try {
        console.log('测试前端去重功能...');
        
        // 测试日期范围查询，获取重复数据
        console.log('\n1. 测试日期范围查询（会产生重复数据）...');
        const rangeResponse = await axios.get('http://localhost:3000/api/stocks/limit-up-range/20250930/20250930');
        console.log('日期范围API响应状态:', rangeResponse.status);
        
        if (rangeResponse.data.success) {
            const originalData = rangeResponse.data.data;
            console.log(`原始数据总数: ${originalData.length}`);
            
            // 模拟前端的去重逻辑
            const stockMap = new Map();
            originalData.forEach(stock => {
                const existingStock = stockMap.get(stock.code);
                if (!existingStock || stock.date > existingStock.date) {
                    stockMap.set(stock.code, stock);
                }
            });
            
            const deduplicatedData = Array.from(stockMap.values());
            console.log(`去重后数据总数: ${deduplicatedData.length}`);
            console.log(`重复股票数量: ${originalData.length - deduplicatedData.length}`);
            
            // 显示一些重复的股票示例
            const stockCounts = new Map();
            originalData.forEach(stock => {
                stockCounts.set(stock.code, (stockCounts.get(stock.code) || 0) + 1);
            });
            
            const duplicateStocks = Array.from(stockCounts.entries())
                .filter(([code, count]) => count > 1)
                .slice(0, 5); // 只显示前5个重复的股票
            
            if (duplicateStocks.length > 0) {
                console.log('\n重复股票示例:');
                duplicateStocks.forEach(([code, count]) => {
                    console.log(`  ${code}: 出现 ${count} 次`);
                });
            }
        }
        
        console.log('\n✅ 前端去重功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

// 等待服务启动
setTimeout(() => {
    testFrontendDeduplication();
}, 3000);
