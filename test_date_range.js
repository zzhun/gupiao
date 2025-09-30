import axios from 'axios';

async function testDateRangeAPI() {
    try {
        console.log('测试日期范围涨停股票API...');
        
        // 测试日期范围查询（最近3个交易日）
        console.log('\n1. 测试日期范围查询...');
        const rangeResponse = await axios.get('http://localhost:3000/api/stocks/limit-up-range/20250926/20250930');
        console.log('日期范围API响应状态:', rangeResponse.status);
        console.log('日期范围查询结果:', rangeResponse.data);
        
        if (rangeResponse.data.success) {
            console.log(`总涨停股票数: ${rangeResponse.data.count}`);
            console.log(`查询日期范围: ${rangeResponse.data.dateRange.startDate} - ${rangeResponse.data.dateRange.endDate}`);
            console.log(`交易日数: ${rangeResponse.data.dateRange.totalDays}`);
            console.log(`成功天数: ${rangeResponse.data.dateRange.successDays}`);
            
            if (rangeResponse.data.dateResults) {
                console.log('每日查询结果:');
                rangeResponse.data.dateResults.forEach(result => {
                    console.log(`  ${result.date}: ${result.success ? `${result.count}只涨停` : '查询失败'}`);
                });
            }
        }
        
        console.log('\n✅ 日期范围API测试完成！');
        
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
    testDateRangeAPI();
}, 3000);
