// Package credentials provides a .env-file-backed SSI credential snapshot.
// EnvCredentialStore holds an atomic.Pointer[SSICredentials] so all readers
// (parallel exchange goroutines) snapshot via a single atomic load — torn-read
// free, no mutex.
package credentials

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"time"
)

// SSICredentials is an immutable snapshot of the SSI Cloudflare credentials
// loaded from the env file. Mutated only by atomic.Pointer swap in
// EnvCredentialStore.Reload.
type SSICredentials struct {
	UserAgent   string
	CFClearance string
	CFBm        string
	CFUvid      string
	MintedAt    time.Time
}

// EnvCredentialStore is a hot-reloadable SSI credential snapshot backed by a .env file.
// Concurrent safety: creds is an atomic.Pointer — Reload swaps the pointer atomically;
// Current loads it atomically. No mutex required (read-mostly snapshot swap pattern,
// per concurrency.md).
type EnvCredentialStore struct {
	path  string
	creds atomic.Pointer[SSICredentials]
}

// NewEnvCredentialStore constructs and validates the store.
// Fail-fast: reads and parses the env file at construction; errors if the file is
// unreadable, SSI_CF_CLEARANCE is missing, or SSI_COOKIES_MINTED_AT is missing/unparseable.
func NewEnvCredentialStore(path string) (*EnvCredentialStore, error) {
	if path == "" {
		return nil, fmt.Errorf("credentials env path is required")
	}

	creds, err := parseEnvFile(path)
	if err != nil {
		return nil, fmt.Errorf("load credentials from %s: %w", path, err)
	}

	s := &EnvCredentialStore{path: path}
	s.creds.Store(&creds)

	return s, nil
}

// Current returns a value copy of the latest credential snapshot.
// Safe to call from multiple goroutines concurrently with Reload.
func (s *EnvCredentialStore) Current() SSICredentials {
	return *s.creds.Load()
}

// Reload re-parses the env file and atomically swaps the credential pointer on success.
// On parse failure the prior snapshot is preserved and the error is returned so callers
// (SIGHUP handler) can log it without crashing.
func (s *EnvCredentialStore) Reload() error {
	creds, err := parseEnvFile(s.path)
	if err != nil {
		return fmt.Errorf("reload credentials from %s: %w", s.path, err)
	}

	s.creds.Store(&creds)
	return nil
}

// required keys in the env file.
var requiredKeys = []string{
	"SSI_USER_AGENT",
	"SSI_CF_CLEARANCE",
	"SSI_CF_BM",
	"SSI_CF_UVID",
	"SSI_COOKIES_MINTED_AT",
}

// mintedAtLayouts accepts both colon-form (RFC3339, e.g. 2026-05-18T08:50:00+00:00)
// and non-colon-form (e.g. 2026-05-18T08:50:00+0000) timezone offsets. GNU `date -u
// -Iseconds` emits the colon form; `date -u +%Y-%m-%dT%H:%M:%S%z` emits non-colon.
// Accepting both keeps the parser tolerant of either operator-side script style.
var mintedAtLayouts = []string{
	time.RFC3339,
	"2006-01-02T15:04:05-0700",
}

// parseMintedAt tries each layout in order; returns the first successful parse.
func parseMintedAt(s string) (time.Time, error) {
	var lastErr error
	for _, layout := range mintedAtLayouts {
		t, err := time.Parse(layout, s)
		if err == nil {
			return t, nil
		}
		lastErr = err
	}
	return time.Time{}, lastErr
}

// parseEnvFile reads a KEY=value / KEY="value" env file and returns SSICredentials.
// Blank lines and lines starting with # are ignored.
// SSI_COOKIES_MINTED_AT must be a valid RFC3339-style timestamp with timezone offset
// (either colon or non-colon form); any other format or a missing value causes an
// immediate error (strict mode per plan).
func parseEnvFile(path string) (SSICredentials, error) {
	f, err := os.Open(path)
	if err != nil {
		return SSICredentials{}, fmt.Errorf("open env file: %w", err)
	}
	defer f.Close()

	kvs := make(map[string]string)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		val := strings.TrimSpace(line[idx+1:])
		// Strip optional surrounding quotes.
		if len(val) >= 2 && val[0] == '"' && val[len(val)-1] == '"' {
			val = val[1 : len(val)-1]
		}
		kvs[key] = val
	}
	if err := scanner.Err(); err != nil {
		return SSICredentials{}, fmt.Errorf("read env file: %w", err)
	}

	// Validate required keys are present and non-empty.
	for _, k := range requiredKeys {
		if kvs[k] == "" {
			return SSICredentials{}, fmt.Errorf("missing required key %s in env file", k)
		}
	}

	mintedAt, err := parseMintedAt(kvs["SSI_COOKIES_MINTED_AT"])
	if err != nil {
		return SSICredentials{}, fmt.Errorf("parse SSI_COOKIES_MINTED_AT %q as RFC3339: %w", kvs["SSI_COOKIES_MINTED_AT"], err)
	}

	return SSICredentials{
		UserAgent:   kvs["SSI_USER_AGENT"],
		CFClearance: kvs["SSI_CF_CLEARANCE"],
		CFBm:        kvs["SSI_CF_BM"],
		CFUvid:      kvs["SSI_CF_UVID"],
		MintedAt:    mintedAt,
	}, nil
}
