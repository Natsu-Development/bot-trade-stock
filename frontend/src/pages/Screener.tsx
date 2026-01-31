import { useState } from 'react';
import { Filter, Download } from 'lucide-react';
import { stockService, FilterCondition, FilterLogic, Exchange } from '../services';
import { useStockStore, useUiStore } from '../store';
import { useApi } from '../hooks';

export function Screener() {
  const { filteredStocks, setFilteredStocks, setFiltering, clearError } = useStockStore();
  const { addToast } = useUiStore();
  const { execute: filterStocks, isLoading } = useApi({ showToasts: false });

  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: 'rs_52w', operator: '>=', value: 80 },
  ]);
  const [logic, setLogic] = useState<FilterLogic>('and');
  const [exchanges, setExchanges] = useState<Exchange[]>(['HOSE', 'HNX', 'UPCOM']);
  const [hasSearched, setHasSearched] = useState(false);

  const fieldOptions: { value: FilterCondition['field']; label: string }[] = [
    { value: 'rs_1m', label: 'RS 1 Month' },
    { value: 'rs_3m', label: 'RS 3 Month' },
    { value: 'rs_6m', label: 'RS 6 Month' },
    { value: 'rs_9m', label: 'RS 9 Month' },
    { value: 'rs_52w', label: 'RS 52 Week' },
    { value: 'volume_vs_sma', label: 'Volume vs SMA' },
  ];

  const operatorOptions: { value: FilterCondition['operator']; label: string }[] = [
    { value: '>=', label: '>=' },
    { value: '<=', label: '<=' },
    { value: '>', label: '>' },
    { value: '<', label: '<' },
  ];

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    const newConditions = conditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c
    );
    setConditions(newConditions);
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'rs_52w', operator: '>=', value: 80 }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const toggleExchange = (exchange: Exchange) => {
    setExchanges((prev) =>
      prev.includes(exchange)
        ? prev.filter((e) => e !== exchange)
        : [...prev, exchange]
    );
  };

  const handleFilter = async () => {
    setFiltering(true);
    clearError();

    const result = await filterStocks(() =>
      stockService.filterStocks({
        conditions,
        logic,
        exchanges,
      })
    );

    if (result) {
      setFilteredStocks(result.results);
      setHasSearched(true);
      addToast({
        type: 'success',
        message: `Found ${result.filtered} stocks matching your criteria`,
      });
    }

    setFiltering(false);
  };

  const handleExport = () => {
    if (filteredStocks.length === 0) {
      addToast({ type: 'warning', message: 'No data to export' });
      return;
    }

    const headers = ['Symbol', 'Exchange', 'RS 1M', 'RS 3M', 'RS 6M', 'RS 52W', 'Volume%', 'Price', 'Change%'];
    const rows = filteredStocks.map((s) => [
      s.symbol,
      s.exchange,
      s.rs_1m?.toFixed(1) ?? '',
      s.rs_3m?.toFixed(1) ?? '',
      s.rs_6m?.toFixed(1) ?? '',
      s.rs_52w?.toFixed(1) ?? '',
      s.volume_vs_sma?.toFixed(0) ?? '',
      s.last_price?.toFixed(2) ?? '',
      s.price_change_percent?.toFixed(2) ?? '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `screener-results-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    addToast({ type: 'success', message: 'Exported to CSV' });
  };

  const getRsBadge = (value: number | undefined) => {
    if (!value) return <span className="rs-badge" style={{ background: 'var(--glass-border)', color: 'var(--text-muted)' }}>-</span>;
    if (value >= 80) return <span className="rs-badge rs-high">{value}</span>;
    if (value >= 60) return <span className="rs-badge rs-medium">{value}</span>;
    return <span className="rs-badge rs-low">{value}</span>;
  };

  const getVolumeColor = (value: number | undefined) => {
    if (!value) return 'var(--text-muted)';
    if (value > 0) return 'var(--success)';
    if (value < 0) return 'var(--danger)';
    return 'var(--text-muted)';
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="header fade-in">
        <div className="header-left">
          <h1>Stock Screener</h1>
          <p>Filter stocks by RS Rating and volume metrics</p>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={handleExport} disabled={!hasSearched || filteredStocks.length === 0}>
            <Download width={16} height={16} strokeWidth={2} />
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={handleFilter} disabled={isLoading}>
            <Filter width={16} height={16} strokeWidth={2} />
            {isLoading ? 'Filtering...' : 'Apply Filters'}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Filter Panel */}
        <div className="glass-card fade-in delay-1">
          <div className="section-header">
            <h2 className="section-title">Filters</h2>
          </div>

          {/* Logic Selector */}
          <div className="form-group">
            <label className="form-label">Match Logic</label>
            <select
              className="form-select"
              value={logic}
              onChange={(e) => setLogic(e.target.value as FilterLogic)}
            >
              <option value="and">AND (All conditions)</option>
              <option value="or">OR (Any condition)</option>
            </select>
          </div>

          {/* Conditions */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label">Conditions</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {conditions.map((condition, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px' }}>
                  <select
                    className="form-select"
                    value={condition.field}
                    onChange={(e) => updateCondition(index, { field: e.target.value as any })}
                    style={{ flex: 1 }}
                  >
                    {fieldOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <select
                    className="form-select"
                    value={condition.operator}
                    onChange={(e) => updateCondition(index, { operator: e.target.value as any })}
                    style={{ width: '70px' }}
                  >
                    {operatorOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, { value: parseFloat(e.target.value) || 0 })}
                    style={{ width: '80px' }}
                  />
                  <button
                    className="btn btn-danger btn-icon"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length === 1}
                    style={{ padding: '8px' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button className="btn btn-secondary" onClick={addCondition} style={{ width: '100%', marginTop: '8px' }}>
              + Add Condition
            </button>
          </div>

          {/* Exchange Filter */}
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--glass-border)' }}>
            <label className="form-label">Exchanges</label>
            <div className="filter-chips">
              {(['HOSE', 'HNX', 'UPCOM'] as Exchange[]).map((exchange) => (
                <button
                  key={exchange}
                  onClick={() => toggleExchange(exchange)}
                  className={cn('filter-chip', exchanges.includes(exchange) && 'active')}
                >
                  {exchange}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="glass-card fade-in delay-2">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '60px 24px' }}>
              <div className="spinner" style={{ marginBottom: '16px' }}></div>
              <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
            </div>
          ) : !hasSearched ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
              Set your filters and click "Apply Filters" to search
            </div>
          ) : filteredStocks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-secondary)' }}>
              No results found. Try adjusting your filters.
            </div>
          ) : (
            <>
              <div className="section-header">
                <div>
                  <h2 className="section-title">Results</h2>
                  <p className="section-subtitle">{filteredStocks.length} stocks found</p>
                </div>
              </div>
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>RS 1M</th>
                    <th>RS 3M</th>
                    <th>RS 6M</th>
                    <th>RS 52W</th>
                    <th>Vol%</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStocks.slice(0, 50).map((stock, index) => (
                    <tr key={`${stock.symbol}-${index}`}>
                      <td>
                        <div className="stock-symbol">{stock.symbol}</div>
                        <div className="stock-exchange">{stock.exchange}</div>
                      </td>
                      <td>{getRsBadge(stock.rs_1m)}</td>
                      <td>{getRsBadge(stock.rs_3m)}</td>
                      <td>{getRsBadge(stock.rs_6m)}</td>
                      <td>{getRsBadge(stock.rs_52w)}</td>
                      <td style={{ fontFamily: 'JetBrains Mono', color: getVolumeColor(stock.volume_vs_sma) }}>
                        {stock.volume_vs_sma !== undefined ? `${stock.volume_vs_sma.toFixed(0)}%` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
