-- Development Seed Data

-- Sample executions
INSERT INTO executions (execution_id, route_id, transaction_hash, input_token, output_token, profit_usd, roi_realized, execution_status)
VALUES 
  ('exec_001', 'route_001', '0x123...', 'USDC', 'USDT', 10.50, 0.52, 'success'),
  ('exec_002', 'route_002', '0x456...', 'ETH', 'WETH', 25.00, 1.25, 'success');

-- Sample alerts
INSERT INTO alerts (alert_id, alert_type, severity, message, status)
VALUES 
  ('alert_001', 'system', 'info', 'System started successfully', 'resolved'),
  ('alert_002', 'performance', 'warning', 'High latency detected', 'active');
