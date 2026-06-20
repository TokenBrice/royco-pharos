export const ROYCOPHAROS_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS token_mappings (
  chain_id INTEGER NOT NULL,
  chain_slug TEXT NOT NULL,
  deposit_token_address TEXT NOT NULL,
  deposit_token_symbol TEXT NOT NULL,
  pharos_stablecoin_id TEXT,
  mapping_status TEXT NOT NULL,
  mapping_source TEXT NOT NULL,
  confidence TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chain_id, deposit_token_address)
);

CREATE TABLE IF NOT EXISTS royco_sync_runs (
  run_id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  request_body_hash TEXT,
  http_status INTEGER,
  upstream_count INTEGER NOT NULL,
  market_count INTEGER NOT NULL,
  tranche_count INTEGER NOT NULL,
  parse_error_count INTEGER NOT NULL,
  raw_payload_hash TEXT,
  raw_payload_sample_json TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL,
  error_code TEXT,
  metadata_json TEXT,
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS sync_locks (
  name TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  acquired_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS royco_markets (
  chain_id INTEGER NOT NULL,
  chain_slug TEXT NOT NULL,
  market_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  name TEXT NOT NULL,
  listing_type TEXT NOT NULL,
  status_raw TEXT,
  status_normalized TEXT,
  tvl_usd REAL,
  coverage_ratio REAL,
  required_coverage_ratio REAL,
  utilization_ratio REAL,
  utilization_limit_ratio REAL,
  drawdown_ratio REAL,
  total_drawdowns INTEGER,
  junior_redemption_delay_seconds INTEGER,
  royco_run_id TEXT NOT NULL,
  source_observed_at INTEGER,
  collected_at INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (chain_id, market_id)
);

CREATE TABLE IF NOT EXISTS royco_tranches (
  tranche_id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  market_id TEXT NOT NULL,
  side TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  deposit_token_symbol TEXT,
  deposit_token_name TEXT,
  deposit_token_address TEXT,
  deposit_token_decimals INTEGER,
  share_token_symbol TEXT,
  share_token_name TEXT,
  share_token_address TEXT,
  share_token_decimals INTEGER,
  mapping_status TEXT NOT NULL,
  pharos_stablecoin_id TEXT,
  apy_current_raw REAL,
  apy_current_pct REAL,
  apy_7d_raw REAL,
  apy_7d_pct REAL,
  apy_unit TEXT,
  apy_window TEXT,
  tvl_usd REAL,
  source_url TEXT,
  royco_run_id TEXT NOT NULL,
  source_observed_at INTEGER,
  collected_at INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (chain_id, market_id, side)
);

CREATE TABLE IF NOT EXISTS royco_market_history (
  chain_id INTEGER NOT NULL,
  market_id TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  tvl_usd REAL,
  coverage_ratio REAL,
  required_coverage_ratio REAL,
  utilization_ratio REAL,
  utilization_limit_ratio REAL,
  drawdown_ratio REAL,
  total_drawdowns INTEGER,
  status_normalized TEXT,
  royco_run_id TEXT NOT NULL,
  collected_at INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  PRIMARY KEY (chain_id, market_id, observed_at)
);

CREATE TABLE IF NOT EXISTS royco_tranche_history (
  tranche_id TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  market_id TEXT NOT NULL,
  side TEXT NOT NULL,
  observed_at INTEGER NOT NULL,
  apy_current_raw REAL,
  apy_current_pct REAL,
  apy_7d_raw REAL,
  apy_7d_pct REAL,
  tvl_usd REAL,
  royco_run_id TEXT NOT NULL,
  collected_at INTEGER NOT NULL,
  published_at INTEGER NOT NULL,
  PRIMARY KEY (tranche_id, observed_at)
);

CREATE TABLE IF NOT EXISTS pharos_api_cache (
  endpoint TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  body_json TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  x_data_age TEXT,
  warning TEXT,
  fetched_at INTEGER NOT NULL,
  source_updated_at INTEGER,
  expires_at INTEGER,
  stale_if_error_until INTEGER,
  generation INTEGER NOT NULL,
  error_code TEXT,
  PRIMARY KEY (endpoint, cache_key)
);

CREATE TABLE IF NOT EXISTS pharos_underlying_summaries (
  pharos_stablecoin_id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL,
  supply_usd REAL,
  underlying_safety_score REAL,
  underlying_safety_grade TEXT,
  report_card_summary_json TEXT,
  pharos_safety_methodology_version TEXT,
  pharos_cache_generation INTEGER NOT NULL,
  source_updated_at INTEGER,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tranche_scores (
  tranche_id TEXT PRIMARY KEY,
  pharos_stablecoin_id TEXT,
  mapping_status TEXT NOT NULL,
  score_status TEXT NOT NULL,
  nr_reason TEXT,
  base_asset_score REAL,
  underlying_safety_score REAL,
  underlying_safety_grade TEXT,
  exposure_score REAL,
  exposure_haircut REAL,
  tranche_structure_score REAL,
  tranche_haircut REAL,
  safety_score REAL,
  safety_grade TEXT,
  apy_used_pct REAL,
  apy_source TEXT,
  opportunity_yield REAL,
  opportunity_score REAL,
  opportunity_grade TEXT,
  penalty_breakdown_json TEXT NOT NULL,
  royco_run_id TEXT NOT NULL,
  pharos_cache_generation INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  pharos_safety_methodology_version TEXT,
  royco_freshness_status TEXT NOT NULL,
  pharos_freshness_status TEXT NOT NULL,
  computed_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_royco_market_history_market_time
  ON royco_market_history (chain_id, market_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_royco_tranche_history_tranche_time
  ON royco_tranche_history (tranche_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_royco_sync_runs_published
  ON royco_sync_runs (published_at DESC, status);

CREATE INDEX IF NOT EXISTS idx_sync_locks_expires
  ON sync_locks (expires_at);
`;
