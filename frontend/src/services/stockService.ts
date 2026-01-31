import { apiClient } from './api';
import { CacheInfo, RefreshResponse, FilterRequest, FilterResponse } from './types';

export const stockService = {
  // Get cache info
  async getCacheInfo(): Promise<CacheInfo> {
    const response = await apiClient.get<CacheInfo>('/stocks/cache-info');
    return response.data;
  },

  // Refresh stock metrics cache
  async refreshCache(): Promise<RefreshResponse> {
    const response = await apiClient.post<RefreshResponse>('/stocks/refresh');
    return response.data;
  },

  // Filter stocks
  async filterStocks(request: FilterRequest): Promise<FilterResponse> {
    const response = await apiClient.post<FilterResponse>('/stocks/filter', request);
    return response.data;
  },
};
