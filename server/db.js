const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const migrate = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        telegram_username VARCHAR(255),
        language VARCHAR(2) DEFAULT 'uk',
        casino_id VARCHAR(32),
        status VARCHAR(20) DEFAULT 'pending',
        level_topmatch INTEGER DEFAULT NULL,
        level_tonplay INTEGER DEFAULT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS referral_type
    `);

    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS casino_id
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS level_topmatch INTEGER DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS level_tonplay INTEGER DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS casino_id_topmatch VARCHAR(32) DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS casino_id_tonplay VARCHAR(32) DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_topmatch VARCHAR(100) DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_tonplay VARCHAR(100) DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ALTER COLUMN status SET DEFAULT 'verified'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contests (
        id SERIAL PRIMARY KEY,
        title_uk VARCHAR(500) NOT NULL,
        title_ru VARCHAR(500) NOT NULL,
        description_uk TEXT NOT NULL,
        description_ru TEXT NOT NULL,
        prize_uk VARCHAR(500) NOT NULL,
        prize_ru VARCHAR(500) NOT NULL,
        eligible_referral_type INTEGER NOT NULL,
        casino VARCHAR(20) DEFAULT 'topmatch',
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE contests ADD COLUMN IF NOT EXISTS casino VARCHAR(20) DEFAULT 'topmatch'
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS contest_winners (
        id SERIAL PRIMARY KEY,
        contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        picked_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS broadcasts (
        id SERIAL PRIMARY KEY,
        message_uk TEXT NOT NULL,
        message_ru TEXT NOT NULL,
        target_casino VARCHAR(20),
        target_level INTEGER,
        sent_at TIMESTAMP DEFAULT NOW()
      )
    `);

    await client.query(`
      ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS target_casino VARCHAR(20)
    `);

    await client.query(`
      ALTER TABLE broadcasts ADD COLUMN IF NOT EXISTS target_level INTEGER
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pending_changes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        field VARCHAR(50) NOT NULL,
        old_value VARCHAR(100),
        new_value VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id)
      )
    `);

    await client.query('COMMIT');
    console.log('Database migration completed successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, migrate };