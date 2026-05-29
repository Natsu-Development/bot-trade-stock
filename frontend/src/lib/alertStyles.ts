import type { ConditionCategoryId, ConditionSentiment } from './alertOptions'

// ---------------------------------------------------------------------------
// Shared sentiment styling maps
//
// Extracted from StockAlertEditorModal (SENTIMENT_DOT / SENTIMENT_TEXT /
// SENTIMENT_BAR) and StockAlertRow (SENTIMENT_PILL / SENTIMENT_PILL_DIM) so the
// modal and the new condition-detail panel share one source of truth. Hue
// tokens already live in global.css:116-131 — no new colors are introduced.
// ---------------------------------------------------------------------------

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

/** Enabled condition pill: tinted background + matching border/text. */
export const SENTIMENT_PILL: Record<ConditionSentiment, string> = {
  bull: 'bg-[var(--neon-bull-dim)] border-[rgba(0,255,136,0.25)] text-[var(--neon-bull)]',
  bear: 'bg-[var(--neon-bear-dim)] border-[rgba(255,51,102,0.25)] text-[var(--neon-bear)]',
  neutral: 'bg-[var(--neon-cyan-dim)] border-[var(--neon-cyan-dim)] text-[var(--neon-cyan)]',
}

/** Disabled condition pill: muted/dimmed regardless of sentiment. */
export const SENTIMENT_PILL_DIM: Record<ConditionSentiment, string> = {
  bull: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
  bear: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
  neutral: 'bg-[var(--bg-deep)] border-[var(--border-dim)] text-[var(--text-muted)]',
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
