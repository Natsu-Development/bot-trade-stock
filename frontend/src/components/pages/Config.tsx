import { useState } from 'react'
import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
    <div className="animate-slide-in-from-bottom">
      <Header
        title="Trading Configuration"
        subtitle="Customize analysis parameters and alerts"
        actions={
          <>
            <Button variant="secondary" icon="Undo"><span>Reset Defaults</span></Button>
            <Button variant="primary" icon="Save"><span>Save Config</span></Button>
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
                  <span>RSI Settings</span>
                </h3>
                <div className="config-grid-2">
                  <div className="form-group !mb-0">
                    <label className="form-label">RSI Period</label>
                    <input type="number" className="form-input" defaultValue={14} />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Start Date Offset (days)</label>
                    <input type="number" className="form-input" defaultValue={365} />
                  </div>
                </div>
              </div>

              <div className="config-section">
                <h3 className="config-section-title">
                  <Icons.Zap />
                  <span>Divergence Parameters</span>
                </h3>
                <div className="config-grid-2">
                  <div className="form-group !mb-0">
                    <label className="form-label">Lookback Left</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Lookback Right</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group !mb-0">
                    <label className="form-label">Range Min</label>
                    <input type="number" className="form-input" defaultValue={5} />
                  </div>
                  <div className="form-group !mb-0">
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
                  <span>Bullish Watch Symbols</span>
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
                  <span>Bearish Watch Symbols</span>
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
              <div className="config-section !mb-0">
                <h3 className="config-section-title">
                  <Icons.Send />
                  <span>Telegram Notifications</span>
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
                    value="•••••••••••••••••••"
                    readOnly
                  />
                </div>
                <div className="form-group !mb-0">
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
