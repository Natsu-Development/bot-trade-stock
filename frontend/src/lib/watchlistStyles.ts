import type { ConditionCategoryId, ConditionSentiment } from './watchlistOptions'

// Shared sentiment styling maps, used by the editor modal and the condition-detail
// panel. Hue tokens live in global.css — no new colors are introduced here.

/** Small filled dot, colored by sentiment (live-summary bullets). */
export const SENTIMENT_DOT: Record<ConditionSentiment, string> = {
  bull: 'bg-[var(--neon-bull)]',
  bear: 'bg-[var(--neon-bear)]',
  neutral: 'bg-[var(--neon-cyan)]',
}

/** Text color, by sentiment. */
export const SENTIMENT_TEXT: Record<ConditionSentiment, string> = {
  bull: 'text-[var(--neon-bull)]',
  bear: 'text-[var(--neon-bear)]',
  neutral: 'text-[var(--neon-cyan)]',
}

/** 3px left accent bar, by sentiment. */
export const SENTIMENT_BAR: Record<ConditionSentiment, string> = {
  bull: 'bg-[var(--neon-bull)]',
  bear: 'bg-[var(--neon-bear)]',
  neutral: 'bg-[var(--neon-cyan)]',
}

/**
 * Short category codes for the collapsed WATCHING chips.
 * Note: ma_cross → MA (not "RS"); rsi → RSI.
 */
export const CATEGORY_SHORT_CODE: Record<ConditionCategoryId, string> = {
  price: 'PRICE',
  volume: 'VOL',
  ma_cross: 'MA',
  trendline: 'TREND',
  rsi: 'RSI',
}
