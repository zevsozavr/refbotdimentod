const { Pool } = require('pg');

// Accept whichever connection string the host injects.
// Vercel Postgres / Neon set POSTGRES_URL (pooled) and POSTGRES_URL_NON_POOLING
// (direct); others use DATABASE_URL. On serverless prefer the POOLED url so we
// don't open a fresh direct connection per cold start (slow + connection storms).
const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

// Managed/cloud Postgres (Vercel, Neon, Supabase, …) requires SSL.
// Only a local database (localhost/127.0.0.1) goes without it.
const isLocal = !!connectionString && /@(localhost|127\.0\.0\.1)[:/]/.test(connectionString);
const isServerless = !!process.env.VERCEL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && !isLocal ? { rejectUnauthorized: false } : undefined,
  // Keep each lambda's footprint small; a long-lived host can hold more.
  max: isServerless ? 2 : 10,
  idleTimeoutMillis: isServerless ? 10000 : 30000,
  connectionTimeoutMillis: 10000,
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
        level_betline INTEGER DEFAULT NULL,
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
      ALTER TABLE users ADD COLUMN IF NOT EXISTS casino_id_topmatch VARCHAR(32) DEFAULT NULL
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_topmatch VARCHAR(100) DEFAULT NULL
    `);

    // ── Rename tonplay → betline (data-preserving) ──
    // Rename existing user columns only if the old name exists and the new one does not.
    for (const [oldCol, newCol] of [
      ['level_tonplay', 'level_betline'],
      ['casino_id_tonplay', 'casino_id_betline'],
      ['wallet_tonplay', 'wallet_betline'],
    ]) {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${oldCol}')
             AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='${newCol}') THEN
            ALTER TABLE users RENAME COLUMN ${oldCol} TO ${newCol};
          END IF;
        END $$;
      `);
    }

    // Ensure the betline columns exist for fresh databases.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS level_betline INTEGER DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS casino_id_betline VARCHAR(32) DEFAULT NULL`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_betline VARCHAR(100) DEFAULT NULL`);

    await client.query(`
      ALTER TABLE users ALTER COLUMN status SET DEFAULT 'verified'
    `);

    await client.query(`
      UPDATE users SET telegram_username = NULL WHERE telegram_username = 'dev'
    `);

    await client.query(`
      DELETE FROM users WHERE telegram_id = 1 AND telegram_username IS NULL
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
      ALTER TABLE contests ADD COLUMN IF NOT EXISTS winner_count INTEGER DEFAULT 1
    `);

    await client.query(`
      ALTER TABLE contests ADD COLUMN IF NOT EXISTS banner_image VARCHAR(500) DEFAULT NULL
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
      CREATE TABLE IF NOT EXISTS contest_participants (
        id SERIAL PRIMARY KEY,
        contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        joined_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(contest_id, user_id)
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
        change_type VARCHAR(50) DEFAULT 'casino_id',
        casino VARCHAR(20),
        field VARCHAR(50) NOT NULL,
        old_value VARCHAR(100),
        new_value VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by INTEGER REFERENCES users(id)
      )
    `);

    await client.query(`
      ALTER TABLE pending_changes ADD COLUMN IF NOT EXISTS change_type VARCHAR(50) DEFAULT 'casino_id'
    `);

    await client.query(`
      ALTER TABLE pending_changes ADD COLUMN IF NOT EXISTS casino VARCHAR(20)
    `);

    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_cleared_at TIMESTAMP DEFAULT NULL
    `);

    // Migrate stored casino-identifier values from 'tonplay' to 'betline'
    // (run after all referenced tables are guaranteed to exist).
    await client.query(`UPDATE contests SET casino='betline' WHERE casino='tonplay'`);
    await client.query(`UPDATE broadcasts SET target_casino='betline' WHERE target_casino='tonplay'`);
    await client.query(`UPDATE pending_changes SET casino='betline' WHERE casino='tonplay'`);
    await client.query(`UPDATE pending_changes SET field=replace(field, 'tonplay', 'betline') WHERE field LIKE '%tonplay%'`);

    await client.query('COMMIT');
    console.log('Database migration completed successfully');

    // Apply post-migration alterations outside transaction
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS streams (
          id SERIAL PRIMARY KEY,
          banner_image TEXT,
          link TEXT NOT NULL,
          start_time TIMESTAMPTZ NOT NULL,
          text_ru TEXT,
          text_uk TEXT,
          status TEXT DEFAULT 'scheduled',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) { console.log('streams table already exists or error:', err.message); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS contest_reminders (
          id SERIAL PRIMARY KEY,
          contest_id INTEGER REFERENCES contests(id) ON DELETE CASCADE,
          sent BOOLEAN DEFAULT FALSE,
          sent_at TIMESTAMP
        )
      `);
    } catch (err) { console.log('contest_reminders table already exists or error:', err.message); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS announcements (
          id SERIAL PRIMARY KEY,
          title_uk VARCHAR(500) NOT NULL,
          title_ru VARCHAR(500) NOT NULL,
          text_uk TEXT,
          text_ru TEXT,
          banner_image TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) { console.log('announcements table already exists or error:', err.message); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS confirmed_referrals (
          id SERIAL PRIMARY KEY,
          casino VARCHAR(20) NOT NULL,
          casino_account_id VARCHAR(64) NOT NULL,
          sub_id VARCHAR(64),
          level INTEGER,
          raw_query TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(casino, casino_account_id)
        )
      `);
    } catch (err) { console.log('confirmed_referrals table already exists or error:', err.message); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS deposits (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          casino VARCHAR(20) NOT NULL,
          casino_account_id VARCHAR(64) NOT NULL,
          amount DECIMAL(18, 2) NOT NULL,
          currency VARCHAR(10) DEFAULT 'USD',
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) { console.log('deposits table already exists or error:', err.message); }

    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_deposits_user_casino ON deposits(user_id, casino)`);
    } catch (err) { console.log('deposits index error:', err.message); }

    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_pending_changes_user_status ON pending_changes(user_id, status)`);
    } catch (err) { console.log('pending_changes index error:', err.message); }

    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_settings (
          id SERIAL PRIMARY KEY,
          key VARCHAR(100) UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
    } catch (err) { console.log('admin_settings table already exists or error:', err.message); }

    try {
      await client.query(`
        INSERT INTO admin_settings (key, value) VALUES ('deposit_threshold_topmatch', '1000')
        ON CONFLICT (key) DO NOTHING
      `);
    } catch (err) { console.log('admin_settings seed error:', err.message); }

    try {
      await client.query(`
        INSERT INTO admin_settings (key, value) VALUES ('deposit_threshold_betline', '1000')
        ON CONFLICT (key) DO NOTHING
      `);
    } catch (err) { console.log('admin_settings seed error:', err.message); }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
};

// Cheap schema guard for serverless cold starts: the full migrate() runs a
// large ALTER-heavy transaction that locks core tables. We only need that on a
// fresh database or right after a schema change. `admin_settings` is created
// near the end of migrate(), so its presence means the schema is already set
// up — in that case we skip the heavy migration entirely. Force a full run
// after changing the schema with RUN_MIGRATIONS=true.
let schemaReady = false;
const ensureSchema = async () => {
  if (schemaReady) return;
  try {
    const r = await pool.query("SELECT to_regclass('public.admin_settings') AS t");
    if (r.rows[0] && r.rows[0].t) { schemaReady = true; return; }
  } catch (_) { /* fall through to a full migrate */ }
  await migrate();
  schemaReady = true;
};

module.exports = { pool, migrate, ensureSchema };