import { apiClient } from './api';
import { TradingConfig, ConfigResponse } from './types';

export const configService = {
  // Create a new config
  async createConfig(config: TradingConfig): Promise<ConfigResponse> {
    const response = await apiClient.post<ConfigResponse>('/config', config);
    return response.data;
  },

  // Get a config by ID
  async getConfig(id: string): Promise<TradingConfig> {
    const response = await apiClient.get<TradingConfig>(`/config/${id}`);
    return response.data;
  },

  // Update a config
  async updateConfig(id: string, config: TradingConfig): Promise<TradingConfig> {
    const response = await apiClient.put<TradingConfig>(`/config/${id}`, config);
    return response.data;
  },

  // Delete a config
  async deleteConfig(id: string): Promise<{ message: string }> {
    const response = await apiClient.delete<{ message: string }>(`/config/${id}`);
    return response.data;
  },
};
