import axios from 'axios';

async function testDeduplication() {
    try {
        console.log('测试涨停股票去重功能...');
        
        // 测试日期范围查询（包含重复股票的日期）
        console.log('\n1. 测试日期范围查询（应该包含重复股票）...');
        const rangeResponse = await axios.get('http://localhost:3000/api/stocks/limit-up-range/20250930/20250930');
        console.log('日期范围API响应状态:', rangeResponse.status);
        
        if (rangeResponse.data.success) {
            console.log(`去重前总数: ${rangeResponse.data.totalCount}`);
            console.log(`去重后数量: ${rangeResponse.data.count}`);
            console.log(`重复股票数: ${rangeResponse.data.deduplication?.removedCount || 0}`);
            
            if (rangeResponse.data.deduplication) {
                console.log('去重信息:', rangeResponse.data.deduplication);
            }
            
            // 检查是否有重复的股票代码
            const stockCodes = rangeResponse.data.data.map(stock => stock.code);
            const uniqueCodes = [...new Set(stockCodes)];
            console.log(`实际股票代码数: ${uniqueCodes.length}`);
            console.log(`返回数据长度: ${rangeResponse.data.data.length}`);
            
            if (stockCodes.length === uniqueCodes.length) {
                console.log('✅ 去重功能正常：没有重复股票代码');
            } else {
                console.log('❌ 去重功能异常：存在重复股票代码');
            }
        }
        
        console.log('\n✅ 去重功能测试完成！');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
        }
    }
}

testDeduplication();
