<template>
  <div class="stock-list">
    <!-- 搜索和筛选区域 -->
    <div class="search-filter-section">
      <el-card class="filter-card">
        <div class="filter-row">
          <!-- 搜索框 -->
          <div class="search-box">
            <el-input
              v-model="searchQuery"
              placeholder="搜索股票代码或名称"
              clearable
              @input="handleSearch"
              class="search-input"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>

          <!-- 板块筛选 -->
          <div class="board-filter">
            <el-select
              v-model="selectedBoard"
              placeholder="选择板块"
              clearable
              @change="handleBoardFilter"
              class="board-select"
            >
              <el-option
                v-for="board in boardOptions"
                :key="board.value"
                :label="board.label"
                :value="board.value"
              />
            </el-select>
          </div>

          <!-- 市场筛选 -->
          <div class="market-filter">
            <el-select
              v-model="selectedMarket"
              placeholder="选择市场"
              clearable
              @change="handleMarketFilter"
              class="market-select"
            >
              <el-option
                v-for="market in marketOptions"
                :key="market.label"
                :label="market.label"
                :value="market.value"
              />
            </el-select>
          </div>

          <!-- 同步数据按钮 -->
          <el-button
            type="success"
            @click="syncData"
            :loading="syncing"
            :disabled="syncing"
            class="sync-btn"
          >
            <el-icon><Refresh /></el-icon>
            {{ syncing ? '同步中...' : '同步数据' }}
          </el-button>

          <!-- 刷新按钮 -->
          <el-button
            type="primary"
            @click="refreshData"
            :loading="loading"
            class="refresh-btn"
          >
            <el-icon><Refresh /></el-icon>
            刷新列表
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 同步进度显示 -->
    <div v-if="syncing" class="sync-progress-section">
      <el-card class="progress-card">
        <div class="progress-content">
          <div class="progress-header">
            <h3>正在同步股票数据...</h3>
            <el-progress 
              :percentage="syncProgress.percentage" 
              :status="syncProgress.status"
              :stroke-width="8"
            />
          </div>
          <!-- 修改进度显示部分 -->
          <div class="progress-details">
            <div class="progress-item">
              <span class="label">当前页数:</span>
              <span class="value">{{ syncProgress.currentPage }}</span>
            </div>
            <div class="progress-item">
              <span class="label">已爬取:</span>
              <span class="value">{{ syncProgress.totalCount }} 只股票</span>
            </div>
            <div class="progress-item">
              <span class="label">状态:</span>
              <span class="value" :class="getStatusClass(syncProgress.status)">
                {{ getStatusText(syncProgress.status) }}
              </span>
            </div>
          </div>
          <div class="progress-log">
            <div class="log-header">
              <span>同步日志</span>
              <el-button size="small" @click="clearLog">清空日志</el-button>
            </div>
            <div class="log-content">
              <div 
                v-for="(log, index) in syncProgress.logs" 
                :key="index"
                class="log-item"
                :class="getLogLevelClass(log.level)"
              >
                <span class="log-time">{{ log.time }}</span>
                <span class="log-message">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 统计信息 -->
    <div class="statistics-section">
      <el-row :gutter="20">
        <el-col :span="4" v-for="stat in statistics" :key="stat.label">
          <el-card class="stat-card">
            <div class="stat-content">
              <div class="stat-number">{{ stat.count }}</div>
              <div class="stat-label">{{ stat.label }}</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- 添加调试信息 -->
      <el-card style="margin-top: 20px;">
        <h4>调试信息：</h4>
        <p>总股票数: {{ stockStore.stocks.length }}</p>
        <p>板块统计: {{ JSON.stringify(stockStore.boardStatistics) }}</p>
        <p>计算后的统计: {{ JSON.stringify(statistics) }}</p>
      </el-card>
    </div>

    <!-- 股票列表 -->
    <div class="stock-table-section">
      <el-card>
        <template #header>
          <div class="table-header">
            <span>股票列表 ({{ filteredStocks.length }})</span>
            <el-button
              type="success"
              size="small"
              @click="exportToCSV"
              :disabled="filteredStocks.length === 0"
            >
              导出CSV
            </el-button>
          </div>
        </template>

        <el-table
          :data="paginatedStocks"
          v-loading="loading"
          stripe
          border
          class="stock-table"
          @row-click="handleRowClick"
        >
          <el-table-column prop="code" label="代码" width="100" sortable>
            <template #default="{ row }">
              <span class="stock-code" :class="getStockCodeClass(row.code)">
                {{ row.code }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="name" label="名称" width="150" sortable>
            <template #default="{ row }">
              <span class="stock-name">{{ row.name }}</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="market" label="市场" width="100" sortable>
            <template #default="{ row }">
              <el-tag :type="getMarketTagType(row.market)" size="small">
                {{ row.market }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="board" label="板块" width="120" sortable>
            <template #default="{ row }">
              <el-tag :type="getBoardTagType(row.board)" size="small">
                {{ row.board }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="industry" label="行业" min-width="150" sortable>
            <template #default="{ row }">
              <span class="industry-text">{{ row.industry }}</span>
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click.stop="viewDetail(row)"
              >
                查看详情
              </el-button>
              <el-button
                type="success"
                size="small"
                @click.stop="viewQuote(row)"
              >
                实时行情
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-wrapper">
          <el-pagination
            :current-page="currentPage"
            :page-size="pageSize"
            :page-sizes="[20, 50, 100, 200]"
            :total="filteredStocks.length"
            layout="total, sizes, prev, pager, next, jumper"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </el-card>
    </div>

    <!-- 股票详情对话框 -->
    <el-dialog
      v-model="detailDialogVisible"
      title="股票详情"
      width="800px"
      :before-close="handleDetailDialogClose"
    >
      <div v-if="selectedStock" class="stock-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="股票代码">
            {{ selectedStock.code }}
          </el-descriptions-item>
          <el-descriptions-item label="股票名称">
            {{ selectedStock.name }}
          </el-descriptions-item>
          <el-descriptions-item label="市场">
            {{ selectedStock.market }}
          </el-descriptions-item>
          <el-descriptions-item label="板块">
            {{ selectedStock.board }}
          </el-descriptions-item>
          <el-descriptions-item label="行业">
            {{ selectedStock.industry }}
          </el-descriptions-item>
          <el-descriptions-item label="更新时间">
            {{ formatDate(selectedStock.updated_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>

    <!-- 实时行情对话框 -->
    <el-dialog
      v-model="quoteDialogVisible"
      title="实时行情"
      width="800px"
      :before-close="handleQuoteDialogClose"
    >
      <div v-if="selectedStockQuote" class="stock-quote">
        <!-- 添加调试信息 -->
        <div class="debug-info" style="margin-bottom: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
          <h4>调试信息：</h4>
          <pre>{{ JSON.stringify(selectedStockQuote, null, 2) }}</pre>
        </div>
        
        <el-descriptions :column="2" border>
          <el-descriptions-item label="股票代码">
            {{ selectedStockQuote.code }}
          </el-descriptions-item>
          <el-descriptions-item label="股票名称">
            {{ selectedStockQuote.name }}
          </el-descriptions-item>
          <el-descriptions-item label="当前价格">
            <span class="price-text">
              {{ selectedStockQuote.realTimeData?.f43 || '--' }}
              <small v-if="selectedStockQuote.realTimeData?.f43">(原始值: {{ selectedStockQuote.realTimeData.f43 }})</small>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="涨跌幅">
            <span class="change-text" :class="getChangeClass(selectedStockQuote.realTimeData?.f170)">
              {{ formatChange(selectedStockQuote.realTimeData?.f170) }}
              <small v-if="selectedStockQuote.realTimeData?.f170">(原始值: {{ selectedStockQuote.realTimeData.f170 }})</small>
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="成交量">
            {{ formatVolume(selectedStockQuote.realTimeData?.f47) }}
            <small v-if="selectedStockQuote.realTimeData?.f47">(原始值: {{ selectedStockQuote.realTimeData.f47 }})</small>
          </el-descriptions-item>
          <el-descriptions-item label="成交额">
            {{ formatAmount(selectedStockQuote.realTimeData?.f48) }}
            <small v-if="selectedStockQuote.realTimeData?.f48">(原始值: {{ selectedStockQuote.realTimeData.f48 }})</small>
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useStockStore } from '@/stores/stock'
import type { Stock } from '@/types/stock'

// 状态管理
const stockStore = useStockStore()

// 响应式数据
const loading = ref(false)
const syncing = ref(false)
const searchQuery = ref('')
const selectedBoard = ref('')
const selectedMarket = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const detailDialogVisible = ref(false)
const quoteDialogVisible = ref(false)
const selectedStock = ref<Stock | null>(null)
const selectedStockQuote = ref<any>(null)

// 同步进度状态
const syncProgress = ref({
  percentage: 0,
  status: 'active',
  currentPage: 0,
  totalCount: 0,
  logs: [] as Array<{time: string, message: string, level: string}>
})

// 板块选项
const boardOptions = [
  { label: '主板', value: '主板' },
  { label: '创业板', value: '创业板' },
  { label: '科创板', value: '科创板' },
  { label: '北交所', value: '北交所' },
  { label: 'ST板', value: 'ST板' },
  { label: '三板', value: '三板' }
]

// 市场选项
const marketOptions = [
  { label: '上海', value: '上海' },
  { label: '深圳', value: '深圳' },
  { label: '北京', value: '北京' }
]

// 计算属性
const filteredStocks = computed(() => {
  let stocks = stockStore.stocks

  // 搜索过滤
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    stocks = stocks.filter(stock => 
      stock.code.toLowerCase().includes(query) ||
      stock.name.toLowerCase().includes(query)
    )
  }

  // 板块过滤
  if (selectedBoard.value) {
    stocks = stocks.filter(stock => stock.board === selectedBoard.value)
  }

  // 市场过滤
  if (selectedMarket.value) {
    stocks = stocks.filter(stock => stock.market === selectedMarket.value)
  }

  return stocks
})

const paginatedStocks = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredStocks.value.slice(start, end)
})

const statistics = computed(() => {
  const total = stockStore.stocks.length
  const boardStats = stockStore.boardStatistics
  return [
    { label: '总股票数', count: total },
    { label: '主板', count: boardStats.find(s => s.board === '主板')?.count || 0 },
    { label: '创业板', count: boardStats.find(s => s.board === '创业板')?.count || 0 },
    { label: '科创板', count: boardStats.find(s => s.board === '科创板')?.count || 0 },
    { label: 'ST板', count: boardStats.find(s => s.board === 'ST板')?.count || 0 },
    { label: '北交板', count: boardStats.find(s => s.board === '北交所')?.count || 0 }
  ]
})

// 方法
const handleSearch = () => {
  currentPage.value = 1
}

const handleBoardFilter = () => {
  currentPage.value = 1
}

const handleMarketFilter = () => {
  currentPage.value = 1
}

const handleSizeChange = (size: number) => {
  pageSize.value = size
  currentPage.value = 1
}

const handleCurrentChange = (page: number) => {
  currentPage.value = page
}

// 同步数据
const syncData = async () => {
  try {
    syncing.value = true
    syncProgress.value = {
      percentage: 0,
      status: 'active',
      currentPage: 0,
      totalCount: 0,
      logs: []
    }

    // 添加开始日志
    addLog('info', '开始同步股票数据...')

    // 使用 fetch 调用后端爬虫接口
    const response = await fetch('http://localhost:3000/api/crawl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })

    if (response.ok) {
      // 读取流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法读取响应流')
      }

      const decoder = new TextDecoder()
      
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        
        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              switch (data.type) {
                case 'start':
                  addLog('info', data.message)
                  break
                case 'page_start':
                  addLog('info', data.message)
                  syncProgress.value.currentPage = data.currentPage
                  break
                case 'progress':
                  syncProgress.value.totalCount = data.totalCount
                  syncProgress.value.percentage = Math.min((data.totalCount / 5000) * 100, 99)
                  addLog('info', data.message)
                  break
                case 'page_complete':
                  addLog('success', data.message)
                  break
                case 'error':
                  addLog('error', data.message)
                  break
                case 'complete':
                  addLog('success', data.message)
                  syncProgress.value.status = 'success'
                  syncProgress.value.percentage = 100
                  
                  // 同步完成后刷新股票列表
                  setTimeout(async () => {
                    await stockStore.fetchStocks()
                    ElMessage.success('数据同步成功！')
                  }, 1000)
                  break
              }
            } catch (error) {
              console.error('解析进度数据失败:', error)
            }
          }
        }
      }
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    addLog('error', `同步失败: ${error.message}`)
    syncProgress.value.status = 'exception'
    ElMessage.error(`同步失败: ${error.message}`)
  } finally {
    syncing.value = false
  }
}

