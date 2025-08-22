import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import type { Stock, BoardStatistics } from '@/types/stock'

export const useStockStore = defineStore('stock', () => {
  // 状态
  const stocks = ref<Stock[]>([])
  const boardStatistics = ref<BoardStatistics[]>([])
  const loading = ref(false)

  // 计算属性
  const totalCount = computed(() => stocks.value.length)

  const stocksByBoard = computed(() => {
    const grouped: Record<string, Stock[]> = {}
    stocks.value.forEach((stock) => {
      if (!grouped[stock.board]) {
        grouped[stock.board] = []
      }
      grouped[stock.board].push(stock)
    })
    return grouped
  })

  // 方法
  const fetchStocks = async () => {
    try {
      loading.value = true
      const response = await axios.get('http://localhost:3000/api/stocks')
      if (response.data.success) {
        stocks.value = response.data.data
        await fetchBoardStatistics()
      }
    } catch (error) {
      console.error('获取股票列表失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  const fetchBoardStatistics = async () => {
    try {
      const response = await axios.get('http://localhost:3000/api/stocks/statistics')
      if (response.data.success) {
        boardStatistics.value = response.data.data
      }
    } catch (error) {
      console.error('获取板块统计失败:', error)
    }
  }

  const getStockByCode = (code: string) => {
    return stocks.value.find((stock) => stock.code === code)
  }

  const getRealTimeQuote = async (code: string) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/stocks/${code}/quote`)
      if (response.data.success) {
        return response.data.data
      }
    } catch (error) {
      console.error('获取实时行情失败:', error)
      throw error
    }
  }

  const searchStocks = (query: string) => {
    if (!query) return stocks.value

    const lowerQuery = query.toLowerCase()
    return stocks.value.filter(
      (stock) =>
        stock.code.toLowerCase().includes(lowerQuery) ||
        stock.name.toLowerCase().includes(lowerQuery)
    )
  }

  const filterByBoard = (board: string) => {
    if (!board) return stocks.value
    return stocks.value.filter((stock) => stock.board === board)
  }

  const filterByMarket = (market: string) => {
    if (!market) return stocks.value
    return stocks.value.filter((stock) => stock.market === market)
  }

  // 获取主板小市值股票（市值小于1千亿）
  const fetchMainBoardSmallCap = async () => {
    try {
      loading.value = true
      const response = await axios.get('http://localhost:3000/api/stocks/main-board-small-cap')
      if (response.data.success) {
        return response.data.data
      }
    } catch (error) {
      console.error('获取主板小市值股票失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 筛选近10天内有过涨停的股票
  const filterLimitUpStocks = async (stockCodes: string[]) => {
    try {
      loading.value = true
      const response = await axios.post('http://localhost:3000/api/stocks/filter-limit-up', {
        stockCodes
      })
      if (response.data.success) {
        return response.data.data
      }
    } catch (error) {
      console.error('筛选涨停股票失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 同步指定股票的数据
  const syncStocksByCodes = async (codes: string[], batchSize = 10) => {
    try {
      loading.value = true
      const response = await axios.post('http://localhost:3000/api/stocks/sync-by-codes', {
        codes,
        batchSize
      })
      if (response.data.success) {
        // 同步完成后重新获取股票列表
        await fetchStocks()
        return response.data.data
      }
    } catch (error) {
      console.error('同步股票数据失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 批量获取日线数据
  const fetchKLineData = async (codes: string[], days = 10) => {
    try {
      loading.value = true

      console.log(`开始批量获取 ${codes.length} 只股票的日线数据...`)

      // 使用新的批量接口
      const response = await axios.post('http://localhost:3000/api/stocks/batch-kline', {
        codes,
        days,
        batchSize: 3, // 每批3只股票（降低风险）
        delay: 800 // 批次间延迟800ms（增加延迟）
      })

      if (response.data.success) {
        const result = response.data.data
        console.log(
          `批量获取完成: 成功 ${result.successCount} 只，失败 ${result.failCount} 只，成功率: ${result.successRate.toFixed(1)}%`
        )

        return {
          successCount: result.successCount,
          failCount: result.failCount,
          failCodes: result.results
            .filter((item: any) => !item.success)
            .map((item: any) => item.code),
          results: result.results
        }
      } else {
        throw new Error(response.data.message || '批量获取日线数据失败')
      }
    } catch (error: any) {
      console.error('批量获取日线数据失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 流式获取日线数据（实时更新）
  const fetchKLineDataStream = async (
    codes: string[],
    days = 10,
    onProgress?: (event: any) => void,
    onComplete?: (result: any) => void
  ) => {
    try {
      loading.value = true
      console.log(`开始流式获取 ${codes.length} 只股票的日线数据...`)

      // 使用POST请求，避免URL过长问题
      const response = await fetch('http://localhost:3000/api/stocks/batch-kline-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          codes,
          days,
          batchSize: 3,
          delay: 800
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const results: any[] = []
      let successCount = 0
      let failCount = 0

      // 创建ReadableStream读取器
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法创建流读取器')
      }

      const decoder = new TextDecoder()
      let buffer = ''

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          // 解码数据并添加到缓冲区
          buffer += decoder.decode(value, { stream: true })

          // 处理缓冲区中的完整行
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留不完整的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) // 移除 'data: ' 前缀
                console.log('收到流式数据:', data)

                // 根据事件类型处理
                switch (data.type) {
                  case 'start':
                    console.log(`开始处理 ${data.total} 只股票`)
                    onProgress?.(data)
                    break

                  case 'batch_start':
                    console.log(`开始处理批次 ${data.batchNumber}/${data.totalBatches}`)
                    onProgress?.(data)
                    break

                  case 'processing':
                    console.log(`正在处理第 ${data.stockIndex}/${data.total} 只股票: ${data.code}`)
                    onProgress?.(data)
                    break

                  case 'success':
                    successCount++
                    results.push({
                      code: data.code,
                      success: true,
                      data: data.data,
                      error: null
                    })
                    console.log(
                      `股票 ${data.code} 日线数据获取成功 (${data.stockIndex}/${data.total})`
                    )
                    onProgress?.(data)
                    break

                  case 'error':
                    failCount++
                    results.push({
                      code: data.code,
                      success: false,
                      data: null,
                      error: data.error
                    })
                    console.log(
                      `股票 ${data.code} 日线数据获取失败 (${data.stockIndex}/${data.total}): ${data.error}`
                    )
                    onProgress?.(data)
                    break

                  case 'batch_complete':
                    console.log(
                      `批次 ${data.batchNumber}/${data.totalBatches} 完成，当前成功: ${data.successCount}，失败: ${data.failCount}`
                    )
                    onProgress?.(data)
                    break

                  case 'delay':
                    console.log(`延迟 ${data.delay}ms: ${data.message}`)
                    onProgress?.(data)
                    break

                  case 'rest':
                    console.log(`休息 ${data.restTime}ms: ${data.message}`)
                    onProgress?.(data)
                    break

                  case 'complete':
                    console.log(
                      `流式获取完成: 成功 ${data.successCount} 只，失败 ${data.failCount} 只，成功率: ${data.successRate.toFixed(1)}%`
                    )
                    onProgress?.(data)

                    const finalResult = {
                      successCount: data.successCount,
                      failCount: data.failCount,
                      successRate: data.successRate,
                      failCodes: results
                        .filter((item: any) => !item.success)
                        .map((item: any) => item.code),
                      results: results
                    }

                    onComplete?.(finalResult)
                    loading.value = false
                    return finalResult

                  default:
                    console.log('未知事件类型:', data.type)
                    onProgress?.(data)
                }
              } catch (parseError) {
                console.error('解析流式数据失败:', parseError, '原始数据:', line)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }

      // 如果没有收到complete事件，抛出错误
      throw new Error('流式连接意外中断')
    } catch (error: any) {
      console.error('流式获取日线数据失败:', error)
      loading.value = false
      throw error
    }
  }

  return {
    // 状态
    stocks,
    boardStatistics,
    loading,

    // 计算属性
    totalCount,
    stocksByBoard,

    // 方法
    fetchStocks,
    fetchBoardStatistics,
    getStockByCode,
    getRealTimeQuote,
    searchStocks,
    filterByBoard,
    filterByMarket,
    fetchMainBoardSmallCap,
    filterLimitUpStocks,
    syncStocksByCodes,
    fetchKLineData,
    fetchKLineDataStream
  }
})
