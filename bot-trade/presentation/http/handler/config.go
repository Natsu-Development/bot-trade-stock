package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/port/inbound"
	"bot-trade/domain/config"
	configagg "bot-trade/domain/config/aggregate"
	shared "bot-trade/domain/shared"
	"bot-trade/presentation/http/response"

	"github.com/gin-gonic/gin"
)

// ConfigHandler handles configuration CRUD HTTP requests.
type ConfigHandler struct {
	configManager inbound.ConfigManager
}

// NewConfigHandler creates a new ConfigHandler.
func NewConfigHandler(configManager inbound.ConfigManager) *ConfigHandler {
	return &ConfigHandler{configManager: configManager}
}

// CreateConfig handles POST /config - creates a new configuration.
func (h *ConfigHandler) CreateConfig(c *gin.Context) {
	var cfg configagg.TradingConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	configID, err := h.configManager.CreateConfig(c.Request.Context(), &cfg)
	if err != nil {
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.InternalError(c, "failed to create configuration")
		return
	}

	response.Created(c, gin.H{"config_id": configID})
}

// GetConfig handles GET /config/:id - retrieves a configuration by ID.
func (h *ConfigHandler) GetConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	cfg, err := h.configManager.GetConfig(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		response.InternalError(c, "failed to retrieve configuration")
		return
	}

	response.Success(c, http.StatusOK, cfg)
}

// UpdateConfig handles PUT /config/:id - updates an existing configuration.
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	var cfg configagg.TradingConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	updated, err := h.configManager.UpdateConfig(c.Request.Context(), id, &cfg)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.InternalError(c, "failed to update configuration")
		return
	}

	response.Success(c, http.StatusOK, updated)
}

// DeleteConfig handles DELETE /config/:id - deletes a configuration by ID.
func (h *ConfigHandler) DeleteConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	err := h.configManager.DeleteConfig(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		response.InternalError(c, "failed to delete configuration")
		return
	}

	response.Success(c, http.StatusOK, gin.H{"message": "configuration deleted"})
}

// WatchlistRequest represents the request body for adding/removing symbols from watchlists.
type WatchlistRequest struct {
	ListType string   `json:"list_type" binding:"required"` // "bullish" or "bearish"
	Symbols  []string `json:"symbols" binding:"required,min=1"`
}

// AddSymbolsToWatchlist handles POST /config/:id/watchlist - adds symbols to a watchlist.
func (h *ConfigHandler) AddSymbolsToWatchlist(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	var req WatchlistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	err := h.configManager.AddSymbols(c.Request.Context(), id, req.ListType, req.Symbols)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.InternalError(c, "failed to add symbols to watchlist")
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"message":   "symbols added to watchlist",
		"list_type": req.ListType,
		"symbols":   req.Symbols,
	})
}

// RemoveSymbolsFromWatchlist handles DELETE /config/:id/watchlist - removes symbols from a watchlist.
func (h *ConfigHandler) RemoveSymbolsFromWatchlist(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	var req WatchlistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	err := h.configManager.RemoveSymbols(c.Request.Context(), id, req.ListType, req.Symbols)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			response.NotFound(c, "configuration")
			return
		}
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.InternalError(c, "failed to remove symbols from watchlist")
		return
	}

	response.Success(c, http.StatusOK, gin.H{
		"message":   "symbols removed from watchlist",
		"list_type": req.ListType,
		"symbols":   req.Symbols,
	})
}