// 添加日志
const addLog = (level: string, message: string) => {
  const time = new Date().toLocaleTimeString()
  syncProgress.value.logs.push({ time, message, level })
  
  // 限制日志数量
  if (syncProgress.value.logs.length > 100) {
    syncProgress.value.logs.shift()
  }
}

// 清空日志
const clearLog = () => {
  syncProgress.value.logs = []
}

// 获取状态样式类
const getStatusClass = (status: string) => {
  switch (status) {
    case 'success': return 'status-success'
    case 'exception': return 'status-error'
    default: return 'status-active'
  }
}

// 获取状态文本
const getStatusText = (status: string) => {
  switch (status) {
    case 'success': return '同步完成'
    case 'exception': return '同步失败'
    default: return '同步中'
  }
}

// 获取日志级别样式类
const getLogLevelClass = (level: string) => {
  switch (level) {
    case 'success': return 'log-success'
    case 'error': return 'log-error'
    case 'warning': return 'log-warning'
    default: return 'log-info'
  }
}

const refreshData = async () => {
  try {
    loading.value = true
    await stockStore.fetchStocks()
    ElMessage.success('数据刷新成功')
  } catch (error) {
    ElMessage.error('数据刷新失败')
  } finally {
    loading.value = false
  }
}

const handleRowClick = (row: Stock) => {
  selectedStock.value = row
  detailDialogVisible.value = true
}

