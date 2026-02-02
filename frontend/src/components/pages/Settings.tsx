import { Header } from '../layout/Header'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { SettingsItem } from '../features/SettingsItem'
import { Toggle } from '../ui/Toggle'
import { Icons } from '../icons/Icons'

export function Settings() {
  return (
    <div className="page active">
      <Header
        title="Settings"
        subtitle="Application preferences and connections"
      />

      <div className="grid-2">
        <div>
          <Card className="mb-6">
            <Card.Header
              action={
                <div className="connection-status connected">
                  <span className="dot"></span>
                  Connected
                </div>
              }
            >
              <Icons.Mail />
              API Connection
            </Card.Header>
            <Card.Body>
              <div className="form-group">
                <label className="form-label">API Base URL</label>
                <input type="text" className="form-input" defaultValue="http://localhost:8080" />
              </div>
              <div className="form-group">
                <label className="form-label">Request Timeout (ms)</label>
                <input type="number" className="form-input" defaultValue={30000} />
              </div>
              <Button variant="secondary" style={{ width: '100%' }} icon="Refresh">
                Test Connection
              </Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Icons.Sun />
              Appearance
            </Card.Header>
            <Card.Body>
              <div className="settings-list">
                <SettingsItem
                  icon={<Icons.Moon />}
                  title="Dark Mode"
                  description="Use dark theme throughout"
                  action={<Toggle active />}
                />
                <SettingsItem
                  icon={<Icons.GridSmall />}
                  title="Compact Mode"
                  description="Reduce spacing for more data"
                  action={<Toggle />}
                />
                <SettingsItem
                  icon={<Icons.Zap />}
                  title="Animations"
                  description="Enable UI animations"
                  action={<Toggle active />}
                />
              </div>
            </Card.Body>
          </Card>
        </div>

        <div>
          <Card className="mb-6">
            <Card.Header>
              <Icons.Database />
              Data Preferences
            </Card.Header>
            <Card.Body>
              <div className="settings-list">
                <SettingsItem
                  icon={<Icons.Refresh />}
                  title="Auto-refresh"
                  description="Refresh data automatically"
                  action={<Toggle active />}
                />
                <SettingsItem
                  icon={<Icons.Clock />}
                  title="Refresh Interval"
                  description="How often to refresh data"
                  action={
                    <select className="form-input form-select" style={{ width: '120px' }}>
                      <option>30 sec</option>
                      <option selected>1 min</option>
                      <option>5 min</option>
                      <option>15 min</option>
                    </select>
                  }
                />
                <SettingsItem
                  icon={<Icons.Bell />}
                  title="Sound Alerts"
                  description="Play sound on new signals"
                  action={<Toggle />}
                />
              </div>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Icons.Info />
              About
            </Card.Header>
            <Card.Body>
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div
                  className="logo"
                  style={{
                    margin: '0 auto 16px',
                    width: '56px',
                    height: '56px',
                    fontSize: '20px',
                  }}
                >
                  VN
                </div>
                <h3 style={{ marginBottom: '4px' }}>VN Trading Terminal</h3>
                <p className="text-muted" style={{ marginBottom: '16px' }}>
                  RSI Divergence Analysis Bot
                </p>
                <p className="font-mono text-muted" style={{ fontSize: '12px' }}>
                  Version 1.0.0
                </p>
                <p className="font-mono text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                  Go 1.23 + Python 3.10
                </p>
              </div>
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  )
}
