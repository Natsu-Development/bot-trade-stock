// Package response provides common HTTP response helpers for consistent error handling.
package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse represents a standard error response structure.
type ErrorResponse struct {
	Error   string   `json:"error"`
	Details []string `json:"details,omitempty"`
}

// Success sends a successful JSON response with the given status code.
func Success(c *gin.Context, code int, data interface{}) {
	c.JSON(code, data)
}

// Error sends an error JSON response with the given status code and message.
func Error(c *gin.Context, code int, message string, details ...string) {
	resp := ErrorResponse{
		Error: message,
	}
	if len(details) > 0 {
		resp.Details = details
	}
	c.JSON(code, resp)
}

// ValidationError sends a 400 Bad Request response for validation errors.
func ValidationError(c *gin.Context, details []string) {
	Error(c, http.StatusBadRequest, "validation failed", details...)
}

// NotFound sends a 404 Not Found response for a missing resource.
func NotFound(c *gin.Context, resource string) {
	Error(c, http.StatusNotFound, resource+" not found")
}

// BadRequest sends a 400 Bad Request response with a custom message.
func BadRequest(c *gin.Context, message string) {
	Error(c, http.StatusBadRequest, message)
}

// InternalError sends a 500 Internal Server Error response.
func InternalError(c *gin.Context, message string) {
	Error(c, http.StatusInternalServerError, message)
}

// Created sends a 201 Created response with the data.
func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, data)
}
