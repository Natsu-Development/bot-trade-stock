// API Types matching backend Go structs

// Health Check
export interface HealthResponse {
  status: string;
  timestamp: string;
}

// Stock Metrics Types
export interface CacheInfo {
  cached: boolean;
  cached_at?: string;
  total_stocks?: number;
  message?: string;
}

export interface RefreshResponse {
  message: string;
  total_stocks: number;
  stocks_ranked: number;
  calculated_at: string;
}

export interface FilterCondition {
  field: FilterField;
  operator: FilterOperator;
  value: number;
}

export type FilterField =
  | 'rs_1m'
  | 'rs_3m'
  | 'rs_6m'
  | 'rs_9m'
  | 'rs_52w'
  | 'volume_vs_sma'
  | 'current_volume'
  | 'volume_sma20';

export type FilterOperator = '>=' | '<=' | '>' | '<' | '=';

export type FilterLogic = 'and' | 'or';

export type Exchange = 'HOSE' | 'HNX' | 'UPCOM';

export interface FilterRequest {
  conditions: FilterCondition[];
  logic?: FilterLogic;
  exchanges?: Exchange[];
}

export interface StockMetrics {
  symbol: string;
  exchange: string;
  rs_1m?: number;
  rs_3m?: number;
  rs_6m?: number;
  rs_9m?: number;
  rs_52w?: number;
  volume_vs_sma?: number;
  current_volume?: number;
  volume_sma20?: number;
  last_price?: number;
  price_change?: number;
  price_change_percent?: number;
}

export interface FilterResponse {
  results: StockMetrics[];
  total: number;
  filtered: number;
}

// Divergence Analysis Types
export interface AnalysisRequest {
  symbol: string;
  start_date?: string;
  end_date?: string;
  interval?: string;
  config_id?: string;
}

export interface PivotPoint {
  index: number;
  date: string;
  value: number;
  is_high: boolean;
}

export interface DivergencePattern {
  type: 'regular' | 'hidden';
  start_index: number;
  end_index: number;
  start_date: string;
  end_date: string;
  start_value: number;
  end_value: number;
  strength: number;
}

export interface AnalysisResult {
  symbol: string;
  interval: string;
  analysis_type: 'bullish' | 'bearish';
  analyzed: boolean;
  divergences: DivergencePattern[];
  pivot_points: PivotPoint[];
  current_rsi: number;
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  message: string;
}

// Config Types
export interface DivergenceConfig {
  lookback_left: number;
  lookback_right: number;
  range_min: number;
  range_max: number;
  indices_recent: number;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token?: string;
  chat_id?: string;
}

export interface TradingConfig {
  id?: string;
  rsi_period: number;
  start_date_offset: number;
  divergence: DivergenceConfig;
  early_detection_enabled: boolean;
  bearish_symbols: string[];
  bullish_symbols: string[];
  telegram: TelegramConfig;
  created_at?: string;
  updated_at?: string;
}

export interface ConfigResponse {
  configs?: TradingConfig[];
  config?: TradingConfig;
  config_id?: string;
  message?: string;
}

// API Error
export interface ApiError {
  error: string;
  details?: string;
  example?: unknown;
}
