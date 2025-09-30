<template>
  <div class="limit-up-stocks">
    <div class="header">
      <h2>涨停股票</h2>
      <div class="controls">
        <el-radio-group v-model="queryMode" @change="handleQueryModeChange" style="margin-right: 15px;">
          <el-radio-button label="today">今天</el-radio-button>
          <el-radio-button label="single">单日</el-radio-button>
          <el-radio-button label="range">范围</el-radio-button>
        </el-radio-group>
        
        <el-date-picker
          v-if="queryMode === 'single'"
          v-model="selectedDate"
          type="date"
          placeholder="选择日期"
          format="YYYY-MM-DD"
          value-format="YYYYMMDD"
          :disabled-date="disabledDate"
          @change="handleSingleDateChange"
          style="margin-right: 10px;"
        />
        
        <el-date-picker
          v-if="queryMode === 'range'"
          v-model="selectedDateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYYMMDD"
          :disabled-date="disabledDate"
          @change="handleDateRangeChange"
          style="margin-right: 10px;"
        />
        
        <el-button 
          type="primary" 
          @click="loadTodayLimitUp"
          :loading="loading"
        >
          今天涨停
        </el-button>
        <el-button 
          @click="refreshData"
          :loading="loading"
        >
          刷新
        </el-button>
      </div>
    </div>

    <div class="stats" v-if="limitUpData.length > 0">
      <el-card>
        <div class="stat-item">
          <span class="label">涨停股票总数：</span>
          <span class="value">{{ deduplicatedData.length }}</span>
        </div>
        <div class="stat-item" v-if="deduplicationStats && deduplicationStats.removedCount > 0">
          <span class="label">去重前总数：</span>
          <span class="value">{{ deduplicationStats.originalCount }}只</span>
        </div>
        <div class="stat-item" v-if="deduplicationStats && deduplicationStats.removedCount > 0">
          <span class="label">重复股票：</span>
          <span class="value">{{ deduplicationStats.removedCount }}只</span>
        </div>
        <div class="stat-item">
          <span class="label">查询范围：</span>
          <span class="value">{{ displayDateRange }}</span>
        </div>
        <div class="stat-item" v-if="rangeInfo">
          <span class="label">交易日数：</span>
          <span class="value">{{ rangeInfo.totalDays }}天</span>
        </div>
        <div class="stat-item" v-if="rangeInfo">
          <span class="label">成功天数：</span>
          <span class="value">{{ rangeInfo.successDays }}天</span>
        </div>
        <div class="stat-item">
          <span class="label">更新时间：</span>
          <span class="value">{{ lastUpdateTime }}</span>
        </div>
      </el-card>
      
      <!-- 范围查询的详细结果 -->
      <el-card v-if="rangeInfo && rangeInfo.totalDays > 1" style="margin-top: 10px;">
        <template #header>
          <span>每日涨停统计</span>
        </template>
        <div class="daily-stats">
          <div 
            v-for="dayResult in dateResults" 
            :key="dayResult.date"
            class="daily-stat-item"
          >
            <span class="date">{{ formatDisplayDate(dayResult.date) }}</span>
            <el-tag 
              :type="dayResult.success ? 'success' : 'danger'" 
              size="small"
            >
              {{ dayResult.success ? `${dayResult.count}只` : '失败' }}
            </el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <div class="filters" v-if="limitUpData.length > 0">
      <el-card>
        <el-row :gutter="20">
          <el-col :span="6">
            <el-select v-model="selectedBoard" placeholder="选择板块" clearable @change="filterStocks">
              <el-option label="全部板块" value="" />
              <el-option 
                v-for="board in boardOptions" 
                :key="board" 
                :label="board" 
                :value="board" 
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-select v-model="selectedIndustry" placeholder="选择行业" clearable @change="filterStocks">
              <el-option label="全部行业" value="" />
              <el-option 
                v-for="industry in industryOptions" 
                :key="industry" 
                :label="industry" 
                :value="industry" 
              />
            </el-select>
          </el-col>
          <el-col :span="6">
            <el-input
              v-model="searchKeyword"
              placeholder="搜索股票代码或名称"
              @input="filterStocks"
              clearable
            />
          </el-col>
          <el-col :span="6">
            <el-button @click="exportData" type="success">
              导出数据
            </el-button>
          </el-col>
        </el-row>
        
        <!-- 筛选结果统计 -->
        <div class="filter-stats" v-if="limitUpData.length > 0">
          <el-row :gutter="20" style="margin-top: 15px;">
            <el-col :span="24">
              <div class="stats-info">
                <span class="stat-item">
                  <span class="label">原始数据：</span>
                  <span class="value">{{ deduplicatedData.length }}只</span>
                </span>
                <span class="stat-item" v-if="hasActiveFilters">
                  <span class="label">筛选后：</span>
                  <span class="value highlight">{{ filteredStocks.length }}只</span>
                </span>
                <span class="stat-item" v-if="hasActiveFilters && filteredStocks.length !== deduplicatedData.length">
                  <span class="label">已筛选：</span>
                  <span class="value">{{ deduplicatedData.length - filteredStocks.length }}只</span>
                </span>
                <el-button 
                  v-if="hasActiveFilters" 
                  type="info" 
                  size="small" 
                  @click="clearAllFilters"
                  style="margin-left: 20px;"
                >
                  清除筛选
                </el-button>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-card>
    </div>

    <div class="table-container">
      <el-table 
        :data="filteredStocks" 
        v-loading="loading"
        stripe
        border
        height="600"
        @sort-change="handleSortChange"
      >
        <el-table-column prop="code" label="股票代码" width="100" sortable>
          <template #default="{ row }">
            <el-link 
              type="primary" 
              @click="viewStockDetail(row.code)"
              :underline="false"
            >
              {{ row.code }}
            </el-link>
          </template>
        </el-table-column>
        
        <el-table-column prop="name" label="股票名称" width="120" sortable>
          <template #default="{ row }">
            <span class="stock-name">{{ row.name }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="date" label="涨停日期" width="120" sortable>
          <template #default="{ row }">
            <el-tag type="success" size="small">
              {{ formatDisplayDate(row.date) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="board" label="板块" width="100">
          <template #default="{ row }">
            <el-tag :type="getBoardTagType(row.board)" size="small">
              {{ row.board }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="hybk" label="行业" width="120">
          <template #default="{ row }">
            <span>{{ row.hybk || '-' }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="currentPrice" label="当前价格" width="100" sortable>
          <template #default="{ row }">
            <span class="price">¥{{ row.currentPrice }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="changePercentage" label="涨跌幅" width="100" sortable>
          <template #default="{ row }">
            <span class="change-percent positive">
              +{{ row.changePercentage }}%
            </span>
          </template>
        </el-table-column>
        
        <el-table-column prop="lbc" label="连板次数" width="100" sortable>
          <template #default="{ row }">
            <el-tag 
              v-if="row.lbc > 1" 
              type="danger" 
              size="small"
            >
              {{ row.lbc }}连板
            </el-tag>
            <span v-else>{{ row.lbc }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="amount" label="成交额(万)" width="120" sortable>
          <template #default="{ row }">
            <span>{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="ltsz" label="流通市值(亿)" width="120" sortable>
          <template #default="{ row }">
            <span>{{ row.ltsz }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="hs" label="换手率" width="100" sortable>
          <template #default="{ row }">
            <span>{{ row.hs }}%</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="fbt" label="首次封板时间" width="120">
          <template #default="{ row }">
            <span>{{ formatTime(row.fbt) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="lbt" label="最后封板时间" width="120">
          <template #default="{ row }">
            <span>{{ formatTime(row.lbt) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="zbc" label="炸板次数" width="100" sortable>
          <template #default="{ row }">
            <el-tag 
              v-if="row.zbc > 0" 
              type="warning" 
              size="small"
            >
              {{ row.zbc }}次
            </el-tag>
            <span v-else>0</span>
          </template>
        </el-table-column>
        
        <el-table-column prop="fund" label="封板资金(万)" width="120" sortable>
          <template #default="{ row }">
            <span>{{ formatAmount(row.fund) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useStockStore } from '../stores/stock'
import { useRouter } from 'vue-router'

const stockStore = useStockStore()
const router = useRouter()

// 响应式数据
const limitUpData = ref<any[]>([])
const loading = ref(false)
const queryMode = ref<string>('today')
const selectedDate = ref<string>('')
const selectedDateRange = ref<string[]>([])
const selectedBoard = ref<string>('')
const selectedIndustry = ref<string>('')
const searchKeyword = ref<string>('')
const rangeInfo = ref<any>(null)
const dateResults = ref<any[]>([])

// 计算属性
const displayDateRange = computed(() => {
  if (queryMode.value === 'today') return '今天'
  if (queryMode.value === 'single' && selectedDate.value) {
    const date = selectedDate.value
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  }
  if (queryMode.value === 'range' && selectedDateRange.value && selectedDateRange.value.length === 2) {
    const [startDate, endDate] = selectedDateRange.value
    return `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)} 至 ${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`
  }
  return '今天'
})

const lastUpdateTime = computed(() => {
  if (limitUpData.value.length === 0) return '-'
  return new Date().toLocaleString()
})

// 去重后的数据
const deduplicatedData = computed(() => {
  if (limitUpData.value.length === 0) return []
  
  const stockMap = new Map()
  limitUpData.value.forEach(stock => {
    const existingStock = stockMap.get(stock.code)
    if (!existingStock || stock.date > existingStock.date) {
      stockMap.set(stock.code, stock)
    }
  })
  
  return Array.from(stockMap.values())
})

// 去重统计信息
const deduplicationStats = computed(() => {
  if (limitUpData.value.length === 0) return null
  
  const originalCount = limitUpData.value.length
  const uniqueCount = deduplicatedData.value.length
  const removedCount = originalCount - uniqueCount
  
  return {
    originalCount,
    uniqueCount,
    removedCount
  }
})

// 判断是否有活跃的筛选条件
const hasActiveFilters = computed(() => {
  return selectedBoard.value || selectedIndustry.value || searchKeyword.value
})

const boardOptions = computed(() => {
  const boards = new Set(deduplicatedData.value.map(stock => stock.board))
  return Array.from(boards).filter(Boolean)
})

const industryOptions = computed(() => {
  const industries = new Set(deduplicatedData.value.map(stock => stock.hybk))
  return Array.from(industries).filter(Boolean)
})

const filteredStocks = computed(() => {
  let filtered = deduplicatedData.value

  // 按板块筛选
  if (selectedBoard.value) {
    filtered = filtered.filter(stock => stock.board === selectedBoard.value)
  }

  // 按行业筛选
  if (selectedIndustry.value) {
    filtered = filtered.filter(stock => stock.hybk === selectedIndustry.value)
  }

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase()
    filtered = filtered.filter(stock => 
      stock.code.toLowerCase().includes(keyword) || 
      stock.name.toLowerCase().includes(keyword)
    )
  }

  return filtered
})



// 方法
const loadTodayLimitUp = async () => {
  try {
    loading.value = true
    const data = await stockStore.fetchTodayLimitUpStocks()
    limitUpData.value = data || []
    selectedDate.value = ''
    ElMessage.success(`成功获取今天涨停股票，共 ${deduplicatedData.value.length} 只`)
  } catch (error) {
    ElMessage.error('获取今天涨停股票失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadLimitUpByDate = async (date: string) => {
  try {
    loading.value = true
    const data = await stockStore.fetchLimitUpStocksByDate(date)
    limitUpData.value = data || []
    rangeInfo.value = null
    dateResults.value = []
    ElMessage.success(`成功获取 ${formatDisplayDate(date)} 涨停股票，共 ${deduplicatedData.value.length} 只`)
  } catch (error) {
    ElMessage.error('获取涨停股票失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadLimitUpByRange = async (startDate: string, endDate: string) => {
  try {
    loading.value = true
    const result = await stockStore.fetchLimitUpStocksByRange(startDate, endDate)
    limitUpData.value = result.data || []
    rangeInfo.value = result.dateRange
    dateResults.value = result.dateResults || []
    ElMessage.success(`成功获取 ${formatDisplayDate(startDate)} 至 ${formatDisplayDate(endDate)} 涨停股票，共 ${deduplicatedData.value.length} 只（去重后）`)
  } catch (error) {
    ElMessage.error('获取日期范围涨停股票失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

const handleSingleDateChange = (date: string) => {
  if (date) {
    // 检查日期是否超过今天，如果超过则调整为今天
    const today = new Date()
    const todayStr = today.getFullYear().toString() +
                    (today.getMonth() + 1).toString().padStart(2, '0') +
                    today.getDate().toString().padStart(2, '0')
    
    if (date > todayStr) {
      selectedDate.value = todayStr
      ElMessage.warning(`日期不能超过今天，已自动调整为 ${formatDisplayDate(todayStr)}`)
      loadLimitUpByDate(todayStr)
    } else {
      loadLimitUpByDate(date)
    }
  }
}

const handleDateRangeChange = (dateRange: string[]) => {
  if (dateRange && dateRange.length === 2) {
    let [startDate, endDate] = dateRange
    
    // 检查结束日期是否超过今天，如果超过则调整为今天
    const today = new Date()
    const todayStr = today.getFullYear().toString() +
                    (today.getMonth() + 1).toString().padStart(2, '0') +
                    today.getDate().toString().padStart(2, '0')
    
    if (endDate > todayStr) {
      endDate = todayStr
      selectedDateRange.value = [startDate, endDate]
      ElMessage.warning(`结束日期不能超过今天，已自动调整为 ${formatDisplayDate(endDate)}`)
    }
    
    loadLimitUpByRange(startDate, endDate)
  }
}

const handleQueryModeChange = () => {
  // 重置数据
  limitUpData.value = []
  rangeInfo.value = null
  dateResults.value = []
  selectedDate.value = ''
  selectedDateRange.value = []
}

const refreshData = () => {
  if (queryMode.value === 'today') {
    loadTodayLimitUp()
  } else if (queryMode.value === 'single' && selectedDate.value) {
    loadLimitUpByDate(selectedDate.value)
  } else if (queryMode.value === 'range' && selectedDateRange.value && selectedDateRange.value.length === 2) {
    const [startDate, endDate] = selectedDateRange.value
    loadLimitUpByRange(startDate, endDate)
  } else {
    loadTodayLimitUp()
  }
}

const filterStocks = () => {
  // 筛选时不需要重置分页，因为已经没有分页了
}

// 清除所有筛选条件
const clearAllFilters = () => {
  selectedBoard.value = ''
  selectedIndustry.value = ''
  searchKeyword.value = ''
}

// 禁用超过今天的日期
const disabledDate = (time: Date) => {
  const today = new Date()
  today.setHours(23, 59, 59, 999) // 设置为今天的最后一刻
  return time.getTime() > today.getTime()
}

const handleSortChange = ({ prop, order }: any) => {
  // 这里可以添加排序逻辑
  console.log('排序:', prop, order)
}


const viewStockDetail = (code: string) => {
  router.push(`/stock/${code}`)
}

const getBoardTagType = (board: string) => {
  const types: Record<string, string> = {
    '主板': '',
    '创业板': 'success',
    '科创板': 'warning',
    'ST板': 'danger'
  }
  return types[board] || 'info'
}

const formatAmount = (amount: number) => {
  if (!amount) return '0'
  return (amount / 10000).toFixed(0)
}

const formatTime = (time: number) => {
  if (!time) return '-'
  const timeStr = time.toString()
  if (timeStr.length === 6) {
    return `${timeStr.slice(0, 2)}:${timeStr.slice(2, 4)}:${timeStr.slice(4, 6)}`
  }
  return timeStr
}

const formatDisplayDate = (dateStr: string) => {
  if (!dateStr || dateStr.length !== 8) return dateStr
  return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
}

const exportData = () => {
  if (filteredStocks.value.length === 0) {
    ElMessage.warning('没有数据可导出')
    return
  }

  const headers = [
    '股票代码', '股票名称', '涨停日期', '板块', '行业', '当前价格', '涨跌幅', '连板次数',
    '成交额(万)', '流通市值(亿)', '换手率', '首次封板时间', '最后封板时间',
    '炸板次数', '封板资金(万)'
  ]
  
  const csvContent = [
    headers.join(','),
    ...filteredStocks.value.map(stock => [
      stock.code, stock.name, formatDisplayDate(stock.date), stock.board, stock.hybk || '', stock.currentPrice,
      stock.changePercentage, stock.lbc, formatAmount(stock.amount),
      stock.ltsz, stock.hs, formatTime(stock.fbt), formatTime(stock.lbt),
      stock.zbc, formatAmount(stock.fund)
    ].join(','))
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `涨停股票_${displayDateRange.value}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  ElMessage.success('数据导出成功')
}

// 生命周期
onMounted(() => {
  loadTodayLimitUp()
})
</script>

<style scoped>
.limit-up-stocks {
  padding: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #303133;
}

.controls {
  display: flex;
  align-items: center;
}

.stats {
  margin-bottom: 20px;
}

.stat-item {
  display: inline-block;
  margin-right: 30px;
}

.stat-item .label {
  color: #606266;
  margin-right: 8px;
}

.stat-item .value {
  color: #303133;
  font-weight: bold;
}

.filters {
  margin-bottom: 20px;
}

.table-container {
  margin-bottom: 20px;
}

.stock-name {
  font-weight: 500;
}

.price {
  color: #E6A23C;
  font-weight: bold;
}

.change-percent.positive {
  color: #F56C6C;
  font-weight: bold;
}


.el-card {
  margin-bottom: 10px;
}

.el-table .el-link {
  font-weight: 500;
}

.daily-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.daily-stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.daily-stat-item .date {
  font-size: 12px;
  color: #606266;
}

.filter-stats {
  border-top: 1px solid #f0f0f0;
  padding-top: 15px;
}

.stats-info {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
}

.stats-info .stat-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.stats-info .label {
  color: #606266;
  font-size: 14px;
}

.stats-info .value {
  color: #303133;
  font-weight: 600;
  font-size: 14px;
}

.stats-info .value.highlight {
  color: #409EFF;
  font-weight: 700;
}
</style>
