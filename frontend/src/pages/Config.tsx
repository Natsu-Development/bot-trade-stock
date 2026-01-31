import { useState } from 'react';
import { Plus, Edit3, Trash, Settings } from 'lucide-react';
import { TradingConfig } from '../services';
import { useUiStore } from '../store';

export function ConfigPage() {
  const [configs, setConfigs] = useState<TradingConfig[]>([
    {
      id: 'default-strategy',
      rsi_period: 14,
      start_date_offset: 90,
      divergence: {
        lookback_left: 5,
        lookback_right: 5,
        range_min: 5,
        range_max: 50,
        indices_recent: 3,
      },
      early_detection_enabled: true,
      bearish_symbols: ['VCB', 'VIC'],
      bullish_symbols: ['FPT', 'MWG', 'HPG', 'STB', 'VPB'],
      telegram: {
        enabled: true,
      },
    },
    {
      id: 'aggressive-bullish',
      rsi_period: 10,
      start_date_offset: 60,
      divergence: {
        lookback_left: 3,
        lookback_right: 3,
        range_min: 3,
        range_max: 40,
        indices_recent: 2,
      },
      early_detection_enabled: true,
      bearish_symbols: [],
      bullish_symbols: ['FPT', 'VCB', 'VIC', 'MWG', 'HPG', 'STB', 'VPB', 'ACB', 'MBB', 'CTG'],
      telegram: {
        enabled: false,
      },
    },
  ]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TradingConfig | null>(null);
  const [activeTab, setActiveTab] = useState('trading');

  const { addToast } = useUiStore();

  const [formData, setFormData] = useState<TradingConfig>({
    rsi_period: 14,
    start_date_offset: 90,
    divergence: {
      lookback_left: 5,
      lookback_right: 5,
      range_min: 5,
      range_max: 50,
      indices_recent: 3,
    },
    early_detection_enabled: false,
    bearish_symbols: [],
    bullish_symbols: [],
    telegram: {
      enabled: false,
      bot_token: '',
      chat_id: '',
    },
  });

  const tabs = [
    { id: 'trading', label: 'Trading' },
    { id: 'divergence', label: 'Divergence' },
    { id: 'symbols', label: 'Symbols' },
    { id: 'telegram', label: 'Telegram' },
  ];

  const handleCreate = () => {
    setEditingConfig(null);
    setFormData({
      rsi_period: 14,
      start_date_offset: 90,
      divergence: {
        lookback_left: 5,
        lookback_right: 5,
        range_min: 5,
        range_max: 50,
        indices_recent: 3,
      },
      early_detection_enabled: false,
      bearish_symbols: [],
      bullish_symbols: [],
      telegram: {
        enabled: false,
        bot_token: '',
        chat_id: '',
      },
    });
    setActiveTab('trading');
    setIsModalOpen(true);
  };

  const handleEdit = (config: TradingConfig) => {
    setEditingConfig(config);
    setFormData(config);
    setActiveTab('trading');
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this configuration?')) {
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      addToast({ type: 'success', message: 'Configuration deleted' });
    }
  };

  const handleSave = () => {
    if (editingConfig?.id) {
      setConfigs((prev) =>
        prev.map((c) => (c.id === editingConfig.id ? { ...formData, id: c.id } : c))
      );
      addToast({ type: 'success', message: 'Configuration updated' });
    } else {
      setConfigs((prev) => [...prev, { ...formData, id: `config-${Date.now()}` }]);
      addToast({ type: 'success', message: 'Configuration created' });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>Configuration</h1>
          <p>Manage your trading strategies</p>
        </div>
        <div className="header-right">
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus width={16} height={16} strokeWidth={2} />
            New Config
          </button>
        </div>
      </header>

      {/* Configs */}
      <div className="glass-card">
        <div className="config-list">
          {configs.map((config) => (
            <div key={config.id} className="config-item">
              <div className="config-info">
                <div className="config-icon">
                  <Settings width={20} height={20} strokeWidth={2} />
                </div>
                <div>
                  <div className="config-name">
                    {config.id === 'default-strategy' ? 'Default Strategy' : 'Aggressive Bullish'}
                  </div>
                  <div className="config-meta">
                    RSI: {config.rsi_period} | Symbols: {config.bullish_symbols.length} stocks | Telegram: {config.telegram.enabled ? 'Enabled' : 'Disabled'}
                  </div>
                </div>
              </div>
              <div className="config-actions">
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => handleEdit(config)}
                  title="Edit"
                >
                  <Edit3 width={16} height={16} strokeWidth={2} />
                </button>
                <button
                  className="btn btn-secondary btn-icon"
                  onClick={() => handleDelete(config.id!)}
                  title="Delete"
                  style={{ color: 'var(--danger)' }}
                >
                  <Trash width={16} height={16} strokeWidth={2} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="dialog-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3 className="dialog-title">
                {editingConfig?.id ? 'Edit Configuration' : 'New Configuration'}
              </h3>
              <button
                className="btn btn-secondary btn-icon"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn('tab', activeTab === tab.id && 'active')}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="dialog-body">
              {activeTab === 'trading' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">RSI Period</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.rsi_period}
                      onChange={(e) => setFormData({ ...formData, rsi_period: parseInt(e.target.value) || 14 })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Start Date Offset (days)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={formData.start_date_offset}
                      onChange={(e) => setFormData({ ...formData, start_date_offset: parseInt(e.target.value) || 90 })}
                    />
                  </div>
                  <div className="filter-chips">
                    <button
                      className={cn('filter-chip', formData.early_detection_enabled && 'active')}
                      onClick={() => setFormData({ ...formData, early_detection_enabled: !formData.early_detection_enabled })}
                    >
                      Early Detection {formData.early_detection_enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'divergence' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Lookback Left</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.divergence.lookback_left}
                        onChange={(e) => setFormData({
                          ...formData,
                          divergence: { ...formData.divergence, lookback_left: parseInt(e.target.value) || 5 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Lookback Right</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.divergence.lookback_right}
                        onChange={(e) => setFormData({
                          ...formData,
                          divergence: { ...formData.divergence, lookback_right: parseInt(e.target.value) || 5 }
                        })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label className="form-label">Range Min</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.divergence.range_min}
                        onChange={(e) => setFormData({
                          ...formData,
                          divergence: { ...formData.divergence, range_min: parseInt(e.target.value) || 5 }
                        })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Range Max</label>
                      <input
                        type="number"
                        className="form-input"
                        value={formData.divergence.range_max}
                        onChange={(e) => setFormData({
                          ...formData,
                          divergence: { ...formData.divergence, range_max: parseInt(e.target.value) || 50 }
                        })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'symbols' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Bullish Symbols (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.bullish_symbols.join(', ')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bullish_symbols: e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s)
                        })
                      }
                      placeholder="VCB, VIC, FPT, MWG..."
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bearish Symbols (comma-separated)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.bearish_symbols.join(', ')}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          bearish_symbols: e.target.value.split(',').map((s) => s.trim().toUpperCase()).filter((s) => s)
                        })
                      }
                      placeholder="VCB, VIC, FPT..."
                    />
                  </div>
                </div>
              )}

              {activeTab === 'telegram' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="filter-chips">
                    <button
                      className={cn('filter-chip', formData.telegram.enabled && 'active')}
                      onClick={() => setFormData({
                        ...formData,
                        telegram: { ...formData.telegram, enabled: !formData.telegram.enabled }
                      })}
                    >
                      {formData.telegram.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>
                  {formData.telegram.enabled && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Bot Token</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.telegram.bot_token || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              telegram: { ...formData.telegram, bot_token: e.target.value }
                            })
                          }
                          placeholder="Enter bot token from @BotFather"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Chat ID</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.telegram.chat_id || ''}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              telegram: { ...formData.telegram, chat_id: e.target.value }
                            })
                          }
                          placeholder="Enter chat ID"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="dialog-footer">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                {editingConfig?.id ? 'Save Changes' : 'Create Config'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
