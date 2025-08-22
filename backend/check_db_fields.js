import mysql from 'mysql2/promise';

async function checkDatabaseFields() {
    let connection;
    try {
        console.log('检查数据库字段...');
        
        connection = await mysql.createConnection({
            host: 'localhost',
            user: 'zz',
            password: '123456',
            port: 3306,
            charset: 'utf8mb4',
            database: 'gupiao_db'
        });
        
        console.log('数据库连接成功');
        
        // 检查表结构
        const [tableStructure] = await connection.execute('DESCRIBE stocks');
        console.log('\n当前表结构:');
        tableStructure.forEach(col => {
            console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''} ${col.Comment || ''}`);
        });
        
        // 检查是否有市值相关字段
        const marketValueFields = ['total_market_value', 'circulating_market_value', 'current_price', 'change_percentage', 'change_amount', 'volume', 'turnover'];
        const existingFields = tableStructure.map(col => col.Field);
        
        console.log('\n市值相关字段检查:');
        marketValueFields.forEach(field => {
            if (existingFields.includes(field)) {
                console.log(`  ✅ ${field}: 已存在`);
            } else {
                console.log(`  ❌ ${field}: 缺失`);
            }
        });
        
        // 检查现有数据
        const [stockCount] = await connection.execute('SELECT COUNT(*) as count FROM stocks');
        console.log(`\n现有股票数量: ${stockCount[0].count}`);
        
        if (stockCount[0].count > 0) {
            // 检查第一条记录的市值字段值
            const [firstStock] = await connection.execute('SELECT code, name, total_market_value, circulating_market_value, current_price FROM stocks LIMIT 1');
            console.log('\n第一条股票记录:');
            console.log(`  代码: ${firstStock[0].code}`);
            console.log(`  名称: ${firstStock[0].name}`);
            console.log(`  总市值: ${firstStock[0].total_market_value}`);
            console.log(`  流通市值: ${firstStock[0].circulating_market_value}`);
            console.log(`  当前价格: ${firstStock[0].current_price}`);
            
            // 统计有多少股票有市值数据
            const [marketValueCount] = await connection.execute('SELECT COUNT(*) as count FROM stocks WHERE total_market_value > 0 OR circulating_market_value > 0 OR current_price > 0');
            console.log(`\n有市值数据的股票数量: ${marketValueCount[0].count}`);
        }
        
    } catch (error) {
        console.error('检查失败:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
        process.exit(0);
    }
}

checkDatabaseFields(); 