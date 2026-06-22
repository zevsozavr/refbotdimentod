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
        referral_type INTEGER,
        created_at TIMESTAMP DEFAULT NOW()
      )
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
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      )
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
        target_referral_type INTEGER,
        sent_at TIMESTAMP DEFAULT NOW()
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
