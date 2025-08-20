import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import CrawlerService from './services/CrawlerService.js';
import stockRoutes from './routes/stockRoutes.js';
import db from './config/database.js';

const app = express();
const PORT = process.env.PORT || 3000; // 后端使用3000端口

// CORS 配置 - 允许所有来源
app.use(cors({
  origin: true,  // 允许所有来源
  credentials: false,  // 关闭credentials
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api', stockRoutes);

// 首页
app.get('/', (req, res) => {
  res.json({
    message: 'A股股票信息爬虫系统',
    endpoints: {
      'GET /api/stocks': '获取所有股票列表',
      'GET /api/stocks/:code': '获取单只股票信息',
      'GET /api/stocks/:code/quote': '获取实时行情',
      'POST /api/crawl': '手动触发爬虫'
    }
  });
});

// 定时任务：每天开盘前更新股票列表
cron.schedule('0 8 * * 1-5', async () => {
  console.log('开始定时更新股票列表...');
  try {
    await CrawlerService.crawlStockList();
    console.log('定时更新完成');
  } catch (error) {
    console.error('定时更新失败:', error);
  }
});

// 启动服务器（等待数据库初始化完成）
async function startServer() {
  try {
    console.log('等待数据库连接...');
    
    // 等待数据库初始化完成，添加超时
    const getPoolPromise = db();
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('数据库连接超时')), 15000); // 15秒超时
    });
    
    const pool = await Promise.race([getPoolPromise, timeoutPromise]);
    console.log('数据库连接成功');
    
    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log('定时任务已启动，工作日每天早上8点更新股票列表');
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    console.error('错误详情:', {
      message: error.message,
      code: error.code,
      errno: error.errno
    });
    
    // 如果是数据库连接问题，给出具体建议
    if (error.code === 'ECONNREFUSED') {
      console.error('无法连接到MySQL服务器，请检查：');
      console.error('1. MySQL服务是否正在运行');
      console.error('2. 端口3306是否正确');
      console.error('3. 防火墙设置');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('MySQL访问被拒绝，请检查：');
      console.error('1. 用户名和密码是否正确');
      console.error('2. 用户是否有足够的权限');
    } else if (error.message === '数据库连接超时') {
      console.error('数据库连接超时，请检查：');
      console.error('1. MySQL服务是否响应缓慢');
      console.error('2. 网络连接是否正常');
    }
    
    process.exit(1);
  }
}

// 启动服务器
startServer();

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  process.exit(0);
}); 