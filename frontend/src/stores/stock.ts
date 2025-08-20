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
    filterByMarket
  }
})
