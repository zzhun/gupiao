export interface Stock {
  id: number;
  code: string;
  name: string;
  market: string;
  board: string;
  industry: string;
  created_at: string;
  updated_at: string;
}

export interface BoardStatistics {
  board: string;
  count: number;
}

export interface RealTimeData {
  f43: number; // 当前价格
  f57: string; // 股票名称
  f58: string; // 股票代码
  f169: number; // 涨跌幅
  f170: number; // 涨跌幅
  f46: number; // 今开
  f44: number; // 最高
  f51: number; // 最低
  f168: number; // 昨收
  f47: number; // 成交量
  f48: number; // 成交额
}

export interface StockQuote {
  code: string;
  name: string;
  market: string;
  board: string;
  industry: string;
  realTimeData: RealTimeData;
}
