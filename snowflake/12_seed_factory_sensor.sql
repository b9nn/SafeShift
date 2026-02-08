-- ============================================================================
-- SafeShift Snowflake — Seed Factory & Sensor for Arduino Bridge
-- ============================================================================
-- Run this before sending live data from the Arduino.
-- Matches default deviceId and companyId in SafeShiftArduino.ino:
--   deviceId: arduino-001
--   companyId: company-001
--
-- Adjust values below if you use different IDs.
-- ============================================================================

USE DATABASE SAFE_SHIFT;
USE SCHEMA ANALYTICS;

-- Add factory (companyId in Arduino)
MERGE INTO DIM_FACTORY t
USING (SELECT 'company-001' AS factory_id) s
ON t.factory_id = s.factory_id
WHEN NOT MATCHED THEN INSERT (
  factory_id, factory_name, country, region, industry_sector, is_active
) VALUES (
  'company-001', 'Demo Factory', 'USA', 'North America', 'Manufacturing', TRUE
);

-- Add sensor node (deviceId in Arduino)
MERGE INTO DIM_SENSOR_NODE t
USING (SELECT 'arduino-001' AS sensor_node_id) s
ON t.sensor_node_id = s.sensor_node_id
WHEN NOT MATCHED THEN INSERT (
  sensor_node_id, factory_id, node_type, location_zone, is_active
) VALUES (
  'arduino-001', 'company-001', 'ARDUINO_NANO_33_BLE', 'Floor 1', TRUE
)
WHEN MATCHED THEN UPDATE SET
  factory_id = 'company-001',
  last_seen = CURRENT_TIMESTAMP();

SELECT 'Seeded factory company-001 and sensor arduino-001' AS status;
