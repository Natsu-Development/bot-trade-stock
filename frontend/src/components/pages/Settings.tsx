import { Header } from '../layout/Header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SettingsItem, SettingsList } from '../features/SettingsItem'
import { Switch } from '@/components/ui/switch'
import { Icons } from '../icons/Icons'

export function Settings() {
  return (
    <div className="animate-slide-in-from-bottom">
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
                  <span>Connected</span>
                </div>
              }
            >
              <Icons.Mail />
              <span>API Connection</span>
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
              <Button variant="secondary" className="w-full" icon="Refresh">
                Test Connection
              </Button>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Icons.Sun />
              <span>Appearance</span>
            </Card.Header>
            <Card.Body>
              <SettingsList>
                <SettingsItem
                  icon={<Icons.Moon />}
                  title="Dark Mode"
                  description="Use dark theme throughout"
                  action={<Switch checked={true} />}
                />
                <SettingsItem
                  icon={<Icons.GridSmall />}
                  title="Compact Mode"
                  description="Reduce spacing for more data"
                  action={<Switch checked={false} />}
                />
                <SettingsItem
                  icon={<Icons.Zap />}
                  title="Animations"
                  description="Enable UI animations"
                  action={<Switch checked={true} />}
                />
              </SettingsList>
            </Card.Body>
          </Card>
        </div>

        <div>
          <Card>
            <Card.Header>
              <Icons.Sun />
              <span>Appearance</span>
            </Card.Header>
            <Card.Body>
              <SettingsList>
                <SettingsItem
                  icon={<Icons.Moon />}
                  title="Dark Mode"
                  description="Use dark theme throughout"
                  action={<Switch checked={true} />}
                />
                <SettingsItem
                  icon={<Icons.GridSmall />}
                  title="Compact Mode"
                  description="Reduce spacing for more data"
                  action={<Switch checked={false} />}
                />
                <SettingsItem
                  icon={<Icons.Zap />}
                  title="Animations"
                  description="Enable UI animations"
                  action={<Switch checked={true} />}
                />
              </SettingsList>
            </Card.Body>
          </Card>

          <Card className="mb-6">
            <Card.Header>
              <Icons.Database />
              <span>Data Preferences</span>
            </Card.Header>
            <Card.Body>
              <SettingsList>
                <SettingsItem
                  icon={<Icons.Refresh />}
                  title="Auto-refresh"
                  description="Refresh data automatically"
                  action={<Switch checked={true} />}
                />
                <SettingsItem
                  icon={<Icons.Clock />}
                  title="Refresh Interval"
                  description="How often to refresh data"
                  action={
                    <select className="form-input form-select w-[120px]">
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
                  action={<Switch checked={false} />}
                />
              </SettingsList>
            </Card.Body>
          </Card>

          <Card>
            <Card.Header>
              <Icons.Info />
              <span>About</span>
            </Card.Header>
            <Card.Body>
              <div className="text-center py-5">
                <div
                  className="logo mx-auto mb-4 w-14 h-14 text-[20px] flex items-center justify-center rounded-md font-mono font-bold text-[var(--bg-void)] bg-gradient-to-br from-[var(--neon-bull)] to-[var(--neon-cyan)] shadow-[var(--neon-bull-glow)]"
                >
                  VN
                </div>
                <h3 className="mb-1 text-[var(--text-primary)]">VN Trading Terminal</h3>
                <p className="text-[var(--text-muted)] mb-4">
                  RSI Divergence Analysis Bot
                </p>
                <p className="font-mono text-[var(--text-muted)] text-xs">
                  Version 1.0.0
                </p>
                <p className="font-mono text-[var(--text-muted)] text-xs mt-1">
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
