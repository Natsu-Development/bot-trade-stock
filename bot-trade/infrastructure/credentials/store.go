package credentials

// Store is the credential-store contract: Current() for per-fetch snapshots
// (SSIQueryProvider) and Reload() for the SIGHUP handler in cmd/server/main.go.
// Production impl is *EnvCredentialStore; see wire/infra.go for why this is
// interface-typed at the wire layer.
type Store interface {
	Current() SSICredentials
	Reload() error
}
