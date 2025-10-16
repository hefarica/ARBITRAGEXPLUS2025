-- Initial Schema for ARBITRAGEXPLUS2025

CREATE TABLE IF NOT EXISTS executions (
  id SERIAL PRIMARY KEY,
  execution_id VARCHAR(255) UNIQUE NOT NULL,
  route_id VARCHAR(255) NOT NULL,
  transaction_hash VARCHAR(255),
  block_number BIGINT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  input_token VARCHAR(255),
  output_token VARCHAR(255),
  input_amount NUMERIC(36, 18),
  output_amount NUMERIC(36, 18),
  gas_used BIGINT,
  gas_price BIGINT,
  total_cost_usd NUMERIC(18, 2),
  profit_usd NUMERIC(18, 2),
  roi_realized NUMERIC(10, 4),
  execution_status VARCHAR(50),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executions_timestamp ON executions(timestamp DESC);
CREATE INDEX idx_executions_status ON executions(execution_status);
CREATE INDEX idx_executions_route_id ON executions(route_id);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  alert_id VARCHAR(255) UNIQUE NOT NULL,
  alert_type VARCHAR(100) NOT NULL,
  severity VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP
);

CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created_at ON alerts(created_at DESC);
