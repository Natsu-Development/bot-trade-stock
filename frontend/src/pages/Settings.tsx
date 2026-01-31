import { useEffect, useState } from 'react';
import { RefreshCw, Database, Server, Info } from 'lucide-react';
import { stockService } from '../services';
import { useUiStore } from '../store';
import { useApi } from '../hooks';

export function Settings() {
  const [cacheInfo, setCacheInfo] = useState<any>({ cached: false });
  const { addToast } = useUiStore();
  const { execute: refreshCache, isLoading } = useApi({
    showToasts: true,
    successMessage: 'Cache refreshed successfully',
  });

  useEffect(() => {
    const fetchCacheInfo = async () => {
      const result = await stockService.getCacheInfo();
      setCacheInfo(result);
    };
    fetchCacheInfo();
  }, []);

  const handleRefreshCache = async () => {
    const result = await refreshCache(() => stockService.refreshCache());
    if (result) {
      const cacheResult = await stockService.getCacheInfo();
      setCacheInfo(cacheResult);
    }
  };

  const handleClearCache = () => {
    addToast({ type: 'info', message: 'Cache cleared (simulated)' });
  };

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <header className="header">
        <div className="header-left">
          <h1>Settings</h1>
          <p>System configuration and preferences</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        {/* Cache Management */}
        <div className="glass-card">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon purple">
                <Database width={24} height={24} strokeWidth={2} />
              </div>
              <h2 className="section-title">Cache Management</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>Cache Status</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: '4px' }}>
                  {cacheInfo.cached
                    ? `Cached at ${cacheInfo.cached_at ? new Date(cacheInfo.cached_at).toLocaleString() : 'N/A'}`
                    : 'Cache is empty'}
                </div>
              </div>
              <span className="rs-badge" style={{
                background: cacheInfo.cached ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                color: cacheInfo.cached ? 'var(--success)' : 'var(--warning)',
              }}>
                {cacheInfo.cached ? 'Ready' : 'Empty'}
              </span>
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <div>
                <div style={{ fontWeight: 500 }}>Total Stocks</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: '4px' }}>
                  {cacheInfo.total_stocks || 0} stocks cached
                </div>
              </div>
              <div className="stat-value" style={{ fontSize: '20px' }}>
                {cacheInfo.total_stocks || 0}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleRefreshCache}
                disabled={isLoading}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                <RefreshCw width={16} height={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                Refresh Cache
              </button>
              <button
                onClick={handleClearCache}
                disabled={!cacheInfo.cached}
                className="btn btn-secondary"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {/* API Status */}
        <div className="glass-card">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon cyan">
                <Server width={24} height={24} strokeWidth={2} />
              </div>
              <h2 className="section-title">API Status</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="status-dot"></span>
                <span style={{ fontWeight: 500 }}>Backend API</span>
              </div>
              <span className="rs-badge rs-high">Connected</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="status-dot"></span>
                <span style={{ fontWeight: 500 }}>Data Provider</span>
              </div>
              <span className="rs-badge rs-high">Vietcap</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="glass-card">
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="stat-icon pink">
                <Info width={24} height={24} strokeWidth={2} />
              </div>
              <h2 className="section-title">System Info</h2>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Application</span>
              <span style={{ fontWeight: 500 }}>Trading Dashboard</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Version</span>
              <span style={{ fontWeight: 500, fontFamily: 'JetBrains Mono' }}>1.0.0</span>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px',
              background: 'var(--glass-bg)',
              borderRadius: '12px',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>Environment</span>
              <span className="rs-badge rs-medium">Development</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
