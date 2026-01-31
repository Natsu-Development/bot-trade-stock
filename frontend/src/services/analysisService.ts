import { apiClient } from './api';
import { AnalysisResult } from './types';

export const analysisService = {
  // Analyze bullish divergence
  async analyzeBullish(symbol: string, params?: {
    start_date?: string;
    end_date?: string;
    interval?: string;
    config_id?: string;
  }): Promise<AnalysisResult> {
    const response = await apiClient.get<AnalysisResult>(`/analyze/${symbol}/divergence/bullish`, {
      params,
    });
    return response.data;
  },

  // Analyze bearish divergence
  async analyzeBearish(symbol: string, params?: {
    start_date?: string;
    end_date?: string;
    interval?: string;
    config_id?: string;
  }): Promise<AnalysisResult> {
    const response = await apiClient.get<AnalysisResult>(`/analyze/${symbol}/divergence/bearish`, {
      params,
    });
    return response.data;
  },
};