const viewDetail = (stock: Stock) => {
  selectedStock.value = stock
  detailDialogVisible.value = true
}

const viewQuote = async (stock: Stock) => {
  try {
    loading.value = true
    const quote = await stockStore.getRealTimeQuote(stock.code)
    selectedStockQuote.value = quote
    quoteDialogVisible.value = true
  } catch (error) {
    ElMessage.error('获取实时行情失败')
  } finally {
    loading.value = false
  }
}

const handleDetailDialogClose = () => {
  detailDialogVisible.value = false
  selectedStock.value = null
}

const handleQuoteDialogClose = () => {
  quoteDialogVisible.value = false
  selectedStockQuote.value = null
}

const getStockCodeClass = (code: string) => {
  if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002')) {
    return 'sz-main'
  } else if (code.startsWith('300')) {
    return 'sz-gem'
  } else if (code.startsWith('688')) {
    return 'sh-star'
  } else if (code.startsWith('6')) {
    return 'sh-main'
  } else if (code.startsWith('8')) {
    return 'bj-exchange'
  }
  return ''
}

const getMarketTagType = (market: string) => {
  switch (market) {
    case '上海': return 'danger'
    case '深圳': return 'warning'
    case '北京': return 'info'
    default: return ''
  }
}

const getBoardTagType = (board: string) => {
  switch (board) {
    case '主板': return ''
    case '创业板': return 'warning'
    case '科创板': return 'danger'
    case '北交所': return 'info'
    case 'ST板': return 'warning'
    case '三板': return 'success'
    default: return ''
  }
}

