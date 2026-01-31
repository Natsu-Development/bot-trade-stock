import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { analysisService } from '../services';
import { useApi } from '../hooks';

const intervalOptions = [
  { value: 'H1', label: '1 Hour' },
  { value: 'H4', label: '4 Hours' },
  { value: 'D1', label: 'Daily' },
  { value: 'W1', label: 'Weekly' },
];

export function Divergence() {
  const [searchParams] = useSearchParams();
  const symbolParam = searchParams.get('symbol');

  const [symbol, setSymbol] = useState('');
  const [interval, setInterval] = useState('D1');
  const [type, setType] = useState<'bullish' | 'bearish'>('bullish');
  const [result, setResult] = useState<any>(null);

  const { execute: analyze, isLoading } = useApi({
    showToasts: true,
    successMessage: 'Analysis completed',
  });

  useEffect(() => {
    if (symbolParam) {
      setSymbol(symbolParam.toUpperCase());
      performAnalysis(symbolParam.toUpperCase(), 'D1', 'bullish');
    }
  }, [symbolParam]);

  const performAnalysis = async (sym: string, int: string, analysisType: 'bullish' | 'bearish') => {
    const analysisFn =
      analysisType === 'bullish'
        ? () => analysisService.analyzeBullish(sym, { interval: int })
        : () => analysisService.analyzeBearish(sym, { interval: int });

    const analysisResult = await analyze(analysisFn);
    if (analysisResult) {
      setResult(analysisResult);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim()) return;
    performAnalysis(symbol.toUpperCase(), interval, type);
  };

  const getSignalBadge = (signal: string) => {
    const baseClass = 'result-badge';
    if (signal.includes('buy')) return `${baseClass} bullish`;
    if (signal.includes('sell')) return `${baseClass} bearish`;
    return baseClass;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="header fade-in">
        <div className="header-left">
          <h1>Divergence Analysis</h1>
          <p>Detect bullish and bearish divergence patterns</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px' }}>
        {/* Analysis Form */}
        <div className="glass-card fade-in delay-1">
          <div className="section-header">
            <h2 className="section-title">Analysis</h2>
          </div>
          <form onSubmit={handleSubmit}>
            {/* Symbol Input */}
            <div className="form-group">
              <label className="form-label">Symbol</label>
              <input
                type="text"
                className="form-input"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="Enter symbol (e.g., VCB, VIC)"
                required
              />
            </div>

            {/* Interval Selector */}
            <div className="form-group">
              <label className="form-label">Interval</label>
              <div className="filter-chips">
                {intervalOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setInterval(option.value)}
                    className={cn('filter-chip', interval === option.value && 'active')}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Analysis Type */}
            <div className="form-group">
              <label className="form-label">Analysis Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setType('bullish')}
                  className={cn('filter-chip', type === 'bullish' && 'active')}
                  style={{ width: '100%' }}
                >
                  <TrendingUp width={16} height={16} strokeWidth={2} style={{ marginRight: '4px' }} />
                  Bullish
                </button>
                <button
                  type="button"
                  onClick={() => setType('bearish')}
                  className={cn('filter-chip', type === 'bearish' && 'active')}
                  style={{ width: '100%' }}
                >
                  <TrendingDown width={16} height={16} strokeWidth={2} style={{ marginRight: '4px' }} />
                  Bearish
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !symbol.trim()}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              {isLoading ? 'Analyzing...' : 'Analyze Divergence'}
            </button>
          </form>
        </div>

        {/* Results */}
        <div className="glass-card fade-in delay-2">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div className="spinner" style={{ marginBottom: '16px' }}></div>
              <div style={{ color: 'var(--text-secondary)' }}>Analyzing divergence patterns...</div>
            </div>
          ) : !result ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
              Enter a symbol and click "Analyze Divergence" to see results
            </div>
          ) : (
            <div className="analysis-result">
              <div className="result-header">
                <div className={cn('result-icon', type)}>
                  {type === 'bullish' ? (
                    <TrendingUp width={20} height={20} strokeWidth={2} />
                  ) : (
                    <TrendingDown width={20} height={20} strokeWidth={2} />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontFamily: 'JetBrains Mono', fontSize: '18px' }}>
                    {result.symbol}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {result.interval} • {new Date().toLocaleTimeString()}
                  </div>
                </div>
                <span className={getSignalBadge(result.signal)}>{result.signal.replace('_', ' ')}</span>
              </div>

              <p style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>{result.message}</p>

              <div className="result-details">
                <div className="result-item">
                  <div className="result-item-label">Current RSI</div>
                  <div className="result-item-value">{result.current_rsi?.toFixed(1) || '-'}</div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">Status</div>
                  <div className="result-item-value" style={{
                    color: result.current_rsi > 70 ? 'var(--danger)' : result.current_rsi < 30 ? 'var(--success)' : 'var(--text-primary)'
                  }}>
                    {result.current_rsi > 70 ? 'Overbought' : result.current_rsi < 30 ? 'Oversold' : 'Neutral'}
                  </div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">Confidence</div>
                  <div className="result-item-value">{result.confidence}%</div>
                </div>
                <div className="result-item">
                  <div className="result-item-label">Divergences</div>
                  <div className="result-item-value">{result.divergences?.length || 0}</div>
                </div>
              </div>

              {/* Pivot Points */}
              {result.pivot_points && result.pivot_points.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px', color: 'var(--text-primary)' }}>
                    Pivot Points ({result.pivot_points.length})
                  </h3>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                    gap: '8px'
                  }}>
                    {result.pivot_points.slice(0, 16).map((pivot: any, index: number) => (
                      <div
                        key={index}
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          textAlign: 'center',
                          background: pivot.is_high ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          {pivot.is_high ? 'HIGH' : 'LOW'}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-primary)' }}>
                          {pivot.value?.toFixed(1) || '-'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
