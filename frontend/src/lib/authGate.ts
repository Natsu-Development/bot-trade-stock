/**
 * dataPagesReady gates whether the data pages (Dashboard / Screener / Divergence
 * / Config) may mount. They mount ONLY once auth resolution has finished AND a
 * real config ID is present.
 *
 * Logged-out users (configId === null) therefore never mount the data pages, so
 * their mount effects never fire a `/stocks/*` request before login. A returning
 * user (id already in localStorage) resolves to a non-null configId on first
 * paint and mounts immediately — no regression.
 */
export function dataPagesReady(isLoading: boolean, configId: string | null): boolean {
  return !isLoading && configId !== null
}
