package metrics

import (
	"context"
	"errors"
	"net/url"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

// ProviderMetrics holds all provider-related Prometheus metrics.
// All metric logic is encapsulated here - consumers just call simple methods.
type ProviderMetrics struct {
	requestsTotal   *prometheus.CounterVec
	errorsTotal     *prometheus.CounterVec
	rateLimitEvents *prometheus.CounterVec
	requestDuration *prometheus.HistogramVec
	healthStatus    *prometheus.GaugeVec
	rateLimiterRPS  *prometheus.GaugeVec
}

// NewProviderMetrics creates and registers provider metrics with Prometheus.
func NewProviderMetrics() *ProviderMetrics {
	return &ProviderMetrics{
		requestsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "provider_requests_total",
				Help: "Total requests per provider",
			},
			[]string{"provider"},
		),
		errorsTotal: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "provider_errors_total",
				Help: "Total errors per provider",
			},
			[]string{"provider", "error_type"},
		),
		rateLimitEvents: promauto.NewCounterVec(
			prometheus.CounterOpts{
				Name: "provider_rate_limit_events_total",
				Help: "Rate limit events (HTTP 429) per provider",
			},
			[]string{"provider"},
		),
		requestDuration: promauto.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "provider_request_duration_seconds",
				Help:    "Request duration per provider",
				Buckets: prometheus.DefBuckets,
			},
			[]string{"provider"},
		),
		healthStatus: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "provider_health_status",
				Help: "Provider health (1=healthy, 0=unhealthy)",
			},
			[]string{"provider"},
		),
		rateLimiterRPS: promauto.NewGaugeVec(
			prometheus.GaugeOpts{
				Name: "provider_rate_limiter_rps",
				Help: "Current RPS limit per provider",
			},
			[]string{"provider"},
		),
	}
}

// RequestTracker tracks a single request's metrics.
type RequestTracker struct {
	metrics  *ProviderMetrics
	provider string
	start    time.Time
}

// BeginRequest starts tracking a request. Call EndRequest when done.
func (m *ProviderMetrics) BeginRequest(provider string) *RequestTracker {
	m.requestsTotal.WithLabelValues(provider).Inc()
	return &RequestTracker{
		metrics:  m,
		provider: provider,
		start:    time.Now(),
	}
}

// EndRequest records the request result. Pass error (or nil) to classify.
func (t *RequestTracker) EndRequest(err error, isRateLimited bool, currentRPS float64) {
	duration := time.Since(t.start).Seconds()
	t.metrics.requestDuration.WithLabelValues(t.provider).Observe(duration)

	if err != nil {
		t.metrics.errorsTotal.WithLabelValues(t.provider, classifyError(err, isRateLimited)).Inc()

		if isRateLimited {
			t.metrics.rateLimitEvents.WithLabelValues(t.provider).Inc()
			t.metrics.healthStatus.WithLabelValues(t.provider).Set(0)
		}
	} else {
		t.metrics.healthStatus.WithLabelValues(t.provider).Set(1)
	}

	t.metrics.rateLimiterRPS.WithLabelValues(t.provider).Set(currentRPS)
}

// InitProvider initializes gauges for a new provider.
func (m *ProviderMetrics) InitProvider(provider string, initialRPS float64) {
	m.healthStatus.WithLabelValues(provider).Set(1)
	m.rateLimiterRPS.WithLabelValues(provider).Set(initialRPS)
}

// SetRPS updates the RPS gauge for a provider.
func (m *ProviderMetrics) SetRPS(provider string, rps float64) {
	m.rateLimiterRPS.WithLabelValues(provider).Set(rps)
}

// classifyError returns error type for metrics labeling.
func classifyError(err error, isRateLimited bool) string {
	if isRateLimited {
		return "rate_limited"
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return "timeout"
	}
	if errors.Is(err, context.Canceled) {
		return "cancelled"
	}
	var urlErr *url.Error
	if errors.As(err, &urlErr) {
		return "network"
	}
	return "api"
}
