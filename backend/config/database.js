import mysql from 'mysql2/promise';

let pool = null; // 延迟初始化连接池
let initPromise = null; // 初始化Promise

// 初始化数据库和表
async function initDatabase() {
    try {
        console.log('开始初始化数据库...');
        
        // 先创建一个不指定数据库的连接
        const tempPool = mysql.createPool({
            host: 'localhost',
            user: 'zz',
            password: '123456',
            port: 3306,
            charset: 'utf8mb4',
            connectTimeout: 10000
        });
        
        console.log('尝试连接MySQL服务器...');
        const connection = await tempPool.getConnection();
        console.log('MySQL服务器连接成功');
        
        // 创建数据库（如果不存在）
        console.log('创建数据库 gupiao_db...');
        await connection.query('CREATE DATABASE IF NOT EXISTS gupiao_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        console.log('数据库创建/确认成功');
        
        // 使用数据库
        await connection.query('USE gupiao_db');
        
        // 检查表是否存在，如果不存在才创建
        console.log('检查股票表是否存在...');
        const [tables] = await connection.query("SHOW TABLES LIKE 'stocks'");
        
        if (tables.length === 0) {
          console.log('股票表不存在，开始创建...');
          // 创建新的股票表（包含 board 字段）
          await connection.query(`
              CREATE TABLE stocks (
                  id INT AUTO_INCREMENT PRIMARY KEY,
                  code VARCHAR(10) UNIQUE NOT NULL,
                  name VARCHAR(100) NOT NULL,
                  market VARCHAR(20) NOT NULL,
                  board VARCHAR(20) NOT NULL,
                  industry VARCHAR(100),
                  total_market_value DECIMAL(15,2) DEFAULT 0 COMMENT '总市值(亿元)',
                  circulating_market_value DECIMAL(15,2) DEFAULT 0 COMMENT '流通市值(亿元)',
                  current_price DECIMAL(10,4) DEFAULT 0 COMMENT '当前价格',
                  change_percentage DECIMAL(8,4) DEFAULT 0 COMMENT '涨跌幅(%)',
                  change_amount DECIMAL(10,4) DEFAULT 0 COMMENT '涨跌额',
                  volume BIGINT DEFAULT 0 COMMENT '成交量',
                  turnover DECIMAL(20,2) DEFAULT 0 COMMENT '成交额(万元)',
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX idx_code (code),
                  INDEX idx_market (market),
                  INDEX idx_board (board),
                  INDEX idx_total_market_value (total_market_value),
                  INDEX idx_circulating_market_value (circulating_market_value)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('股票表创建成功');
        } else {
          console.log('股票表已存在，检查是否需要添加市值字段...');
          
          // 检查并添加缺失的市值字段
          const [columns] = await connection.query(`
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = 'gupiao_db' 
              AND TABLE_NAME = 'stocks' 
              AND COLUMN_NAME IN ('total_market_value', 'circulating_market_value', 'current_price', 'change_percentage', 'change_amount', 'volume', 'turnover')
          `);
          
          const existingColumns = columns.map(col => col.COLUMN_NAME);
          console.log('已存在的市值字段:', existingColumns);
          
          // 需要添加的字段
          const columnsToAdd = [
              { name: 'total_market_value', definition: 'DECIMAL(15,2) DEFAULT 0 COMMENT "总市值(亿元)"' },
              { name: 'circulating_market_value', definition: 'DECIMAL(15,2) DEFAULT 0 COMMENT "流通市值(亿元)"' },
              { name: 'current_price', definition: 'DECIMAL(10,4) DEFAULT 0 COMMENT "当前价格"' },
              { name: 'change_percentage', definition: 'DECIMAL(8,4) DEFAULT 0 COMMENT "涨跌幅(%)"' },
              { name: 'change_amount', definition: 'DECIMAL(10,4) DEFAULT 0 COMMENT "涨跌额"' },
              { name: 'volume', definition: 'BIGINT DEFAULT 0 COMMENT "成交量"' },
              { name: 'turnover', definition: 'DECIMAL(20,2) DEFAULT 0 COMMENT "成交额(万元)"' }
          ];
          
          for (const column of columnsToAdd) {
              if (!existingColumns.includes(column.name)) {
                  console.log(`添加字段: ${column.name}`);
                  await connection.query(`ALTER TABLE stocks ADD COLUMN ${column.name} ${column.definition}`);
                  console.log(`字段 ${column.name} 添加成功`);
              } else {
                  console.log(`字段 ${column.name} 已存在，跳过`);
              }
          }
          
          // 检查并添加索引
          try {
              await connection.query('ALTER TABLE stocks ADD INDEX idx_total_market_value (total_market_value)');
              console.log('总市值索引添加成功');
          } catch (error) {
              if (error.code === 'ER_DUP_KEYNAME') {
                  console.log('总市值索引已存在');
              } else {
                  console.log('添加总市值索引失败:', error.message);
              }
          }
          
          try {
              await connection.query('ALTER TABLE stocks ADD INDEX idx_circulating_market_value (circulating_market_value)');
              console.log('流通市值索引添加成功');
          } catch (error) {
              if (error.code === 'ER_DUP_KEYNAME') {
                  console.log('流通市值索引已存在');
              } else {
                  console.log('添加流通市值索引失败:', error.message);
              }
          }
        }
        
        // 关闭临时连接
        connection.release();
        await tempPool.end();
        
        // 现在创建主连接池
        console.log('创建主连接池...');
        pool = mysql.createPool({
            host: 'localhost',
            user: 'zz',
            password: '123456',
            port: 3306,
            charset: 'utf8mb4',
            database: 'gupiao_db',
            connectTimeout: 10000,
            connectionLimit: 10
        });
        
        // 测试主连接池
        console.log('测试主连接池...');
        const testConnection = await pool.getConnection();
        console.log('主连接池测试成功');
        testConnection.release();
        
        console.log('MySQL 数据库初始化成功，表结构已更新');
    } catch (error) {
        console.error('MySQL 数据库初始化失败:', error);
        console.error('错误详情:', {
            code: error.code,
            errno: error.errno,
            sqlState: error.sqlState,
            sqlMessage: error.sqlMessage
        });
        throw error;
    }
}

// 获取连接池的函数
async function getPool() {
    if (!pool) {
        if (!initPromise) {
            initPromise = initDatabase();
        }
        await initPromise;
    }
    return pool;
}

// 开始初始化数据库
initPromise = initDatabase();

export default getPool; 