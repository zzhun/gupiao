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

// 获取主板小市值股票（市值小于1千亿）
app.get('/api/stocks/main-board-small-cap', async (req, res) => {
  try {
    const pool = await db();
    
    // 搜索主板股票，市值小于1000亿（1000000000000）
    // 使用CAST将字符串转换为DECIMAL进行比较
    const stocks = await pool.execute(`
      SELECT * FROM stocks 
      WHERE board = '主板' 
      AND CAST(total_market_value AS DECIMAL(20,2)) < 30000000000
      ORDER BY CAST(total_market_value AS DECIMAL(20,2)) DESC
    `);
    
    res.json({
      success: true,
      data: stocks,
      count: stocks.length
    });
  } catch (error) {
    console.error('获取主板小市值股票失败:', error);
    res.status(500).json({
      success: false,
      message: '获取主板小市值股票失败',
      error: error.message
    });
  }
});

// 获取股票日线数据
app.get('/api/stocks/:code/kline', async (req, res) => {
  try {
    const { code } = req.params;
    const { days = 10 } = req.query; // 默认获取10天数据
    
    const klineData = await CrawlerService.getDailyKLine(code, parseInt(days));
    
    res.json({
      success: true,
      data: klineData
    });
  } catch (error) {
    console.error(`获取股票 ${code} 日线数据失败:`, error);
    res.status(500).json({
      success: false,
      message: `获取股票 ${code} 日线数据失败`,
      error: error.message
    });
  }
});