const getChangeClass = (change: number) => {
  if (!change) return ''
  return change > 0 ? 'positive' : change < 0 ? 'negative' : ''
}

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('zh-CN')
}

const formatChange = (change: number) => {
  if (!change) return '--'
  return `${change > 0 ? '+' : ''}${change}%`
}

const formatVolume = (volume: number) => {
  if (!volume) return '--'
  if (volume >= 100000000) {
    return `${(volume / 100000000).toFixed(2)}亿手`
  } else if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)}万手`
  }
  return `${volume}手`
}

const formatAmount = (amount: number) => {
  if (!amount) return '--'
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)}亿元`
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)}万元`
  }
  return `${amount}元`
}

const exportToCSV = () => {
  const headers = ['代码', '名称', '市场', '板块', '行业']
  const csvContent = [
    headers.join(','),
    ...filteredStocks.value.map(stock => 
      [stock.code, stock.name, stock.market, stock.board, stock.industry].join(',')
    )
  ].join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `股票列表_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// 生命周期
onMounted(async () => {
  console.log('组件挂载，开始获取数据...')
  
  if (stockStore.stocks.length === 0) {
    console.log('股票列表为空，开始获取数据...')
    try {
      await stockStore.fetchStocks()
      console.log('获取股票数据成功:', stockStore.stocks.length)
    } catch (error) {
      console.error('获取股票数据失败:', error)
    }
  } else {
    console.log('股票列表已有数据:', stockStore.stocks.length)
  }
})

