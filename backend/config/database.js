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
                  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  INDEX idx_code (code),
                  INDEX idx_market (market),
                  INDEX idx_board (board)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);
          console.log('股票表创建成功');
        } else {
          console.log('股票表已存在，跳过创建');
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