package handler

import (
	"errors"
	"net/http"

	"backend/application/dto"
	"backend/application/port/inbound"
	"backend/domain/config"
	shared "backend/domain/shared"
	"backend/presentation/http/response"

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
	var req dto.TradingConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	cfg, err := dto.ToTradingConfigAggregate(req)
	if err != nil {
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	configID, err := h.configManager.CreateConfig(c.Request.Context(), cfg)
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

	response.Success(c, http.StatusOK, dto.ToTradingConfigResponse(cfg))
}

// UpdateConfig handles PUT /config/:id - updates an existing configuration.
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		response.BadRequest(c, "config id is required")
		return
	}

	var req dto.TradingConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	cfg, err := dto.ToTradingConfigAggregate(req)
	if err != nil {
		var validationErr *shared.ValidationError
		if errors.As(err, &validationErr) {
			response.ValidationError(c, validationErr.Errors)
			return
		}
		response.BadRequest(c, err.Error())
		return
	}

	updated, err := h.configManager.UpdateConfig(c.Request.Context(), id, cfg)
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

	response.Success(c, http.StatusOK, dto.ToTradingConfigResponse(updated))
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
