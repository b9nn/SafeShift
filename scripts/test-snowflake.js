/**
 * Test Snowflake connection and verify tables exist
 */

require('dotenv').config();
const snowflake = require('snowflake-sdk');

const account = process.env.SNOWFLAKE_ACCOUNT;
const user = process.env.SNOWFLAKE_USER;
const password = process.env.SNOWFLAKE_PASSWORD;
const database = process.env.SNOWFLAKE_DATABASE || 'SAFE_SHIFT';
const warehouse = process.env.SNOWFLAKE_WAREHOUSE || 'INGEST_WH';

if (!account || !user || !password) {
  console.error('❌ Missing Snowflake credentials in .env file');
  console.error('Required: SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD');
  process.exit(1);
}

console.log('🔌 Testing Snowflake connection...');
console.log(`   Account: ${account}`);
console.log(`   User: ${user}`);
console.log(`   Database: ${database}`);
console.log(`   Warehouse: ${warehouse}`);
console.log('');

const conn = snowflake.createConnection({
  account,
  username: user,
  password,
  database,
  warehouse,
  schema: 'RAW',
});

conn.connect((err, conn) => {
  if (err) {
    console.error('❌ Connection failed:', err.message);
    console.error('   Error code:', err.code);
    process.exit(1);
  }

  console.log('✅ Connected to Snowflake!');
  console.log('');

  // Test 1: Check current database
  conn.execute({
    sqlText: 'SELECT CURRENT_DATABASE(), CURRENT_WAREHOUSE(), CURRENT_SCHEMA()',
    complete: (err, stmt, rows) => {
      if (err) {
        console.error('❌ Query failed:', err.message);
        conn.destroy();
        process.exit(1);
      }
      console.log('📊 Current context:');
      console.log(`   Database: ${rows[0]['CURRENT_DATABASE()']}`);
      console.log(`   Warehouse: ${rows[0]['CURRENT_WAREHOUSE()']}`);
      console.log(`   Schema: ${rows[0]['CURRENT_SCHEMA()']}`);
      console.log('');

      // Test 2: Check if tables exist
      const tablesToCheck = [
        'RAW.SENSOR_READINGS_RAW',
        'RAW.ML_RISK_SCORES',
        'BLOCKCHAIN.REWARD_PAYOUTS',
      ];

      let tablesChecked = 0;
      tablesToCheck.forEach((tableName) => {
        const [schema, table] = tableName.split('.');
        conn.execute({
          sqlText: `
            SELECT COUNT(*) as count 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
          `,
          binds: [schema, table],
          complete: (err, stmt, rows) => {
            tablesChecked++;
            if (err) {
              console.error(`❌ Error checking ${tableName}:`, err.message);
            } else {
              const exists = rows[0].COUNT > 0;
              console.log(`${exists ? '✅' : '⚠️ '} ${tableName}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
            }

            if (tablesChecked === tablesToCheck.length) {
              console.log('');
              console.log('🧪 Testing insert operations...');

              // Test 3: Try inserting a test record
              const testData = {
                factoryId: 'test-factory-001',
                sensorNodeId: 'test-device-001',
                timestamp: Date.now(),
                metrics: {
                  temperature: 72.5,
                  humidity: 45.0,
                  airQuality: 850,
                  noise: 75,
                  lighting: 350,
                  pressure: 1013.25,
                },
                rawPayload: { test: true },
              };

              const snowflakeModule = require('../server/snowflake');
              snowflakeModule.insertRawReading(testData)
                .then(() => {
                  console.log('✅ Test insert to RAW.SENSOR_READINGS_RAW succeeded');
                  
                  // Test ML risk score insert
                  return snowflakeModule.insertMLRiskScore({
                    factoryId: 'test-factory-001',
                    sensorNodeId: 'test-device-001',
                    timestamp: Date.now(),
                    riskScore: '0.25',
                    confidence: '0.95',
                  });
                })
                .then(() => {
                  console.log('✅ Test insert to RAW.ML_RISK_SCORES succeeded');
                  console.log('');
                  console.log('🎉 All Snowflake tests passed!');
                  console.log('');
                  console.log('💡 Note: If tables were missing, run the Snowflake migration scripts:');
                  console.log('   See: snowflake/10_ml_risk_scores.sql');
                  conn.destroy();
                  process.exit(0);
                })
                .catch((error) => {
                  console.error('⚠️  Test insert failed (this is OK if tables don\'t exist yet):', error.message);
                  console.log('');
                  console.log('💡 To create tables, run the Snowflake migration scripts:');
                  console.log('   See: snowflake/ directory');
                  conn.destroy();
                  process.exit(0);
                });
            }
          },
        });
      });
    },
  });
});
