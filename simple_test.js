import axios from 'axios';

async function testSimpleAPI() {
    try {
        console.log('测试基础API...');
        
        // 先测试一个已知工作的API
        const statsResponse = await axios.get('http://localhost:3000/api/stocks/statistics');
        console.log('统计API状态:', statsResponse.status);
        
        // 测试单日涨停API
        const singleResponse = await axios.get('http://localhost:3000/api/stocks/limit-up/20250930');
        console.log('单日涨停API状态:', singleResponse.status);
        console.log('单日涨停数据:', singleResponse.data.count);
        
        // 测试日期范围API
        const rangeResponse = await axios.get('http://localhost:3000/api/stocks/limit-up-range/20250930/20250930');
        console.log('日期范围API状态:', rangeResponse.status);
        console.log('日期范围数据:', rangeResponse.data.count);
        
    } catch (error) {
        console.error('测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
        }
    }
}

testSimpleAPI();