// 监听器
watch([searchQuery, selectedBoard, selectedMarket], () => {
  currentPage.value = 1
})
</script>

<style scoped>
.stock-list {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.search-filter-section {
  margin-bottom: 20px;
}

.filter-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}

.search-input {
  width: 300px;
}

.board-select,
.market-select {
  width: 150px;
}

.sync-btn {
  background: linear-gradient(135deg, #67c23a 0%, #85ce61 100%);
  border: none;
}

.refresh-btn {
  margin-left: auto;
}

.sync-progress-section {
  margin-bottom: 20px;
}

.progress-card {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.progress-content {
  padding: 20px;
}

.progress-header {
  margin-bottom: 20px;
}

.progress-header h3 {
  margin: 0 0 15px 0;
  color: #409eff;
}

.progress-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.progress-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.progress-item .label {
  font-weight: 500;
  color: #666;
}

.progress-item .value {
  font-weight: bold;
  color: #409eff;
}

.status-success { color: #67c23a; }
.status-error { color: #f56c6c; }
.status-active { color: #409eff; }

.progress-log {
  background: white;
  border-radius: 6px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

.log-header span {
  font-weight: 500;
  color: #666;
}

.log-content {
  max-height: 200px;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 15px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 12px;
}

.log-time {
  color: #999;
  min-width: 80px;
}

.log-message {
  flex: 1;
}

.log-success { color: #67c23a; }
.log-error { color: #f56c6c; }
.log-warning { color: #e6a23c; }
.log-info { color: #409eff; }

.statistics-section {
  margin-bottom: 20px;
}

.stat-card {
  text-align: center;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.stat-content {
  padding: 20px;
}

.stat-number {
  font-size: 32px;
  font-weight: bold;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  opacity: 0.9;
}

.stock-table-section {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stock-table {
  margin-bottom: 20px;
}

.stock-code {
  font-family: 'Courier New', monospace;
  font-weight: bold;
}

.stock-name {
  font-weight: 500;
}

.industry-text {
  color: #666;
  font-size: 12px;
}

.pagination-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.stock-detail,
.stock-quote {
  padding: 20px 0;
}

.price-text {
  font-size: 18px;
  font-weight: bold;
  color: #409eff;
}

.change-text {
  font-weight: bold;
}

.change-text.positive {
  color: #67c23a;
}

.change-text.negative {
  color: #f56c6c;
}

/* 股票代码颜色 */
.sz-main { color: #409eff; }
.sz-gem { color: #e6a23c; }
.sh-main { color: #f56c6c; }
.sh-star { color: #67c23a; }
.bj-exchange { color: #909399; }

/* 响应式设计 */
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }
  
  .search-input,
  .board-select,
  .market-select {
    width: 100%;
  }
  
  .sync-btn,
  .refresh-btn {
    margin-left: 0;
    margin-top: 10px;
  }
  
  .progress-details {
    grid-template-columns: 1fr;
  }
}
</style> 