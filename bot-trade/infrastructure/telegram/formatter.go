package telegram

import (
	"fmt"

	analysisvo "bot-trade/domain/analysis/valueobject"
)

// FormatDivergenceAlert formats a divergence alert as HTML for Telegram.
func FormatDivergenceAlert(divergenceType analysisvo.DivergenceType, interval, symbol, description string) string {
	icon := "🔴"
	if divergenceType.IsBullish() {
		icon = "🟢"
	}

	return fmt.Sprintf(
		"%s <b>%s Divergence Alert</b>\n\n"+
			"📊 Symbol: <b>%s</b>\n"+
			"⏱ Interval: <b>%s</b>\n"+
			"📉 %s\n",
		icon, divergenceType, symbol, interval, description,
	)
}

// FormatEarlySignalAlert formats an early bearish signal alert as HTML for Telegram.
func FormatEarlySignalAlert(interval, symbol, description string) string {
	return fmt.Sprintf(
		"⚠️ <b>Early Bearish Signal</b>\n\n"+
			"📊 Symbol: <b>%s</b>\n"+
			"⏱ Interval: <b>%s</b>\n"+
			"📉 %s\n",
		symbol, interval, description,
	)
}
