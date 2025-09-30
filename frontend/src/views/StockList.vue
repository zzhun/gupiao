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

          <!-- 市值范围筛选 -->
          <div class="market-value-filter">
            <el-select
              v-model="selectedMarketValueMin"
              placeholder="最小市值"
              clearable
              @change="handleMarketValueFilter"
              class="market-value-select"
            >
              <el-option
                v-for="option in marketValueOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <span class="filter-separator">至</span>
            <el-select
              v-model="selectedMarketValueMax"
              placeholder="最大市值"
              clearable
              @change="handleMarketValueFilter"
              class="market-value-select"
            >
              <el-option
                v-for="option in marketValueOptions"
                :key="option.value"
                :label="option.label"
                :value="option.value"
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

          <!-- 主板小市值涨停筛选按钮 -->
          <el-button
            type="warning"
            @click="filterMainBoardLimitUp"
            :loading="filtering"
            :disabled="filtering"
            class="filter-btn"
          >
            <el-icon><Search /></el-icon>
            {{ filtering ? '筛选中...' : '主板小市值涨停筛选' }}
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

    <!-- 筛选结果显示 -->
    <div v-if="showFilterResults" class="filter-results-section">
      <el-card class="filter-results-card">
        <template #header>
          <div class="filter-results-header">
            <span>主板小市值涨停筛选结果 ({{ filteredLimitUpStocks.length }})</span>
            <el-button
              type="primary"
              size="small"
              @click="exportFilterResultsToCSV"
              :disabled="filteredLimitUpStocks.length === 0"
            >
              导出结果
            </el-button>
          </div>
        </template>
        
        <el-table
          :data="filteredLimitUpStocks"
          stripe
          border
          class="filter-results-table"
        >
          <el-table-column prop="code" label="股票代码" width="100" sortable>
            <template #default="{ row }">
              <span class="stock-code" :class="getStockCodeClass(row.code)">
                {{ row.code }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="limitUpDate" label="涨停日期" width="120" sortable>
            <template #default="{ row }">
              <span class="limit-up-date">{{ row.limitUpDate }}</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="changePercent" label="涨停幅度" width="120" sortable>
            <template #default="{ row }">
              <span class="limit-up-percent positive">
                +{{ row.changePercent.toFixed(2) }}%
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="closePrice" label="收盘价" width="120" sortable>
            <template #default="{ row }">
              <span class="close-price">¥{{ parseFloat(row.closePrice).toFixed(2) }}</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="volume" label="成交量" width="120" sortable>
            <template #default="{ row }">
              <span class="volume">{{ safeVolumeFormat(parseFloat(row.volume)) }}</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="turnover" label="成交额" width="120" sortable>
            <template #default="{ row }">
              <span class="turnover">{{ safeTurnoverFormat(parseFloat(row.turnover)) }}</span>
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="viewStockDetail(row.code)"
              >
                查看详情
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- 股票列表 -->
    <div class="stock-table-section">
      <el-card>
        <template #header>
          <div class="table-header">
            <span>股票列表 ({{ filteredStocks.length }})</span>
            <div class="header-actions">
              <el-button
                type="success"
                size="small"
                @click="exportToCSV"
                :disabled="filteredStocks.length === 0"
              >
                导出CSV
              </el-button>
            </div>
          </div>
        </template>

        <!-- 股票列表表格 -->
        <el-table-v2
          :data="filteredStocks"
          :columns="tableColumns"
          :width="1500"
          :height="600"
          :row-height="50"
          :header-height="50"
          :fixed="true"
          row-key="code"
          class="stock-table-v2"
          @row-click="handleRowClick"
        />

        <!-- 选择控制区域 -->
        <div class="selection-controls">
          <el-checkbox
            v-model="selectAll"
            @change="handleSelectAllChange"
            :indeterminate="isIndeterminate"
          >
            全选 ({{ selectedStocks.length }}/{{ filteredStocks.length }})
          </el-checkbox>
          <el-button 
            v-if="selectedStocks.length > 0" 
            type="warning" 
            size="small" 
            @click="clearSelection"
          >
            清空选择
          </el-button>
        </div>

        <!-- 选中项操作区域 -->
        <div v-if="selectedStocks.length > 0" class="selected-actions">
          <el-card class="selected-actions-card">
            <template #header>
              <div class="selected-actions-header">
                <span>已选择 {{ selectedStocks.length }} 只股票</span>
                <div class="selected-actions-buttons">
                  <el-button
                    type="primary"
                    size="small"
                    @click="syncSelectedStocks"
                  >
                    同步数据
                  </el-button>
                  <el-button
                    type="success"
                    size="small"
                    @click="exportSelectedToCSV"
                  >
                    导出CSV
                  </el-button>
                  <el-button
                    type="warning"
                    size="small"
                    @click="clearSelection"
                  >
                    清空选择
                  </el-button>
                </div>
              </div>
            </template>
            
            <!-- 日线数据获取选项 -->
            <div class="kline-options">
              <el-divider content-position="left">日线数据获取</el-divider>
              <div class="kline-options-content">
                <el-radio-group v-model="klineFetchMode" size="small">
                  <el-radio label="batch">批量获取（等待完成）</el-radio>
                  <el-radio label="stream">流式获取（实时更新）</el-radio>
                </el-radio-group>
                
                <el-button
                  type="primary"
                  size="small"
                  @click="getSelectedStocksKLine"
                  :loading="klineLoading"
                  style="margin-left: 20px;"
                >
                  获取日线数据
                </el-button>
              </div>
            </div>
            
            <!-- 流式获取进度显示 -->
            <div v-if="klineFetchMode === 'stream' && streamProgress" class="stream-progress">
              <el-divider content-position="left">实时进度</el-divider>
              <div class="progress-content">
                <el-progress 
                  :percentage="streamProgress.percentage" 
                  :status="streamProgress.status"
                  :stroke-width="20"
                />
                <div class="progress-info">
                  <span>{{ streamProgress.message }}</span>
                  <span v-if="streamProgress.current && streamProgress.total">
                    ({{ streamProgress.current }}/{{ streamProgress.total }})
                  </span>
                </div>
                <div v-if="streamProgress.details" class="progress-details">
                  <el-tag v-if="streamProgress.successCount > 0" type="success" size="small">
                    成功: {{ streamProgress.successCount }}
                  </el-tag>
                  <el-tag v-if="streamProgress.failCount > 0" type="danger" size="small">
                    失败: {{ streamProgress.failCount }}
                  </el-tag>
                  <el-tag v-if="streamProgress.batchInfo" type="info" size="small">
                    {{ streamProgress.batchInfo }}
                  </el-tag>
                </div>
              </div>
            </div>
          </el-card>
        </div>

        <!-- 日线数据结果显示区域 -->
        <div v-if="klineResults.length > 0" class="kline-results-section">
          <el-card class="kline-results-card">
            <template #header>
              <div class="kline-results-header">
                <div class="kline-results-info">
                  <span>日线数据结果 ({{ filteredKLineResults.length }}/{{ klineResults.length }} 只股票)</span>
                  <el-tag v-if="showLimitUpOnly" type="success" size="small" style="margin-left: 10px;">
                    仅显示涨停股票
                  </el-tag>
                </div>
                <div class="kline-results-actions">
                  <el-switch
                    v-model="showLimitUpOnly"
                    active-text="仅显示涨停"
                    inactive-text="显示全部"
                    style="margin-right: 15px;"
                  />
                  <el-button
                    type="primary"
                    size="small"
                    @click="exportKLineResultsToCSV"
                    :disabled="filteredKLineResults.length === 0"
                  >
                    导出日线数据
                  </el-button>
                </div>
              </div>
            </template>
            
            <el-table
              :data="filteredKLineResults"
              stripe
              border
              class="kline-results-table"
            >
              <el-table-column prop="code" label="股票代码" width="100" sortable>
                <template #default="{ row }">
                  <span class="stock-code" :class="getStockCodeClass(row.code)">
                    {{ row.code }}
                  </span>
                </template>
              </el-table-column>
              
              <el-table-column prop="success" label="状态" width="80" sortable>
                <template #default="{ row }">
                  <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                    {{ row.success ? '成功' : '失败' }}
                  </el-tag>
                </template>
              </el-table-column>
              
              <el-table-column prop="dataCount" label="数据条数" width="100" sortable>
                <template #default="{ row }">
                  <span v-if="row.success && row.data">
                    {{ row.data.length }} 条
                  </span>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="latestDate" label="最新日期" width="120" sortable>
                <template #default="{ row }">
                  <span v-if="row.success && row.data && row.data.length > 0">
                    {{ parseKLineData(row.data[0]).date }}
                  </span>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="latestClose" label="最新收盘价" width="120" sortable>
                <template #default="{ row }">
                  <span v-if="row.success && row.data && row.data.length > 0">
                    ¥{{ parseFloat(parseKLineData(row.data[0]).close).toFixed(2) }}
                  </span>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="latestChange" label="最新涨跌幅" width="120" sortable>
                <template #default="{ row }">
                  <span v-if="row.success && row.data && row.data.length > 0" 
                        :class="['change-text', parseFloat(parseKLineData(row.data[0]).changePercent) > 0 ? 'positive' : 'negative']">
                    {{ parseFloat(parseKLineData(row.data[0]).changePercent).toFixed(2) }}%
                  </span>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="limitUpInfo" label="涨停信息" width="150" sortable>
                <template #default="{ row }">
                  <div v-if="row.success && row.data && row.data.length > 0">
                    <el-tag 
                      v-if="hasLimitUpIn10Days(row)" 
                      type="success" 
                      size="small"
                    >
                      有涨停
                    </el-tag>
                    <el-tag 
                      v-else 
                      type="info" 
                      size="small"
                    >
                      无涨停
                    </el-tag>
                    <div class="limit-up-details" v-if="hasLimitUpIn10Days(row)">
                      <small style="color: #67c23a;">
                        涨停标准: {{ getLimitUpStandard(getStockBoard(row.code)) }}
                      </small>
                    </div>
                  </div>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column prop="error" label="错误信息" min-width="200">
                <template #default="{ row }">
                  <span v-if="!row.success" class="error-text">
                    {{ row.error }}
                  </span>
                  <span v-else class="no-data">--</span>
                </template>
              </el-table-column>
              
              <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                  <el-button
                    v-if="row.success && row.data"
                    type="primary"
                    size="small"
                    @click="viewKLineDetail(row)"
                  >
                    查看详情
                  </el-button>
                  <el-button
                    v-else
                    type="warning"
                    size="small"
                    @click="retryGetKLine(row.code)"
                  >
                    重试
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
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
          <el-descriptions-item label="当前价格">
            <span v-if="selectedStock.current_price && parseFloat(selectedStock.current_price) > 0" class="price-text">
              {{ safeNumberFormat(parseFloat(selectedStock.current_price), 2, '¥') }}
            </span>
            <span v-else class="no-data">暂无数据</span>
          </el-descriptions-item>
          <el-descriptions-item label="涨跌幅">
            <span v-if="selectedStock.change_percentage && parseFloat(selectedStock.change_percentage) !== 0" 
                  :class="['change-text', parseFloat(selectedStock.change_percentage) > 0 ? 'positive' : 'negative']">
              {{ safePercentageFormat(parseFloat(selectedStock.change_percentage)) }}
            </span>
            <span v-else class="no-data">0.00%</span>
          </el-descriptions-item>
          <el-descriptions-item label="总市值">
            <span v-if="selectedStock.total_market_value && parseFloat(selectedStock.total_market_value) > 0" class="market-value-text">
              {{ formatMarketValue(selectedStock.total_market_value) }}
            </span>
            <span v-else class="no-data">暂无数据</span>
          </el-descriptions-item>
          <el-descriptions-item label="流通市值">
            <span v-if="selectedStock.circulating_market_value && parseFloat(selectedStock.circulating_market_value) > 0" class="market-value-text">
              {{ formatMarketValue(selectedStock.circulating_market_value) }}
            </span>
            <span v-else class="no-data">暂无数据</span>
          </el-descriptions-item>
          <el-descriptions-item label="成交量">
            <span v-if="selectedStock.volume && parseFloat(selectedStock.volume) > 0">
              {{ safeVolumeFormat(parseFloat(selectedStock.volume)) }}
            </span>
            <span v-else class="no-data">暂无数据</span>
          </el-descriptions-item>
          <el-descriptions-item label="成交额">
            <span v-if="selectedStock.turnover && parseFloat(selectedStock.turnover) > 0">
              {{ safeTurnoverFormat(parseFloat(selectedStock.turnover)) }}
            </span>
            <span v-else class="no-data">暂无数据</span>
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

    <!-- 日线数据详情对话框 -->
    <el-dialog
      v-model="klineDetailDialogVisible"
      title="日线数据详情"
      width="1200px"
      :before-close="handleKLineDetailDialogClose"
    >
      <div v-if="selectedKLineData" class="kline-detail">
        <div class="kline-header">
          <h3>{{ selectedKLineData.name }} ({{ selectedKLineData.code }}) - 日线数据</h3>
          <p>共 {{ selectedKLineData.data.length }} 条数据，最近10个交易日</p>
        </div>
        
        <!-- 日线数据表格 -->
        <el-table
          :data="selectedKLineData.data"
          stripe
          border
          class="kline-data-table"
          :max-height="500"
        >
          <el-table-column prop="date" label="日期" width="120" sortable>
            <template #default="{ row }">
              {{ parseKLineData(row).date }}
            </template>
          </el-table-column>
          
          <el-table-column prop="open" label="开盘价" width="100" sortable>
            <template #default="{ row }">
              ¥{{ parseFloat(parseKLineData(row).open).toFixed(2) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="high" label="最高价" width="100" sortable>
            <template #default="{ row }">
              ¥{{ parseFloat(parseKLineData(row).high).toFixed(2) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="close" label="收盘价" width="100" sortable>
            <template #default="{ row }">
              ¥{{ parseFloat(parseKLineData(row).close).toFixed(2) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="low" label="最低价" width="100" sortable>
            <template #default="{ row }">
              ¥{{ parseFloat(parseKLineData(row).low).toFixed(2) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="volume" label="成交量" width="120" sortable>
            <template #default="{ row }">
              {{ safeVolumeFormat(parseFloat(parseKLineData(row).volume)) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="turnover" label="成交额" width="120" sortable>
            <template #default="{ row }">
              {{ safeTurnoverFormat(parseFloat(parseKLineData(row).turnover)) }}
            </template>
          </el-table-column>
          
          <el-table-column prop="changePercent" label="涨跌幅" width="100" sortable>
            <template #default="{ row }">
              <span :class="['change-text', parseFloat(parseKLineData(row).changePercent) > 0 ? 'positive' : 'negative']">
                {{ parseFloat(parseKLineData(row).changePercent).toFixed(2) }}%
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="amplitude" label="振幅" width="80" sortable>
            <template #default="{ row }">
              {{ parseFloat(parseKLineData(row).amplitude).toFixed(2) }}%
            </template>
          </el-table-column>
          
          <el-table-column prop="changeAmount" label="涨跌额" width="100" sortable>
            <template #default="{ row }">
              <span :class="['change-text', parseFloat(parseKLineData(row).changeAmount) > 0 ? 'positive' : 'negative']">
                {{ parseFloat(parseKLineData(row).changeAmount).toFixed(2) }}
              </span>
            </template>
          </el-table-column>
          
          <el-table-column prop="turnoverRate" label="换手率" width="100" sortable>
            <template #default="{ row }">
              {{ parseFloat(parseKLineData(row).turnoverRate).toFixed(2) }}%
            </template>
          </el-table-column>
        </el-table>
        
        <!-- 原始数据展示 -->
        <div class="raw-data-section">
          <h4>原始数据格式</h4>
          <el-collapse>
            <el-collapse-item title="查看原始数据" name="raw-data">
              <pre class="raw-data-content">{{ JSON.stringify(selectedKLineData.data, null, 2) }}</pre>
            </el-collapse-item>
          </el-collapse>
        </div>
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
import { h } from 'vue'
import { ElTag, ElButton, ElCheckbox } from 'element-plus'

// 状态管理
const stockStore = useStockStore()

// 响应式数据
const loading = ref(false)
const syncing = ref(false)
const filtering = ref(false)
const searchQuery = ref('')
const selectedBoard = ref('')
const selectedMarket = ref('')
const detailDialogVisible = ref(false)
const quoteDialogVisible = ref(false)
const klineDetailDialogVisible = ref(false)
const selectedStock = ref<Stock | null>(null)
const selectedStockQuote = ref<any>(null)
const selectedKLineData = ref<any>(null)

// 筛选结果
const filteredLimitUpStocks = ref<any[]>([])
const showFilterResults = ref(false)

// 同步进度状态
const syncProgress = ref({
  percentage: 0,
  status: 'active',
  currentPage: 0,
  totalCount: 0,
  logs: [] as Array<{time: string, message: string, level: string}>
})

// 股票列表选中状态
const selectedStocks = ref<Stock[]>([])
const selectAll = ref(false)
const isIndeterminate = ref(false)

// 虚拟表格列配置
const tableColumns = [
  {
    key: 'selection',
    dataKey: 'selection',
    title: '',
    width: 50,
    cellRenderer: ({ rowData }) => {
      return h(ElCheckbox, {
        modelValue: selectedStocks.value.some(stock => stock.code === rowData.code),
        onChange: (checked: boolean) => {
          if (checked) {
            // 添加到选中列表
            if (!selectedStocks.value.some(stock => stock.code === rowData.code)) {
              selectedStocks.value.push(rowData)
              console.log(`选中股票: ${rowData.code} (${rowData.name})`)
            }
          } else {
            // 从选中列表移除
            selectedStocks.value = selectedStocks.value.filter(stock => stock.code !== rowData.code)
            console.log(`取消选中股票: ${rowData.code} (${rowData.name})`)
          }
          // 更新全选状态
          updateSelectAllState()
          // 打印选中的股票代码数组到控制台
          console.log('当前选中的股票代码:', selectedStocks.value.map(stock => stock.code))
          console.log('当前选中股票数量:', selectedStocks.value.length)
        }
      })
    }
  },
  {
    key: 'code',
    dataKey: 'code',
    title: '代码',
    width: 100,
    cellRenderer: ({ rowData }) => {
      return h('span', {
        class: ['stock-code', getStockCodeClass(rowData.code)]
      }, rowData.code)
    }
  },
  {
    key: 'name',
    dataKey: 'name',
    title: '名称',
    width: 150,
    cellRenderer: ({ rowData }) => {
      return h('span', { class: 'stock-name' }, rowData.name)
    }
  },
  {
    key: 'market',
    dataKey: 'market',
    title: '市场',
    width: 100,
    cellRenderer: ({ rowData }) => {
      return h(ElTag, {
        type: getMarketTagType(rowData.market),
        size: 'small'
      }, () => rowData.market)
    }
  },
  {
    key: 'board',
    dataKey: 'board',
    title: '板块',
    width: 120,
    cellRenderer: ({ rowData }) => {
      return h(ElTag, {
        type: getBoardTagType(rowData.board),
        size: 'small'
      }, () => rowData.board)
    }
  },
  {
    key: 'industry',
    dataKey: 'industry',
    title: '行业',
    width: 150,
    cellRenderer: ({ rowData }) => {
      return h('span', { class: 'industry-text' }, rowData.industry)
    }
  },
  {
    key: 'current_price',
    dataKey: 'current_price',
    title: '当前价格',
    width: 120,
    cellRenderer: ({ rowData }) => {
      if (rowData.current_price && parseFloat(rowData.current_price) > 0) {
        return h('span', { class: 'price-text' }, 
          safeNumberFormat(parseFloat(rowData.current_price), 2, '¥'))
      }
      return h('span', { class: 'no-data' }, '--')
    }
  },
  {
    key: 'change_percentage',
    dataKey: 'change_percentage',
    title: '涨跌幅',
    width: 120,
    cellRenderer: ({ rowData }) => {
      if (rowData.change_percentage && parseFloat(rowData.change_percentage) !== 0) {
        const isPositive = parseFloat(rowData.change_percentage) > 0
        return h('span', {
          class: ['change-text', isPositive ? 'positive' : 'negative']
        }, safePercentageFormat(parseFloat(rowData.change_percentage)))
      }
      return h('span', { class: 'no-data' }, '0.00%')
    }
  },
  {
    key: 'total_market_value',
    dataKey: 'total_market_value',
    title: '总市值(亿元)',
    width: 130,
    cellRenderer: ({ rowData }) => {
      if (rowData.total_market_value && parseFloat(rowData.total_market_value) > 0) {
        return h('span', { class: 'market-value-text' }, 
          formatMarketValue(rowData.total_market_value))
      }
      return h('span', { class: 'no-data' }, '--')
    }
  },
  {
    key: 'circulating_market_value',
    dataKey: 'circulating_market_value',
    title: '流通市值(亿元)',
    width: 130,
    cellRenderer: ({ rowData }) => {
      if (rowData.circulating_market_value && parseFloat(rowData.circulating_market_value) > 0) {
        return h('span', { class: 'market-value-text' }, 
          formatMarketValue(rowData.circulating_market_value))
      }
      return h('span', { class: 'no-data' }, '--')
    }
  },
  {
    key: 'actions',
    dataKey: 'actions',
    title: '操作',
    width: 200,
    fixed: 'right',
    cellRenderer: ({ rowData }) => {
      return h('div', { class: 'action-buttons' }, [
        h(ElButton, {
          type: 'primary',
          size: 'small',
          onClick: (e) => {
            e.stopPropagation()
            viewDetail(rowData)
          }
        }, () => '查看详情'),
        h(ElButton, {
          type: 'success',
          size: 'small',
          onClick: (e) => {
            e.stopPropagation()
            viewQuote(rowData)
          }
        }, () => '实时行情')
      ])
    }
  }
]

// 板块选项
const boardOptions = [
  { label: '主板', value: '主板' },
  { label: '创业板', value: '创业板' },
  { label: '科创板', value: '科创板' },
  { label: 'ST板', value: 'ST板' },
  { label: '未知', value: '未知' }
]

// 市场选项
const marketOptions = [
  { label: '上海', value: '上海' },
  { label: '深圳', value: '深圳' },
  { label: '北京', value: '北京' }
]

// 市值范围选项
const marketValueOptions = [
  { label: '1', value: 1 },
  { label: '100亿', value: 10000000000 },
  { label: '200亿', value: 20000000000 },
  { label: '300亿', value: 30000000000 },
  { label: '500亿', value: 50000000000 },
  { label: '1000亿', value: 100000000000 },
  { label: '10000万亿', value: 10000000000000000 }
]

// 响应式数据 - 市值范围筛选
const selectedMarketValueMin = ref('')
const selectedMarketValueMax = ref('')

// 计算属性 - 使用memoization优化性能
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
  console.log(1111,selectedMarketValueMin.value)
  // 市值范围过滤
  if ((selectedMarketValueMin.value && selectedMarketValueMin.value !== '') || (selectedMarketValueMax.value && selectedMarketValueMax.value !== '')) {
    const minValue = selectedMarketValueMin.value !== '' ? parseFloat(selectedMarketValueMin.value) : -1;
    const maxValue = selectedMarketValueMax.value !== '' ? parseFloat(selectedMarketValueMax.value) : Infinity;
    
    console.log('市值筛选参数:', {
      minValue: selectedMarketValueMin.value,
      maxValue: selectedMarketValueMax.value,
      parsedMin: minValue,
      parsedMax: maxValue
    });
    
    stocks = stocks.filter(stock => {
      // 优先使用总市值，如果没有则使用流通市值
      const marketValue = parseFloat(stock.total_market_value || stock.circulating_market_value || '0');
      
      // 如果只设置了最小值
      if (selectedMarketValueMin.value !== '' && selectedMarketValueMax.value === '') {
        if (minValue === 0) {
          // 最小值为0时，筛选市值为0的股票
          return marketValue === 0;
        } else {
          // 其他情况筛选大于等于最小值的股票
          return marketValue >= minValue;
        }
      }
      // 如果只设置了最大值
      else if (selectedMarketValueMin.value === '' && selectedMarketValueMax.value !== '') {
        if (maxValue === 0) {
          // 最大值为0时，筛选市值为0的股票
          return marketValue === 0;
        } else {
          // 其他情况筛选小于等于最大值的股票
          return marketValue <= maxValue;
        }
      }
      // 如果同时设置了最小值和最大值
      else if (selectedMarketValueMin.value !== '' && selectedMarketValueMax.value !== '') {
        if (minValue === 0) {
          // 最小值为0时，筛选0到最大值范围的股票
          return marketValue >= 0 && marketValue <= maxValue;
        } else {
          // 其他情况筛选指定范围的股票
          return marketValue >= minValue && marketValue <= maxValue;
        }
      }
      
      return true;
    });
    
    console.log('市值筛选后股票数量:', stocks.length);
    // 显示前几只股票的市值信息作为示例
    if (stocks.length > 0) {
      console.log('筛选后的股票市值示例:', stocks.slice(0, 5).map(stock => ({
        code: stock.code,
        name: stock.name,
        total_market_value: stock.total_market_value,
        circulating_market_value: stock.circulating_market_value,
        parsed_value: parseFloat(stock.total_market_value || stock.circulating_market_value || '0')
      })));
    }
  }

  return stocks
})

// 缓存统计结果，避免重复计算
const statistics = computed(() => {
  const total = stockStore.stocks.length
  const boardStats = stockStore.boardStatistics
  
  // 使用Map优化查找性能
  const boardMap = new Map(boardStats.map(s => [s.board, s.count]))
  
  return [
    { label: '总股票数', count: total },
    { label: '主板', count: boardMap.get('主板') || 0 },
    { label: '创业板', count: boardMap.get('创业板') || 0 },
    { label: '科创板', count: boardMap.get('科创板') || 0 },
    { label: 'ST板', count: boardMap.get('ST板') || 0 },
    { label: '未知', count: boardMap.get('未知') || 0 }
  ]
})

// 方法
const handleSearch = () => {
  // currentPage.value = 1 // 移除分页
}

const handleBoardFilter = () => {
  // currentPage.value = 1 // 移除分页
}

const handleMarketFilter = () => {
  // currentPage.value = 1 // 移除分页
}

const handleMarketValueFilter = () => {
  console.log('市值筛选变化:', {
    min: selectedMarketValueMin.value,
    max: selectedMarketValueMax.value
  });
  
  // 显示当前筛选条件
  if (selectedMarketValueMin.value !== '' || selectedMarketValueMax.value !== '') {
    let filterDesc = '市值筛选: ';
    if (selectedMarketValueMin.value !== '' && selectedMarketValueMax.value !== '') {
      filterDesc += `${selectedMarketValueMin.value} 至 ${selectedMarketValueMax.value}`;
    } else if (selectedMarketValueMin.value !== '') {
      filterDesc += `≥ ${selectedMarketValueMin.value}`;
    } else if (selectedMarketValueMax.value !== '') {
      filterDesc += `≤ ${selectedMarketValueMax.value}`;
    }
    console.log(filterDesc);
  }
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

const handleKLineDetailDialogClose = () => {
  klineDetailDialogVisible.value = false
  selectedKLineData.value = null
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
    default: return 'info'
  }
}

const getBoardTagType = (board: string) => {
  switch (board) {
    case '主板': return 'info'
    case '创业板': return 'warning'
    case '科创板': return 'danger'
    case '北交所': return 'info'
    case 'ST板': return 'warning'
    case '三板': return 'success'
    case '未知': return 'info'
    default: return 'info'
  }
}

const getChangeClass = (change: number) => {
  if (!change) return ''
  return change > 0 ? 'positive' : change < 0 ? 'negative' : ''
}

// 解析K线数据字符串
const parseKLineData = (klineStr: string) => {
  // 数据格式: "2025-08-05,2.78,2.80,2.80,2.77,307077,85675466.00,1.08,0.72,0.02,1.13"
  // 对应: 日期,开盘价,最高价,收盘价,最低价,成交量,成交额,涨跌幅,振幅,涨跌额,换手率
  const parts = klineStr.split(',')
  
  if (parts.length >= 11) {
    return {
      date: parts[0],           // 日期
      open: parts[1],           // 开盘价
      high: parts[2],           // 最高价
      close: parts[3],          // 收盘价
      low: parts[4],            // 最低价
      volume: parts[5],         // 成交量
      turnover: parts[6],       // 成交额
      changePercent: parts[7],  // 涨跌幅
      amplitude: parts[8],      // 振幅
      changeAmount: parts[9],   // 涨跌额
      turnoverRate: parts[10]   // 换手率
    }
  }
  
  // 如果数据格式不正确，返回默认值
  return {
    date: '--',
    open: '0',
    high: '0',
    close: '0',
    low: '0',
    volume: '0',
    turnover: '0',
    changePercent: '0',
    amplitude: '0',
    changeAmount: '0',
    turnoverRate: '0'
  }
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
    return `${(volume / 100000000).toFixed(2)} 亿手`
  } else if (volume >= 10000) {
    return `${(volume / 10000).toFixed(2)} 万手`
  }
  return `${volume}手`
}

const formatAmount = (amount: number) => {
  if (!amount) return '--'
  if (amount >= 100000000) {
    return `${(amount / 100000000).toFixed(2)} 亿元`
  } else if (amount >= 10000) {
    return `${(amount / 10000).toFixed(2)} 万元`
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

// 安全的数值格式化工具函数
const safeNumberFormat = (value, decimals = 2, prefix = '', suffix = '') => {
  if (value && typeof value === 'number' && !isNaN(value)) {
    return `${prefix}${value.toFixed(decimals)}${suffix}`;
  }
  return '--';
};

const safePercentageFormat = (value) => {
  if (value && typeof value === 'number' && !isNaN(value)) {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  }
  return '0.00%';
};

const safeVolumeFormat = (value) => {
  if (value && typeof value === 'number' && !isNaN(value) && value > 0) {
    return `${(value / 10000).toFixed(2)} 万手`;
  }
  return '暂无数据';
};

const safeTurnoverFormat = (value) => {
  if (value && typeof value === 'number' && !isNaN(value) && value > 0) {
    return `${(value / 10000).toFixed(2)} 万元`;
  }
  return '暂无数据';
};

// 智能市值格式化函数 - 直接显示为亿单位
const formatMarketValue = (value) => {
  if (!value || parseFloat(value) <= 0) return '--';
  
  const numValue = parseFloat(value);
  
  // 将个为单位转换为亿元单位 (1亿 = 100,000,000)
  const billionValue = numValue / 100000000;
  
  // 直接显示为亿单位，保留2位小数
  return `${billionValue.toFixed(2)} 亿`;
};

// 主板小市值涨停筛选
const filterMainBoardLimitUp = async () => {
  try {
    filtering.value = true
    showFilterResults.value = false
    
    ElMessage.info('开始筛选主板小市值涨停股票...')
    
    // 步骤1：获取主板小市值股票
    const smallCapStocks = await stockStore.fetchMainBoardSmallCap()
    console.log('主板小市值股票数量:', smallCapStocks.length)
    
    if (smallCapStocks.length === 0) {
      ElMessage.warning('没有找到主板小市值股票')
      return
    }
    
    ElMessage.info(`找到 ${smallCapStocks.length} 只主板小市值股票，开始获取日线数据...`)
    
    // 步骤2：获取这些股票的代码
    const stockCodes = smallCapStocks.map(stock => stock.code)
    
    // 步骤3：筛选近10天内有过涨停的股票
    const limitUpStocks = await stockStore.filterLimitUpStocks(stockCodes)
    
    if (limitUpStocks.length > 0) {
      ElMessage.info(`找到 ${limitUpStocks.length} 只涨停股票，正在同步最新数据...`)
      
      // 步骤4：同步涨停股票的最新数据
      const limitUpCodes = limitUpStocks.map(stock => stock.code)
      try {
        const syncResult = await stockStore.syncStocksByCodes(limitUpCodes, 5) // 每批5只股票
        console.log('同步结果:', syncResult)
        ElMessage.success(`数据同步完成：成功 ${syncResult.successCount} 只，失败 ${syncResult.failCount} 只`)
      } catch (syncError) {
        console.error('同步数据失败:', syncError)
        ElMessage.warning('涨停股票筛选完成，但同步最新数据失败')
      }
    }
    
    // 显示筛选结果
    filteredLimitUpStocks.value = limitUpStocks
    showFilterResults.value = true
    
    ElMessage.success(`筛选完成！找到 ${limitUpStocks.length} 只近10天内有过涨停的股票`)
    
  } catch (error) {
    ElMessage.error(`筛选失败: ${error.message}`)
  } finally {
    filtering.value = false
  }
}

// 导出筛选结果到CSV
const exportFilterResultsToCSV = () => {
  const headers = ['股票代码', '涨停日期', '涨停幅度', '收盘价', '成交量', '成交额']
  const csvContent = [
    headers.join(','),
    ...filteredLimitUpStocks.value.map(stock => 
      [stock.code, stock.limitUpDate, stock.changePercent, stock.closePrice, stock.volume, stock.turnover].join(',')
    )
  ].join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `主板小市值涨停筛选结果_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

// 查看股票详情 (筛选结果)
const viewStockDetail = async (code: string) => {
  try {
    loading.value = true
    const stock = await stockStore.getStockByCode(code)
    if (stock) {
      selectedStock.value = stock
      detailDialogVisible.value = true
    } else {
      ElMessage.warning(`未找到股票代码为 ${code} 的详细信息`)
    }
  } catch (error) {
    ElMessage.error(`获取股票详情失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

// 选中项操作
const handleSelectAllChange = (val: boolean) => {
  if (val) {
    // 全选：将所有筛选后的股票添加到选中列表
    selectedStocks.value = [...filteredStocks.value]
    console.log('全选操作 - 已选择所有股票，总数:', selectedStocks.value.length)
    console.log('全选操作 - 选中的股票代码:', selectedStocks.value.map(stock => stock.code))
  } else {
    // 取消全选：清空选中列表
    selectedStocks.value = []
    console.log('全选操作 - 已取消全选，选中列表已清空')
  }
  isIndeterminate.value = false
}

const handleSelectionChange = (selection: Stock[]) => {
  selectedStocks.value = selection
  isIndeterminate.value = selection.length > 0 && selection.length < filteredStocks.value.length
  selectAll.value = selection.length === filteredStocks.value.length
};

const updateSelectAllState = () => {
  selectAll.value = selectedStocks.value.length === filteredStocks.value.length && filteredStocks.value.length > 0;
  isIndeterminate.value = selectedStocks.value.length > 0 && selectedStocks.value.length < filteredStocks.value.length;
};

const exportSelectedToCSV = () => {
  const headers = ['代码', '名称', '市场', '板块', '行业']
  const csvContent = [
    headers.join(','),
    ...selectedStocks.value.map(stock => 
      [stock.code, stock.name, stock.market, stock.board, stock.industry].join(',')
    )
  ].join('\n')
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `已选择股票列表_${new Date().toISOString().split('T')[0]}.csv`
  link.click()
}

const syncSelectedStocks = async () => {
  if (selectedStocks.value.length === 0) {
    ElMessage.warning('请先选择要同步的股票')
    return
  }

  try {
    loading.value = true
    
    const codes = selectedStocks.value.map(stock => stock.code)
    
    // 打印要同步的股票代码数组到控制台
    console.log('开始同步选中的股票，股票代码数组:', codes)
    console.log('选中股票数量:', selectedStocks.value.length)
    
    // 调用store的同步方法
    const syncResult = await stockStore.syncStocksByCodes(codes, 5) // 每批5只股票
    
    // 打印同步结果到控制台
    console.log('同步完成，结果:', syncResult)
    
    // 显示成功消息
    ElMessage.success(`已同步 ${syncResult.successCount} 只股票，失败 ${syncResult.failCount} 只，跳过 ${syncResult.delistedCount} 只退市股票`)
    
    // 同步完成后刷新股票列表，显示最新数据
    await stockStore.fetchStocks()
    
    // 打印同步后的股票数据到控制台
    console.log('同步完成后的股票数据已刷新')
    
    // 如果有退市股票被跳过，在控制台显示详细信息
    if (syncResult.delistedCount > 0) {
      console.log('跳过的退市股票代码:', syncResult.delistedCodes)
      console.log('跳过的退市股票名称:', syncResult.delistedNames)
    }
    
  } catch (error) {
    console.error('同步失败:', error)
    ElMessage.error(`同步失败: ${error.message}`)
  } finally {
    loading.value = false
  }
}

const clearSelection = () => {
  selectedStocks.value = []
  selectAll.value = false
  isIndeterminate.value = false
  // 打印清空选择后的状态
  console.log('清空选择 - 选中的股票代码:', selectedStocks.value.map(stock => stock.code))
}

// 计算有效股票数量
const getValidStocksCount = () => {
  return selectedStocks.value.filter(stock => {
    const name = stock.name
    // 与后端过滤逻辑保持一致：过滤掉名字包含"退市"或以"退"字结尾的股票
    return !name.includes('退市') && !name.endsWith('退')
  }).length
}

// 计算退市股票数量
const getDelistedStocksCount = () => {
  return selectedStocks.value.filter(stock => {
    const name = stock.name
    // 与后端过滤逻辑保持一致：名字包含"退市"或以"退"字结尾的股票
    return name.includes('退市') || name.endsWith('退')
  }).length
}

// 获取日线数据
const klineLoading = ref(false)
const klineResults = ref<any[]>([]) // 新增响应式数据用于存储日线数据结果
const showLimitUpOnly = ref(false) // 涨停筛选开关
const klineFetchMode = ref('batch') // 日线数据获取模式：batch 或 stream
const streamProgress = ref<any>(null) // 流式获取进度
const getSelectedStocksKLine = async () => {
  if (selectedStocks.value.length === 0) {
    ElMessage.warning('请先选择要获取日线数据的股票')
    return
  }

  try {
    klineLoading.value = true
    klineResults.value = [] // 清空之前的结果
    streamProgress.value = null // 清空流式进度
    
    const codes = selectedStocks.value.map(stock => stock.code)
    
    if (klineFetchMode.value === 'stream') {
      // 流式获取模式
      console.log('使用流式获取模式')
      
      // 初始化进度
      streamProgress.value = {
        percentage: 0,
        status: '',
        message: '开始获取日线数据...',
        current: 0,
        total: codes.length,
        successCount: 0,
        failCount: 0,
        batchInfo: ''
      }
      
      // 使用流式获取
      const result = await stockStore.fetchKLineDataStream(
        codes, 
        10,
        // 进度回调
        (event) => {
          console.log('收到进度更新:', event)
          
          switch (event.type) {
            case 'start':
              streamProgress.value.message = `开始处理 ${event.total} 只股票`
              streamProgress.value.total = event.total
              break
              
            case 'batch_start':
              streamProgress.value.batchInfo = `批次 ${event.batchNumber}/${event.totalBatches}`
              streamProgress.value.message = `开始处理批次 ${event.batchNumber}/${event.totalBatches}`
              break
              
            case 'processing':
              streamProgress.value.current = event.stockIndex
              streamProgress.value.message = `正在处理第 ${event.stockIndex}/${event.total} 只股票: ${event.code}`
              streamProgress.value.percentage = Math.round((event.stockIndex / event.total) * 100)
              break
              
            case 'success':
              streamProgress.value.successCount = event.successCount
              streamProgress.value.message = `股票 ${event.code} 获取成功`
              // 立即添加到结果中
              klineResults.value.push({
                code: event.code,
                success: true,
                data: event.data,
                error: null
              })
              break
              
            case 'error':
              streamProgress.value.failCount = event.failCount
              streamProgress.value.message = `股票 ${event.code} 获取失败`
              // 立即添加到结果中
              klineResults.value.push({
                code: event.code,
                success: false,
                data: null,
                error: event.error
              })
              break
              
            case 'batch_complete':
              streamProgress.value.message = `批次 ${event.batchNumber}/${event.totalBatches} 完成`
              streamProgress.value.successCount = event.successCount
              streamProgress.value.failCount = event.failCount
              break
              
            case 'complete':
              streamProgress.value.percentage = 100
              streamProgress.value.status = 'success'
              streamProgress.value.message = `获取完成！成功 ${event.successCount} 只，失败 ${event.failCount} 只`
              ElMessage.success(`日线数据获取完成：成功 ${event.successCount} 只，失败 ${event.failCount} 只`)
              break
              
            case 'delay':
              streamProgress.value.message = `等待中: ${event.message}`
              break
              
            case 'rest':
              streamProgress.value.message = `休息中: ${event.message}`
              break
          }
        }
      )
      
      // 流式获取完成后，设置loading为false
      klineLoading.value = false
      return result
      
    } else {
      // 批量获取模式（原有逻辑）
      console.log('使用批量获取模式')
      const result = await stockStore.fetchKLineData(codes, 10) // 获取最近10天数据
      ElMessage.success(`已获取 ${result.successCount} 只股票的日线数据，失败 ${result.failCount} 只`)
      
      // 将结果添加到 klineResults 中
      result.results.forEach(item => {
        klineResults.value.push({
          code: item.code,
          success: item.success,
          data: item.data,
          error: item.error
        })
      })
      
      if (result.failCount > 0) {
        console.warn('获取日线数据失败的股票:', result.failCodes)
      }
      
      return result
    }
    
  } catch (error) {
    ElMessage.error(`获取日线数据失败: ${error.message}`)
    streamProgress.value = null
  } finally {
    if (klineFetchMode.value !== 'stream') {
      klineLoading.value = false
    }
  }
}

// 重试获取日线数据
const retryGetKLine = async (code: string) => {
  const index = klineResults.value.findIndex(item => item.code === code);
  if (index !== -1 && klineResults.value[index].success === false) {
    try {
      klineLoading.value = true;
      const result = await stockStore.fetchKLineData([code], 10); // 只获取最近10天数据
      
      if (result.successCount > 0) {
        // 找到成功的结果
        const successResult = result.results.find(r => r.code === code && r.success);
        if (successResult) {
          klineResults.value[index].success = true;
          klineResults.value[index].data = successResult.data;
          klineResults.value[index].error = null;
          ElMessage.success(`股票 ${code} 的日线数据重新获取成功`);
        }
      } else {
        klineResults.value[index].error = `重新获取失败: ${result.results[0]?.error || '未知错误'}`;
        ElMessage.error(`股票 ${code} 的日线数据重新获取失败`);
      }
      
    } catch (error) {
      ElMessage.error(`重新获取日线数据失败: ${error.message}`);
      klineResults.value[index].error = `重新获取失败: ${error.message}`;
    } finally {
      klineLoading.value = false;
    }
  } else {
    ElMessage.warning(`股票代码 ${code} 的日线数据已成功获取或不存在失败记录。`);
  }
};

// 查看日线数据详情
const viewKLineDetail = (item: any) => {
  
  if (item.success) {
    // 设置选中的日线数据
    const data = item.data?.data
    selectedKLineData.value = {
      code: data.code,
      name: data.name || data.code,
      data: data.klines.reverse().slice(0, 10)
    }
    klineDetailDialogVisible.value = true
  } else {
    ElMessage.warning(`股票代码 ${item.code} 的日线数据为空或获取失败。`);
  }
};

// 导出日线数据结果到CSV
const exportKLineResultsToCSV = () => {
  const headers = ['股票代码', '状态', '数据条数', '最新日期', '最新收盘价', '最新涨跌幅', '错误信息'];
  const csvContent = [
    headers.join(','),
    ...klineResults.value.map(item => {
      const data = item.data || [];
      let latestDate = '--';
      let latestClose = '--';
      let latestChange = '--';
      
      if (data.length > 0) {
        const latestKLine = parseKLineData(data[0]);
        latestDate = latestKLine.date;
        latestClose = parseFloat(latestKLine.close).toFixed(2);
        latestChange = `${parseFloat(latestKLine.changePercent).toFixed(2)}%`;
      }
      
      return [
        item.code,
        item.success ? '成功' : '失败',
        data.length,
        latestDate,
        latestClose,
        latestChange,
        item.error || '--'
      ].join(',');
    })
  ].join('\n');
  
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `日线数据结果_${new Date().toISOString().split('T')[0]}.csv`
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
watch([searchQuery, selectedBoard, selectedMarket, selectedMarketValueMin, selectedMarketValueMax], () => {
  // currentPage.value = 1 // 移除分页
})

// 判断是否涨停
const isLimitUp = (changePercent: number, board: string) => {
  const change = parseFloat(changePercent.toString())
  
  // 根据板块判断涨停标准
  if (board === 'ST板' || board.includes('ST')) {
    return change >= 4.9 // ST股票涨停标准
  } else if (board === '创业板' || board === '科创板') {
    return change >= 19.8 // 创业板、科创板涨停标准
  } else {
    return change >= 9.8 // 主板、中小板涨停标准
  }
}

// 获取涨停标准描述
const getLimitUpStandard = (board: string) => {
  if (board === 'ST板' || board.includes('ST')) {
    return '4.9%'
  } else if (board === '创业板' || board === '科创板') {
    return '19.8%'
  } else {
    return '9.8%'
  }
}

// 筛选涨停股票
const filteredKLineResults = computed(() => {
  if (!showLimitUpOnly.value) {
    return klineResults.value
  }
  
  return klineResults.value.filter(item => {
    if (!item.success || !item.data || item.data.length === 0) {
      return false
    }
    
    // 检查最近10天内是否有涨停
    return item.data.data.klines.some((klineStr: string) => {
      const klineData = parseKLineData(klineStr)
      const changePercent = parseFloat(klineData.changePercent)
      
      // 从股票列表中获取板块信息
      const stock = stockStore.stocks.find(s => s.code === item.code)
      const board = stock?.board || '未知'
      
      return isLimitUp(changePercent, board)
    })
  })
})

const hasLimitUpIn10Days = (item: any) => {
  console.log('111',item)
  if (!item.success || !item.data || item.data.length === 0) return false;
  
  // 检查最近10天内是否有涨停
  return item.data.data.klines.some((klineStr: string) => {
    const klineData = parseKLineData(klineStr)
    const changePercent = parseFloat(klineData.changePercent)
    const board = getStockBoard(item.code)
    
    return isLimitUp(changePercent, board)
  })
}

const getStockBoard = (code: string) => {
  const stock = stockStore.stocks.find(s => s.code === code)
  return stock?.board || '未知'
}
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
.market-select,
.market-value-select {
  width: 150px;
}

.market-value-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.market-value-select {
  width: 120px;
}

.filter-separator {
  margin: 0 8px;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
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

.filter-results-section {
  margin-bottom: 20px;
}

.filter-results-card {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.filter-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-results-header span {
  font-weight: 500;
  color: #409eff;
}

.filter-results-table {
  margin-top: 20px;
}

.limit-up-date {
  color: #67c23a;
  font-weight: bold;
}

.limit-up-percent {
  font-size: 16px;
  font-weight: bold;
}

.close-price {
  font-size: 16px;
  font-weight: bold;
  color: #e6a23c;
}

.volume,
.turnover {
  font-size: 16px;
  font-weight: bold;
  color: #409eff;
}

.stock-table-section {
  margin-bottom: 20px;
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.data-limit-tip {
  font-size: 14px;
  color: #f56c6c;
  font-weight: bold;
}

.stock-table {
  margin-bottom: 20px;
}

.stock-table :deep(.el-table__body-wrapper) {
  max-height: 500px;
  overflow-y: auto;
}

.stock-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}

/* 优化表格行渲染性能 */
.stock-table :deep(.el-table__row) {
  will-change: auto;
}

.stock-table :deep(.el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 0;
}

/* 减少表格阴影和边框，提升性能 */
.stock-table :deep(.el-table) {
  box-shadow: none;
}

.stock-table :deep(.el-table__border-line) {
  display: none;
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

.selected-actions {
  margin-top: 20px;
}

.selected-actions-card {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.selected-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
}

.selected-info span {
  font-weight: 500;
  color: #409eff;
}

.selected-info .el-button {
  margin-left: 10px;
}

.selected-info .el-button:first-of-type {
  margin-left: 0;
}

.stock-detail,
.stock-quote {
  padding: 20px 0;
}

.price-text {
  font-size: 16px;
  font-weight: bold;
  color: #409eff;
}

.change-text {
  font-size: 16px;
  font-weight: bold;
}

.change-text.positive {
  color: #67c23a;
}

.change-text.negative {
  color: #f56c6c;
}

.market-value-text {
  font-size: 18px;
  font-weight: bold;
  color: #e6a23c;
}

.no-data {
  color: #999;
  font-style: italic;
}

.error-text {
  color: #f56c6c;
  font-weight: bold;
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
  .market-select,
  .market-value-select {
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

.stock-table-v2 {
  margin-bottom: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.stock-table-v2 :deep(.el-table-v2__header) {
  background-color: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.stock-table-v2 :deep(.el-table-v2__header-cell) {
  background-color: #fafafa;
  color: #606266;
  font-weight: 500;
  border-right: 1px solid #ebeef5;
}

.stock-table-v2 :deep(.el-table-v2__row) {
  border-bottom: 1px solid #f0f0f0;
}

.stock-table-v2 :deep(.el-table-v2__row:hover) {
  background-color: #f5f7fa;
}

.stock-table-v2 :deep(.el-table-v2__cell) {
  border-right: 1px solid #f0f0f0;
  padding: 8px 12px;
}

.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.selection-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #ebeef5;
}

.selection-controls .el-checkbox {
  margin-right: 15px;
}

.kline-results-section {
  margin-top: 20px;
}

.kline-results-card {
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
}

.kline-results-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.kline-results-info {
  display: flex;
  align-items: center;
}

.kline-results-info span {
  font-weight: 500;
  color: #409eff;
}

.kline-results-actions {
  display: flex;
  align-items: center;
}

.limit-up-details {
  margin-top: 5px;
}

.kline-results-table {
  margin-top: 20px;
}

.kline-results-table :deep(.el-table__body-wrapper) {
  max-height: 400px;
  overflow-y: auto;
}

.kline-results-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}

/* 优化表格行渲染性能 */
.kline-results-table :deep(.el-table__row) {
  will-change: auto;
}

.kline-results-table :deep(.el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 0;
}

/* 减少表格阴影和边框，提升性能 */
.kline-results-table :deep(.el-table) {
  box-shadow: none;
}

.kline-results-table :deep(.el-table__border-line) {
  display: none;
}

.kline-data-table {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.kline-data-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}

.kline-data-table :deep(.el-table__row) {
  will-change: auto;
}

.kline-data-table :deep(.el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 0;
}

.raw-data-section {
  margin-top: 20px;
}

.raw-data-content {
  background: #f9f9f9;
  padding: 10px;
  border-radius: 6px;
}

.kline-header {
  margin-bottom: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #e6f7ff 0%, #f0f9ff 100%);
  border-radius: 6px;
  border: 1px solid #d9ecff;
}

.kline-header h3 {
  margin: 0 0 10px 0;
  color: #409eff;
  font-size: 18px;
}

.kline-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.kline-data-table {
  margin-top: 20px;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}

.kline-data-table :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 10;
  background: white;
}

.kline-data-table :deep(.el-table__row) {
  will-change: auto;
}

.kline-data-table :deep(.el-table__cell) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 8px 0;
}

.raw-data-section {
  margin-top: 20px;
  padding: 15px;
  background: #f9f9f9;
  border-radius: 6px;
}

.raw-data-section h4 {
  margin: 0 0 15px 0;
  color: #666;
  font-size: 16px;
}

.raw-data-content {
  background: #f9f9f9;
  padding: 10px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.4;
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e4e7ed;
}

.selected-actions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selected-actions-buttons {
  display: flex;
  gap: 10px;
}

.kline-options {
  margin-top: 10px;
}

.kline-options-content {
  display: flex;
  align-items: center;
}

.kline-options .el-radio-group {
  margin-right: 10px;
}

.stream-progress {
  margin-top: 10px;
}

.progress-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.progress-info {
  margin-top: 5px;
  font-size: 14px;
  color: #666;
}

.progress-details {
  margin-top: 5px;
}

.progress-details .el-tag {
  margin-right: 5px;
}
</style> 
