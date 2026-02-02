import { useState } from 'react'
import { Header } from '../layout/Header'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Icons } from '../icons/Icons'
import { SymbolTag } from '../features/SymbolTag'

const bullishSymbols = ['VCB', 'FPT', 'VIC', 'MWG', 'HPG']
const bearishSymbols = ['BID', 'CTG', 'TCB']

export function Config() {
  const [bullWatch, setBullWatch] = useState(bullishSymbols)
  const [bearWatch, setBearWatch] = useState(bearishSymbols)

  const handleRemoveBull = (symbol: string) => {
    setBullWatch(bullWatch.filter(s => s !== symbol))
  }

  const handleRemoveBear = (symbol: string) => {
    setBearWatch(bearWatch.filter(s => s !== symbol))
  }

  return (
    <div className="page active">
      <Header
        title="Trading Configuration"
        subtitle="Customize analysis parameters and alerts"
        actions={
          <>
            <Button variant="secondary" icon="Undo">Reset Defaults</Button>
            <Button icon="Save">Save Config</Button>
          </>
        }
      />

      <div className="grid-2">
        <div>
          <Card className="mb-6">
            <Card.Body>
              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.Chart />
                  RSI Settings
                </h3>
                <div className="config-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">RSI Period</label>
                    <input type="number" className="form-input" defaultValue={14} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Date Offset (days)</label>
                    <input type="number" className="form-input" defaultValue={365} />
                  </div>
                </div>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.Zap />
                  Divergence Parameters
                </h3>
                <div className="config-grid-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Lookback Left</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Lookback Right</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Range Min</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Range Max</label>
                    <input type="number" className="form-input" defaultValue={60} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Recent Indices</label>
                  <input type="number" className="form-input" defaultValue={5} />
                </div>
                <label className="form-checkbox mt-4">
                  <input type="checkbox" defaultChecked />
                  <span>Enable early detection mode</span>
                </label>
              </div>
            </Card.Body>
          </Card>
        </div>

        <div>
          <Card className="mb-6">
            <Card.Body>
              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.TrendUp />
                  Bullish Watch Symbols
                </h3>
                <input
                  type="text"
                  className="form-input mb-4"
                  placeholder="Add symbol and press Enter"
                />
                <div className="symbol-tags">
                  {bullWatch.map((symbol) => (
                    <SymbolTag
                      key={symbol}
                      symbol={symbol}
                      onRemove={handleRemoveBull}
                    />
                  ))}
                </div>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.TrendDown />
                  Bearish Watch Symbols
                </h3>
                <input
                  type="text"
                  className="form-input mb-4"
                  placeholder="Add symbol and press Enter"
                />
                <div className="symbol-tags">
                  {bearWatch.map((symbol) => (
                    <SymbolTag
                      key={symbol}
                      symbol={symbol}
                      onRemove={handleRemoveBear}
                    />
                  ))}
                </div>
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <div className="config-section" style={{ marginBottom: 0 }}>
                <h3 className="config-section-title">
                  <Icons.Send />
                  Telegram Notifications
                </h3>
                <label className="form-checkbox mb-4">
                  <input type="checkbox" defaultChecked />
                  <span>Enable Telegram notifications</span>
                </label>
                <div className="form-group">
                  <label className="form-label">Bot Token</label>
                  <input
                    type="password"
                    className="form-input"
                    value="••••••••••••••••••"
                    readOnly
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chat ID</label>
                  <input
                    type="text"
                    className="form-input"
                    defaultValue="-1001234567890"
                  />
                </div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
