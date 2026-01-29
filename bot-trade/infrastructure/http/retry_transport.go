// Package http provides HTTP infrastructure components including retry transport.
package http

import (
	"net/http"
	"time"

	"go.uber.org/zap"
)

// Default retry configuration
var defaultRetryBackoffs = []time.Duration{
	5 * time.Second,  // 1st retry after 5s
	10 * time.Second, // 2nd retry after 10s
	20 * time.Second, // 3rd retry after 20s
}

const defaultMaxRetries = 3

// RetryTransport is an HTTP RoundTripper that retries requests on 429 (Too Many Requests) responses.
// It implements exponential backoff for rate-limited requests.
type RetryTransport struct {
	base       http.RoundTripper
	maxRetries int
	backoffs   []time.Duration
	logger     *zap.Logger
}

// RetryTransportOption is a functional option for configuring RetryTransport.
type RetryTransportOption func(*RetryTransport)

// WithMaxRetries sets the maximum number of retries.
func WithMaxRetries(maxRetries int) RetryTransportOption {
	return func(t *RetryTransport) {
		t.maxRetries = maxRetries
	}
}

// WithBackoffs sets custom backoff durations for each retry attempt.
func WithBackoffs(backoffs []time.Duration) RetryTransportOption {
	return func(t *RetryTransport) {
		t.backoffs = backoffs
	}
}

// WithLogger sets a custom logger for the transport.
func WithLogger(logger *zap.Logger) RetryTransportOption {
	return func(t *RetryTransport) {
		t.logger = logger
	}
}

// NewRetryTransport creates a new RetryTransport wrapping the given base transport.
// If base is nil, http.DefaultTransport is used.
func NewRetryTransport(base http.RoundTripper, opts ...RetryTransportOption) *RetryTransport {
	if base == nil {
		base = http.DefaultTransport
	}

	t := &RetryTransport{
		base:       base,
		maxRetries: defaultMaxRetries,
		backoffs:   defaultRetryBackoffs,
		logger:     zap.NewNop(), // Default to no-op logger
	}

	for _, opt := range opts {
		opt(t)
	}

	return t
}

// RoundTrip executes a single HTTP transaction with retry logic for 429 responses.
// It implements the http.RoundTripper interface.
func (t *RetryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	var lastResp *http.Response
	var lastErr error

	for attempt := 0; attempt <= t.maxRetries; attempt++ {
		// Clone request for retry (body needs to be re-readable)
		clonedReq := req.Clone(req.Context())

		resp, err := t.base.RoundTrip(clonedReq)

		// Success or non-retryable error
		if err != nil {
			lastErr = err
			// Network errors are not retryable in this implementation
			break
		}

		// Check for rate limit response
		if resp.StatusCode == http.StatusTooManyRequests {
			// Close the response body to avoid resource leaks
			resp.Body.Close()
			lastResp = resp

			if attempt < t.maxRetries {
				backoff := t.getBackoff(attempt)
				t.logger.Debug("Rate limited (429), retrying",
					zap.String("url", req.URL.String()),
					zap.Int("attempt", attempt+1),
					zap.Duration("backoff", backoff),
				)

				// Wait before retry
				select {
				case <-req.Context().Done():
					return nil, req.Context().Err()
				case <-time.After(backoff):
					continue
				}
			}

			// Max retries exceeded
			t.logger.Warn("Max retries exceeded for rate-limited request",
				zap.String("url", req.URL.String()),
				zap.Int("attempts", t.maxRetries+1),
			)
			return resp, nil
		}

		// Non-429 response, return immediately
		return resp, nil
	}

	// Return last response or error
	if lastResp != nil {
		return lastResp, nil
	}
	return nil, lastErr
}

// getBackoff returns the backoff duration for the given attempt.
func (t *RetryTransport) getBackoff(attempt int) time.Duration {
	if attempt < len(t.backoffs) {
		return t.backoffs[attempt]
	}
	// Use last backoff for any additional attempts
	if len(t.backoffs) > 0 {
		return t.backoffs[len(t.backoffs)-1]
	}
	return 5 * time.Second // Fallback
}

// NewHTTPClientWithRetry creates an http.Client with retry transport configured.
func NewHTTPClientWithRetry(timeout time.Duration, logger *zap.Logger, opts ...RetryTransportOption) *http.Client {
	opts = append([]RetryTransportOption{WithLogger(logger)}, opts...)

	return &http.Client{
		Timeout:   timeout,
		Transport: NewRetryTransport(http.DefaultTransport, opts...),
	}
}
