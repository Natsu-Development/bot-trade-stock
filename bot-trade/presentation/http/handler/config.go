package handler

import (
	"errors"
	"net/http"

	"bot-trade/application/usecase"
	"bot-trade/domain/aggregate/config"

	"github.com/gin-gonic/gin"
)

// ConfigHandler handles configuration CRUD HTTP requests.
type ConfigHandler struct {
	configUseCase *usecase.ConfigUseCase
}

// NewConfigHandler creates a new ConfigHandler.
func NewConfigHandler(configUseCase *usecase.ConfigUseCase) *ConfigHandler {
	return &ConfigHandler{configUseCase: configUseCase}
}

// CreateConfig handles POST /config - creates a new configuration.
func (h *ConfigHandler) CreateConfig(c *gin.Context) {
	var cfg config.TradingConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	configID, err := h.configUseCase.CreateConfig(c.Request.Context(), &cfg)
	if err != nil {
		var validationErr *config.ValidationError
		if errors.As(err, &validationErr) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "details": validationErr.Errors})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create configuration"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"config_id": configID})
}

// GetConfig handles GET /config/:id - retrieves a configuration by ID.
func (h *ConfigHandler) GetConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config id is required"})
		return
	}

	cfg, err := h.configUseCase.GetConfig(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve configuration"})
		return
	}

	c.JSON(http.StatusOK, cfg)
}

// UpdateConfig handles PUT /config/:id - updates an existing configuration.
func (h *ConfigHandler) UpdateConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config id is required"})
		return
	}

	var cfg config.TradingConfig
	if err := c.ShouldBindJSON(&cfg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated, err := h.configUseCase.UpdateConfig(c.Request.Context(), id, &cfg)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration not found"})
			return
		}
		var validationErr *config.ValidationError
		if errors.As(err, &validationErr) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "details": validationErr.Errors})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update configuration"})
		return
	}

	c.JSON(http.StatusOK, updated)
}

// DeleteConfig handles DELETE /config/:id - deletes a configuration by ID.
func (h *ConfigHandler) DeleteConfig(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "config id is required"})
		return
	}

	err := h.configUseCase.DeleteConfig(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, config.ErrConfigNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "configuration not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete configuration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "configuration deleted"})
}
