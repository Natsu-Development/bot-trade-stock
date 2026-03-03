package telegram

import (
	"fmt"
	"strings"
)

// FormatDivergenceAlert formats a divergence alert as HTML for Telegram.
// This keeps Telegram-specific formatting in the infrastructure layer.
func FormatDivergenceAlert(divergenceType, interval, symbol, description string) string {
	icon := "🔴"
	if strings.EqualFold(divergenceType, "bullish") {
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
