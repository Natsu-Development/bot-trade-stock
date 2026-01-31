import { useEffect, useState } from 'react';
import { RefreshCw, Activity, TrendingUp, TrendingDown } from 'lucide-react';
import { stockService } from '../services';
import { useApi } from '../hooks';

export function Dashboard() {
  const [cacheInfo, setCacheInfo] = useState<any>({ cached: false });
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="header fade-in">
        <div className="header-left">
          <h1>Trading Dashboard</h1>
          <p>Welcome back! Here's your market overview</p>
        </div>
        <div className="header-right">
          <div className="status-badge">
            <span className="status-dot"></span>
            <span>{cacheInfo.cached ? 'System Healthy' : 'Cache Empty'}</span>
          </div>
          <button className="btn btn-primary" onClick={handleRefreshCache} disabled={isLoading}>
            <RefreshCw width={16} height={16} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            Refresh Data
          </button>
          <div className="avatar">Z</div>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="glass-card stat-card fade-in delay-1">
          <div className="stat-icon cyan">
            <Activity width={24} height={24} strokeWidth={2} />
          </div>
          <div className="stat-label">Total Stocks</div>
          <div className="stat-value">{cacheInfo.total_stocks || '1,847'}</div>
          <span className="stat-change positive">
            <TrendingUp width={12} height={12} strokeWidth={2} />
            +{cacheInfo.total_stocks ? Math.floor(cacheInfo.total_stocks / 50) : 23} new
          </span>
        </div>

        <div className="glass-card stat-card fade-in delay-2">
          <div className="stat-icon green">
            <TrendingUp width={24} height={24} strokeWidth={2} />
          </div>
          <div className="stat-label">Bullish Signals</div>
          <div className="stat-value">42</div>
          <span className="stat-change positive">
            <TrendingUp width={12} height={12} strokeWidth={2} />
            +8 today
          </span>
        </div>

        <div className="glass-card stat-card fade-in delay-3">
          <div className="stat-icon pink">
            <TrendingDown width={24} height={24} strokeWidth={2} />
          </div>
          <div className="stat-label">Bearish Signals</div>
          <div className="stat-value">18</div>
          <span className="stat-change negative">
            <TrendingDown width={12} height={12} strokeWidth={2} />
            -3 today
          </span>
        </div>

        <div className="glass-card stat-card fade-in delay-4">
          <div className="stat-icon purple">
            <Activity width={24} height={24} strokeWidth={2} />
          </div>
          <div className="stat-label">Active Configs</div>
          <div className="stat-value">5</div>
          <span className="stat-change positive">
            <Activity width={12} height={12} strokeWidth={2} style={{ transform: 'rotate(90deg)' }} />
            2 running
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="content-grid">
        {/* Top RS Rating Stocks */}
        <div className="glass-card fade-in delay-4">
          <div className="section-header">
            <div>
              <h2 className="section-title">Top RS Rating Stocks</h2>
              <p className="section-subtitle">Filtered by RS 52W &gt;= 80</p>
            </div>
            <button className="btn btn-secondary">View All</button>
          </div>

          <table className="stock-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>RS 1M</th>
                <th>RS 3M</th>
                <th>RS 6M</th>
                <th>RS 52W</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="stock-symbol">FPT</div>
                  <div className="stock-exchange">HOSE</div>
                </td>
                <td><span className="rs-badge rs-high">92</span></td>
                <td><span className="rs-badge rs-high">88</span></td>
                <td><span className="rs-badge rs-high">85</span></td>
                <td><span className="rs-badge rs-high">91</span></td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--success)' }}>+125%</td>
              </tr>
              <tr>
                <td>
                  <div className="stock-symbol">VCB</div>
                  <div className="stock-exchange">HOSE</div>
                </td>
                <td><span className="rs-badge rs-high">85</span></td>
                <td><span className="rs-badge rs-high">82</span></td>
                <td><span className="rs-badge rs-medium">78</span></td>
                <td><span className="rs-badge rs-high">86</span></td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--success)' }}>+67%</td>
              </tr>
              <tr>
                <td>
                  <div className="stock-symbol">VIC</div>
                  <div className="stock-exchange">HOSE</div>
                </td>
                <td><span className="rs-badge rs-high">88</span></td>
                <td><span className="rs-badge rs-high">84</span></td>
                <td><span className="rs-badge rs-high">81</span></td>
                <td><span className="rs-badge rs-high">83</span></td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--warning)' }}>+34%</td>
              </tr>
              <tr>
                <td>
                  <div className="stock-symbol">MWG</div>
                  <div className="stock-exchange">HOSE</div>
                </td>
                <td><span className="rs-badge rs-high">81</span></td>
                <td><span className="rs-badge rs-medium">76</span></td>
                <td><span className="rs-badge rs-medium">72</span></td>
                <td><span className="rs-badge rs-high">80</span></td>
                <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--danger)' }}>-12%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Sidebar Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Actions */}
          <div className="glass-card fade-in delay-4">
            <div className="section-header">
              <h2 className="section-title">Quick Actions</h2>
            </div>
            <div className="quick-actions">
              <div className="glass-card action-card" onClick={handleRefreshCache}>
                <div className="action-icon">🔄</div>
                <div className="action-title">Refresh Cache</div>
                <div className="action-desc">Update all metrics</div>
              </div>
              <div className="glass-card action-card">
                <div className="action-icon">📈</div>
                <div className="action-title">Bullish Scan</div>
                <div className="action-desc">Find opportunities</div>
              </div>
              <div className="glass-card action-card">
                <div className="action-icon">📉</div>
                <div className="action-title">Bearish Scan</div>
                <div className="action-desc">Exit signals</div>
              </div>
              <div className="glass-card action-card">
                <div className="action-icon">⚙️</div>
                <div className="action-title">New Config</div>
                <div className="action-desc">Create strategy</div>
              </div>
            </div>
          </div>

          {/* Latest Analysis */}
          <div className="glass-card fade-in delay-5">
            <div className="section-header">
              <h2 className="section-title">Latest Analysis</h2>
            </div>
            <div className="analysis-result">
              <div className="result-header">
                <div className="result-icon bullish">
                  <TrendingUp width={20} height={20} strokeWidth={2} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontFamily: 'JetBrains Mono' }}>FPT</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>2 mins ago</div>
                </div>
                <span className="result-badge bullish">Bullish Divergence</span>
              </div>
              <div className="result-details">
                <div className="result-item">
                  <div className="result-item-label">Current Price</div>
                  <div className="result-item-value">₫125,400</div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">RSI (14)</div>
                  <div className="result-item-value">42.5</div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">Signal Strength</div>
                  <div className="result-item-value" style={{ color: 'var(--success)' }}>Strong</div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">Processing</div>
                  <div className="result-item-value">128ms</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