// 批量获取股票日线数据（流式响应）
app.post('/api/stocks/batch-kline-stream', async (req, res) => {
  try {
    const { codes = [], days = 10, batchSize = 3, delay = 500 } = req.body;
    
    if (!codes.length) {
      return res.json({
        success: true,
        data: [],
        message: '没有提供股票代码'
      });
    }
    
    console.log(`开始流式批量获取 ${codes.length} 只股票的日线数据，批次大小: ${batchSize}，批次间延迟: ${delay}ms，同批次内请求间隔: 1-3秒随机`);
    
    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    let successCount = 0;
    let failCount = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 5;
    
    // 发送开始事件
    res.write(`data: ${JSON.stringify({
      type: 'start',
      message: `开始处理 ${codes.length} 只股票`,
      total: codes.length,
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // 分批处理
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(codes.length / batchSize);
      
      // 发送批次开始事件
      res.write(`data: ${JSON.stringify({
        type: 'batch_start',
        message: `开始处理批次 ${batchNumber}/${totalBatches}`,
        batchNumber,
        totalBatches,
        batchCodes: batch,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // 串行处理当前批次
      for (let j = 0; j < batch.length; j++) {
        const code = batch[j];
        const stockIndex = i + j + 1;
        
        try {
          // 发送处理开始事件
          res.write(`data: ${JSON.stringify({
            type: 'processing',
            message: `正在处理第 ${stockIndex}/${codes.length} 只股票: ${code}`,
            code,
            stockIndex,
            total: codes.length,
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          const klineData = await CrawlerService.getDailyKLine(code, parseInt(days));
          
          if (klineData && klineData.data) {
            successCount++;
            consecutiveFailures = 0;
            
            // 立即发送成功结果
            res.write(`data: ${JSON.stringify({
              type: 'success',
              message: `股票 ${code} 日线数据获取成功`,
              code,
              stockIndex,
              total: codes.length,
              successCount,
              failCount,
              data: klineData,
              timestamp: new Date().toISOString()
            })}\n\n`);
            
            console.log(`股票 ${code} 日线数据获取成功 (${stockIndex}/${codes.length})`);
          } else {
            failCount++;
            consecutiveFailures++;
            
            // 立即发送失败结果
            res.write(`data: ${JSON.stringify({
              type: 'error',
              message: `股票 ${code} 日线数据为空`,
              code,
              stockIndex,
              total: codes.length,
              successCount,
              failCount,
              error: 'K线数据为空或格式错误',
              timestamp: new Date().toISOString()
            })}\n\n`);
            
            console.log(`股票 ${code} 日线数据为空 (${stockIndex}/${codes.length})`);
          }
        } catch (error) {
          failCount++;
          consecutiveFailures++;
          
          // 立即发送错误结果
          res.write(`data: ${JSON.stringify({
            type: 'error',
            message: `获取股票 ${code} 日线数据失败`,
            code,
            stockIndex,
            total: codes.length,
            successCount,
            failCount,
            error: error.message,
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          console.error(`获取股票 ${code} 日线数据失败 (${stockIndex}/${codes.length}):`, error.message);
          
          // 连续失败过多时增加延迟
          if (consecutiveFailures >= maxConsecutiveFailures) {
            const extraDelay = Math.min(consecutiveFailures * 2000, 10000);
            console.log(`连续失败 ${consecutiveFailures} 次，额外延迟 ${extraDelay}ms 后继续...`);
            
            // 发送延迟事件
            res.write(`data: ${JSON.stringify({
              type: 'delay',
              message: `连续失败过多，延迟 ${extraDelay}ms 后继续`,
              delay: extraDelay,
              consecutiveFailures,
              timestamp: new Date().toISOString()
            })}\n\n`);
            
            await new Promise(resolve => setTimeout(resolve, extraDelay));
          }
        }
        
        // 同批次内延迟
        if (j < batch.length - 1) {
          const randomDelay = Math.floor(Math.random() * 2000) + 1000;
          console.log(`等待 ${randomDelay}ms 后处理下一只股票...`);
          
          // 发送延迟事件
          res.write(`data: ${JSON.stringify({
            type: 'delay',
            message: `等待 ${randomDelay}ms 后处理下一只股票`,
            delay: randomDelay,
            timestamp: new Date().toISOString()
          })}\n\n`);
          
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
      }
      
      // 发送批次完成事件
      res.write(`data: ${JSON.stringify({
        type: 'batch_complete',
        message: `批次 ${batchNumber}/${totalBatches} 完成`,
        batchNumber,
        totalBatches,
        successCount,
        failCount,
        timestamp: new Date().toISOString()
      })}\n\n`);
      
      // 批次间延迟
      if (i + batchSize < codes.length) {
        const successRate = successCount / (successCount + failCount);
        let dynamicDelay = delay;
        
        if (successRate < 0.8) {
          dynamicDelay = Math.min(delay * 2, 3000);
          console.log(`成功率较低 (${(successRate * 100).toFixed(1)}%)，增加延迟到 ${dynamicDelay}ms`);
        } else if (successRate > 0.95) {
          dynamicDelay = Math.max(delay * 0.8, 300);
          console.log(`成功率较高 (${(successRate * 100).toFixed(1)}%)，减少延迟到 ${dynamicDelay}ms`);
        }
        
        console.log(`批次 ${batchNumber} 完成，等待 ${dynamicDelay}ms 后处理下一批...`);
        
        // 发送延迟事件
        res.write(`data: ${JSON.stringify({
          type: 'delay',
          message: `批次 ${batchNumber} 完成，等待 ${dynamicDelay}ms 后处理下一批`,
          delay: dynamicDelay,
          batchNumber,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        await new Promise(resolve => setTimeout(resolve, dynamicDelay));
      }
      
      // 每10个批次休息
      if (batchNumber % 10 === 0) {
        const restTime = 10000;
        console.log(`已处理 ${batchNumber} 个批次，休息 ${restTime}ms 后继续...`);
        
        // 发送休息事件
        res.write(`data: ${JSON.stringify({
          type: 'rest',
          message: `已处理 ${batchNumber} 个批次，休息 ${restTime}ms 后继续`,
          restTime,
          batchNumber,
          timestamp: new Date().toISOString()
        })}\n\n`);
        
        await new Promise(resolve => setTimeout(resolve, restTime));
      }
    }
    
    // 发送完成事件
    const finalMessage = `批量获取日线数据完成: 成功 ${successCount} 只，失败 ${failCount} 只，成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`;
    console.log(finalMessage);
    
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      message: finalMessage,
      total: codes.length,
      successCount,
      failCount,
      successRate: (successCount / (successCount + failCount)) * 100,
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    res.end();
    
  } catch (error) {
    console.error('批量获取日线数据失败:', error);
    
    // 发送错误事件
    res.write(`data: ${JSON.stringify({
      type: 'error',
      message: '批量获取日线数据失败',
      error: error.message,
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    res.end();
  }
});

// 批量获取股票日线数据（原接口，作为备用）
app.post('/api/stocks/batch-kline', async (req, res) => {
  try {
    const { codes = [], days = 10, batchSize = 3, delay = 500 } = req.body;
    
    if (!codes.length) {
      return res.json({
        success: true,
        data: [],
        message: '没有提供股票代码'
      });
    }
    
    console.log(`开始批量获取 ${codes.length} 只股票的日线数据，批次大小: ${batchSize}，批次间延迟: ${delay}ms，同批次内请求间隔: 1-3秒随机`);
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let consecutiveFailures = 0; // 连续失败计数
    const maxConsecutiveFailures = 5; // 最大连续失败次数
    
    // 分批处理，避免同时发送过多请求
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(codes.length / batchSize)}: ${batch.join(',')}`);
      
      // 串行处理当前批次的日线数据，每次请求间隔1-3秒随机
      for (let j = 0; j < batch.length; j++) {
        const code = batch[j];
        console.log(`批次 ${Math.floor(i / batchSize) + 1} 中处理第 ${j + 1}/${batch.length} 只股票: ${code}`);
        
        try {
          const klineData = await CrawlerService.getDailyKLine(code, parseInt(days));
          
          if (klineData && klineData.data) {
            successCount++;
            consecutiveFailures = 0; // 重置连续失败计数
            results.push({
              code,
              success: true,
              data: klineData,
              error: null
            });
            console.log(`股票 ${code} 日线数据获取成功`);
          } else {
            failCount++;
            consecutiveFailures++;
            results.push({
              code,
              success: false,
              data: null,
              error: 'K线数据为空或格式错误'
            });
            console.log(`股票 ${code} 日线数据为空`);
          }
        } catch (error) {
          failCount++;
          consecutiveFailures++;
          console.error(`获取股票 ${code} 日线数据失败:`, error.message);
          results.push({
            code,
            success: false,
            data: null,
            error: error.message
          });
          
          // 如果连续失败次数过多，增加延迟并考虑暂停
          if (consecutiveFailures >= maxConsecutiveFailures) {
            const extraDelay = Math.min(consecutiveFailures * 2000, 10000); // 最多额外延迟10秒
            console.log(`连续失败 ${consecutiveFailures} 次，额外延迟 ${extraDelay}ms 后继续...`);
            await new Promise(resolve => setTimeout(resolve, extraDelay));
          }
        }
        
        // 同批次内，如果不是最后一只股票，等待1-3秒随机时间再请求下一只
        if (j < batch.length - 1) {
          const randomDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3秒随机延迟
          console.log(`等待 ${randomDelay}ms 后处理下一只股票...`);
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
      }
      
      // 如果不是最后一批，添加批次间延迟
      if (i + batchSize < codes.length) {
        // 根据当前成功率动态调整延迟
        const successRate = successCount / (successCount + failCount);
        let dynamicDelay = delay;
        
        if (successRate < 0.8) {
          // 成功率低于80%，增加延迟
          dynamicDelay = Math.min(delay * 2, 3000);
          console.log(`成功率较低 (${(successRate * 100).toFixed(1)}%)，增加延迟到 ${dynamicDelay}ms`);
        } else if (successRate > 0.95) {
          // 成功率高于95%，适当减少延迟
          dynamicDelay = Math.max(delay * 0.8, 300);
          console.log(`成功率较高 (${(successRate * 100).toFixed(1)}%)，减少延迟到 ${dynamicDelay}ms`);
        }
        
        console.log(`批次 ${Math.floor(i / batchSize) + 1} 完成，等待 ${dynamicDelay}ms 后处理下一批...`);
        await new Promise(resolve => setTimeout(resolve, dynamicDelay));
      }
      
      // 每处理10个批次，添加一个较长的休息时间
      if ((i / batchSize + 1) % 10 === 0) {
        const restTime = 10000; // 10秒休息
        console.log(`已处理 ${Math.floor(i / batchSize + 1)} 个批次，休息 ${restTime}ms 后继续...`);
        await new Promise(resolve => setTimeout(resolve, restTime));
      }
    }
    
    console.log(`批量获取日线数据完成: 成功 ${successCount} 只，失败 ${failCount} 只，成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);
    
    res.json({
      success: true,
      data: {
        total: codes.length,
        successCount,
        failCount,
        successRate: (successCount / (successCount + failCount)) * 100,
        results
      },
      message: `批量获取完成：成功 ${successCount} 只，失败 ${failCount} 只，成功率: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`
    });
    
  } catch (error) {
    console.error('批量获取日线数据失败:', error);
    res.status(500).json({
      success: false,
      message: '批量获取日线数据失败',
      error: error.message
    });
  }
});

// 筛选近10天内有过涨停的股票
app.post('/api/stocks/filter-limit-up', async (req, res) => {
  try {
    const { stockCodes = [] } = req.body;
    
    if (!stockCodes.length) {
      return res.json({
        success: true,
        data: [],
        message: '没有提供股票代码'
      });
    }
    
    console.log(`开始筛选 ${stockCodes.length} 只股票的涨停情况...`);
    
    const limitUpStocks = [];
    const batchSize = 3; // 减少批次大小，降低风险
    const delay = 500;   // 增加批次间延迟
    
    let consecutiveFailures = 0; // 连续失败计数
    const maxConsecutiveFailures = 3; // 最大连续失败次数
    
    // 分批处理，避免同时发送过多请求
    for (let i = 0; i < stockCodes.length; i += batchSize) {
      const batch = stockCodes.slice(i, i + batchSize);
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(stockCodes.length / batchSize)}: ${batch.join(',')}`);
      
      // 串行处理当前批次的日线数据，每次请求间隔1-3秒随机
      for (let j = 0; j < batch.length; j++) {
        const code = batch[j];
        console.log(`批次 ${Math.floor(i / batchSize) + 1} 中处理第 ${j + 1}/${batch.length} 只股票: ${code}`);
        
        try {
          const klineData = await CrawlerService.getDailyKLine(code, 10);
          
          if (klineData && klineData.data && klineData.data.klines) {
            consecutiveFailures = 0; // 重置连续失败计数
            const klines = klineData.data.klines;
            
            // 检查近10天内是否有涨停
            for (let k = 0; k < Math.min(klines.length, 10); k++) {
              const kline = klines[k];
              const changePercent = parseFloat(kline[8]); // 涨跌幅
              
              // 涨停判断：涨跌幅 >= 9.8%
              if (changePercent >= 9.8) {
                limitUpStocks.push({
                  code,
                  limitUpDate: kline[0], // 涨停日期
                  changePercent,
                  closePrice: kline[2], // 收盘价
                  volume: kline[5], // 成交量
                  turnover: kline[6] // 成交额
                });
                console.log(`股票 ${code} 发现涨停，日期: ${kline[0]}, 涨跌幅: ${changePercent}%`);
                break; // 找到涨停就跳出，避免重复
              }
            }
          }
        } catch (error) {
          consecutiveFailures++;
          console.error(`获取股票 ${code} 日线数据失败:`, error.message);
          
          // 如果连续失败次数过多，增加延迟并考虑暂停
          if (consecutiveFailures >= maxConsecutiveFailures) {
            const extraDelay = Math.min(consecutiveFailures * 3000, 15000); // 最多额外延迟15秒
            console.log(`连续失败 ${consecutiveFailures} 次，额外延迟 ${extraDelay}ms 后继续...`);
            await new Promise(resolve => setTimeout(resolve, extraDelay));
          }
        }
        
        // 同批次内，如果不是最后一只股票，等待1-3秒随机时间再请求下一只
        if (j < batch.length - 1) {
          const randomDelay = Math.floor(Math.random() * 2000) + 1000; // 1-3秒随机延迟
          console.log(`等待 ${randomDelay}ms 后处理下一只股票...`);
          await new Promise(resolve => setTimeout(resolve, randomDelay));
        }
      }
      
      console.log(`批次 ${Math.floor(i / batchSize) + 1} 完成，当前找到 ${limitUpStocks.length} 只涨停股票`);
      
      // 如果不是最后一批，添加批次间延迟
      if (i + batchSize < stockCodes.length) {
        console.log(`等待 ${delay}ms 后处理下一批...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      // 每处理5个批次，添加一个较长的休息时间
      if ((i / batchSize + 1) % 5 === 0) {
        const restTime = 8000; // 8秒休息
        console.log(`已处理 ${Math.floor(i / batchSize + 1)} 个批次，休息 ${restTime}ms 后继续...`);
        await new Promise(resolve => setTimeout(resolve, restTime));
      }
    }
    
    console.log(`涨停筛选完成，总共找到 ${limitUpStocks.length} 只涨停股票`);
    
    res.json({
      success: true,
      data: limitUpStocks,
      count: limitUpStocks.length,
      message: `筛选完成，找到 ${limitUpStocks.length} 只近10天内有过涨停的股票`
    });
    
  } catch (error) {
    console.error('筛选涨停股票失败:', error);
    res.status(500).json({
      success: false,
      message: '筛选涨停股票失败',
      error: error.message
    });
  }
});

// 同步指定股票的数据
app.post('/api/stocks/sync-by-codes', async (req, res) => {
  try {
    const { codes = [], batchSize = 10 } = req.body;
    
    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供股票代码数组'
      });
    }
    
    // 过滤掉名字包含"退市"或以"退"字结尾的股票
    const pool = await db();
    const [stocks] = await pool.execute(`
      SELECT code, name FROM stocks 
      WHERE code IN (${codes.map(() => '?').join(',')})
    `, codes);
    
    // 过滤掉退市股票和以"退"字结尾的股票
    const validStocks = stocks.filter(stock => {
      const name = stock.name
      // 过滤掉名字包含"退市"或以"退"字结尾的股票
      return !name.includes('退市') && !name.endsWith('退')
    });
    
    const delistedStocks = stocks.filter(stock => {
      const name = stock.name
      return name.includes('退市') || name.endsWith('退')
    });
    
    if (validStocks.length === 0) {
      return res.json({
        success: true,
        message: '所有选中的股票都是退市股票，无需同步',
        data: {
          total: codes.length,
          validCount: 0,
          delistedCount: delistedStocks.length,
          successCount: 0,
          failCount: 0,
          results: [],
          delistedCodes: delistedStocks.map(s => s.code),
          delistedNames: delistedStocks.map(s => s.name)
        }
      });
    }
    
    console.log(`开始同步 ${validStocks.length} 只有效股票的数据...`);
    if (delistedStocks.length > 0) {
      console.log(`跳过 ${delistedStocks.length} 只退市股票:`, delistedStocks.map(s => `${s.code}(${s.name})`));
    }
    
    let successCount = 0;
    let failCount = 0;
    const results = [];
    
    // 分批处理有效的股票代码
    for (let i = 0; i < validStocks.length; i += batchSize) {
      const batch = validStocks.slice(i, i + batchSize);
      console.log(`处理第 ${Math.floor(i / batchSize) + 1} 批，包含 ${batch.length} 只股票`);
      
      // 并行处理当前批次的股票
      const batchPromises = batch.map(async (stock) => {
        try {
          // 获取实时数据
          const realTimeData = await CrawlerService.getRealTimeData(stock.code);

          console.log(realTimeData)
          
          if (!realTimeData) {
            throw new Error('无法获取实时数据');
          }
          
          // 更新数据库中的市值等信息
          await pool.execute(`
            UPDATE stocks 
            SET 
              current_price = ?,
              change_percentage = ?,
              change_amount = ?,
              volume = ?,
              turnover = ?,
              total_market_value = ?,
              circulating_market_value = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE code = ?
          `, [
            realTimeData.f43 || 0,  // 当前价格
            realTimeData.f169 || 0, // 涨跌幅
            realTimeData.f170 || 0, // 涨跌额
            realTimeData.f47 || 0,  // 成交量
            realTimeData.f48 || 0,  // 成交额
            realTimeData.totalMarketValue || 0,     // 总市值
            realTimeData.circulatingMarketValue || 0, // 流通市值
            stock.code
          ]);
          
          successCount++;
          return {
            code: stock.code,
            name: stock.name,
            success: true,
            data: realTimeData
          };
          
        } catch (error) {
          failCount++;
          console.error(`同步股票 ${stock.code} 失败:`, error.message);
          return {
            code: stock.code,
            name: stock.name,
            success: false,
            error: error.message
          };
        }
      });
      
      // 等待当前批次完成
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 批次间延迟，避免请求过快
      if (i + batchSize < validStocks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`同步完成：成功 ${successCount} 只，失败 ${failCount} 只`);
    
    res.json({
      success: true,
      message: `同步完成：成功 ${successCount} 只，失败 ${failCount} 只，跳过 ${delistedStocks.length} 只退市股票`,
      data: {
        total: codes.length,
        validCount: validStocks.length,
        delistedCount: delistedStocks.length,
        successCount,
        failCount,
        results: results,
        delistedCodes: delistedStocks.map(s => s.code),
        delistedNames: delistedStocks.map(s => s.name)
      }
    });
    
  } catch (error) {
    console.error('同步股票数据失败:', error);
    res.status(500).json({
      success: false,
      message: '同步股票数据失败',
      error: error.message
    });
  }
});

// 获取反爬虫配置建议
app.get('/api/config/anti-crawler', (req, res) => {
  const { totalStocks } = req.query;
  const stockCount = parseInt(totalStocks) || 1000;
  
  let config = {
    batchSize: 3,
    delay: 800,
    maxRetries: 3,
    estimatedTime: 0,
    riskLevel: 'low'
  };
  
  // 根据股票数量动态调整配置
  if (stockCount <= 100) {
    config.batchSize = 5;
    config.delay = 500;
    config.riskLevel = 'very-low';
  } else if (stockCount <= 500) {
    config.batchSize = 4;
    config.delay = 600;
    config.riskLevel = 'low';
  } else if (stockCount <= 1000) {
    config.batchSize = 3;
    config.delay = 800;
    config.riskLevel = 'medium';
  } else if (stockCount <= 2000) {
    config.batchSize = 2;
    config.delay = 1000;
    config.riskLevel = 'high';
  } else {
    config.batchSize = 1;
    config.delay = 1500;
    config.riskLevel = 'very-high';
  }
  
  // 估算总时间（秒）
  const batches = Math.ceil(stockCount / config.batchSize);
  const batchTime = config.batchSize * 2; // 每只股票平均2秒
  const delayTime = (batches - 1) * (config.delay / 1000); // 批次间延迟
  const restTime = Math.floor(batches / 10) * 10; // 每10批休息10秒
  config.estimatedTime = Math.round(batchTime + delayTime + restTime);
  
  res.json({
    success: true,
    data: {
      ...config,
      totalStocks: stockCount,
      totalBatches: batches,
      recommendations: {
        'very-low': '可以适当增加批次大小，减少延迟',
        'low': '当前配置较为安全，可以继续使用',
        'medium': '建议分批处理，避免一次性处理过多',
        'high': '建议降低批次大小，增加延迟',
        'very-high': '建议分多次处理，每次处理少量股票'
      }
    }
  });
});

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