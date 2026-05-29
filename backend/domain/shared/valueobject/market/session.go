// Package market — session.go models HoSE intraday trading windows.
package market

import "time"

// IsHoSEActiveQuoteWindow reports whether t falls in an intraday HoSE window
// where continuous quote data is expected to advance.
//
// Returns false for: times outside [09:00, 15:00) HoSE-local time, the ATO
// opening auction [09:00, 09:15), and the lunch break [11:30, 13:00).
// Returns true for morning continuous [09:15, 11:30), afternoon continuous
// [13:00, 14:30), the ATC closing auction [14:30, 14:45) and the post-ATC
// continuous trail [14:45, 15:00) — ATC is intentionally included; the
// direction classifier already returns NEUTRAL during ATC, but quote snapshots
// remain useful for non-direction alerts (accepted per existing design).
//
// Scope: this helper models intraday session boundaries only. Weekday gating
// is the cron schedule's responsibility (STOCK_ALERT_SCHEDULE field-6 = "1-5").
// Vietnamese holidays are out of scope. Callers that invoke this helper from
// a non-cron context must apply their own weekday/holiday filter beforehand.
//
// The caller must supply marketTz — the *time.Location HoSE operates in. By
// existing convention this is Asia/Ho_Chi_Minh, loaded once at startup
// (wire/app.go) and threaded through JobDependencies.MarketTimezone. The
// domain VO does not hardcode the zone; injection keeps the binary's "what is
// Vietnam time?" answer single-sourced. Pure: no I/O, no logging.
func IsHoSEActiveQuoteWindow(t time.Time, marketTz *time.Location) bool {
	vt := t.In(marketTz)
	mod := vt.Hour()*60 + vt.Minute()
	const (
		sessionOpen   = 9 * 60     // 09:00
		atoEnd        = 9*60 + 15  // 09:15
		morningEnd    = 11*60 + 30 // 11:30
		afternoonOpen = 13 * 60    // 13:00
		sessionClose  = 15 * 60    // 15:00
	)
	if mod < sessionOpen || mod >= sessionClose {
		return false
	}
	if mod < atoEnd {
		return false
	}
	if mod >= morningEnd && mod < afternoonOpen {
		return false
	}
	return true
}
