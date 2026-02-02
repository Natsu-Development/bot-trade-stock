import { Icons } from '../icons/Icons'
import type { SignalType } from '../../types'
import './SignalCard.css'

interface SignalCardProps {
  type: SignalType
  title: string
  value: string
  currentRsi: number
  confidence: number
  divergenceType: string
  strength: string
}

export function SignalCard({
  type,
  title,
  value,
  currentRsi,
  confidence,
  divergenceType,
  strength
}: SignalCardProps) {
  const Icon = type === 'bullish' ? Icons.TrendUp : Icons.TrendDown

  return (
    <div className={`signal-card ${type}`}>
      <div className="signal-icon">
        <Icon />
      </div>
      <h3 className="signal-title">{title}</h3>
      <p className="signal-value">{value}</p>
      <div className="divergence-detail">
        <div className="detail-item">
          <div className="detail-label">Current RSI</div>
          <div className={`detail-value ${type === 'bullish' ? 'text-bull' : ''}`}>{currentRsi}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Confidence</div>
          <div className="detail-value">{confidence}%</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Divergence Type</div>
          <div className={`detail-value ${divergenceType === 'N/A' ? 'text-muted' : ''}`}>{divergenceType}</div>
        </div>
        <div className="detail-item">
          <div className="detail-label">Strength</div>
          <div className={`detail-value ${strength === 'High' ? (type === 'bullish' ? 'text-bull' : 'text-bear') : 'text-muted'}`}>
            {strength}
          </div>
        </div>
      </div>
    </div>
  )
}
