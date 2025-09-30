import axios from 'axios';

async function testLimitUpAPI() {
    try {
        console.log('测试涨停股票API...');
        
        // 测试今天的涨停股票
        console.log('\n1. 测试获取今天涨停股票...');
        const todayResponse = await axios.get('http://localhost:3000/api/stocks/limit-up-today');
        console.log('今天涨停股票API响应状态:', todayResponse.status);
        console.log('今天涨停股票数量:', todayResponse.data.count);
        
        if (todayResponse.data.success && todayResponse.data.data.length > 0) {
            console.log('前3只涨停股票:');
            todayResponse.data.data.slice(0, 3).forEach((stock, index) => {
                console.log(`${index + 1}. ${stock.name}(${stock.code}) - 涨跌幅: ${stock.changePercentage}%`);
            });
        }
        
        // 测试指定日期的涨停股票
        console.log('\n2. 测试获取指定日期涨停股票...');
        const dateResponse = await axios.get('http://localhost:3000/api/stocks/limit-up/20250930');
        console.log('指定日期涨停股票API响应状态:', dateResponse.status);
        console.log('指定日期涨停股票数量:', dateResponse.data.count);
        
        if (dateResponse.data.success && dateResponse.data.data.length > 0) {
            console.log('前3只涨停股票:');
            dateResponse.data.data.slice(0, 3).forEach((stock, index) => {
                console.log(`${index + 1}. ${stock.name}(${stock.code}) - 涨跌幅: ${stock.changePercentage}%`);
            });
        }
        
        console.log('\n✅ 所有API测试完成！');
        
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
    testLimitUpAPI();
}, 3000);

