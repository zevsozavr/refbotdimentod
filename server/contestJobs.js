// Periodic contest maintenance: start reminders, automatic ending and winner
// selection. Designed to be safe to run from multiple triggers at once
// (a long-lived setInterval on Railway and an HTTP cron on Vercel) — every
// state transition is claimed with a conditional UPDATE so work is never
// done twice.

const { pool } = require('./db');
const { notifyWinner, notifyAdmin, notifyAdminMessage } = require('./bot');

const casinoName = (casino) => (casino === 'topmatch' ? 'TopMatch' : 'Betline');

// Send "starts in 15 minutes" reminders to participants of upcoming contests.
const sendStartReminders = async () => {
  const reminders = await pool.query(
    `SELECT cr.id, cr.contest_id, c.title_uk, c.title_ru, c.start_date, c.casino
     FROM contest_reminders cr
     JOIN contests c ON c.id = cr.contest_id
     WHERE cr.sent = FALSE AND c.status = 'active'
       AND c.start_date <= NOW() + INTERVAL '15 minutes' AND c.start_date > NOW()`
  );
  for (const r of reminders.rows) {
    // Claim this reminder so a concurrent run won't send it again.
    const claim = await pool.query(
      'UPDATE contest_reminders SET sent = TRUE, sent_at = NOW() WHERE id = $1 AND sent = FALSE RETURNING id',
      [r.id]
    );
    if (claim.rows.length === 0) continue;

    const participants = await pool.query(
      `SELECT u.telegram_id, u.language FROM contest_participants cp
       JOIN users u ON u.id = cp.user_id
       WHERE cp.contest_id = $1`,
      [r.contest_id]
    );
    for (const p of participants.rows) {
      const msg = p.language === 'uk'
        ? `🔔 Конкурс "${r.title_uk}" розпочнеться за 15 хвилин!\nКазино: ${casinoName(r.casino)}`
        : `🔔 Конкурс "${r.title_ru}" начнется через 15 минут!\nКазино: ${casinoName(r.casino)}`;
      try { await require('./bot').bot.telegram.sendMessage(p.telegram_id, msg); } catch (e) { /* ignore */ }
    }
  }
};

// Pick winners for a single contest and notify everyone. Assumes the contest
// row has already been claimed (status flipped away from 'active').
const finalizeContest = async (contest) => {
  // Idempotency guard: if winners were already recorded (e.g. a previous run
  // crashed after inserting but before flipping status), don't draw again.
  const existing = await pool.query('SELECT 1 FROM contest_winners WHERE contest_id = $1 LIMIT 1', [contest.id]);
  if (existing.rows.length > 0) {
    await pool.query("UPDATE contests SET status = 'winner_picked' WHERE id = $1", [contest.id]);
    return { contest_id: contest.id, winners: [], alreadyPicked: true };
  }

  const levelColumn = contest.casino === 'topmatch' ? 'level_topmatch' : 'level_betline';
  const walletColumn = contest.casino === 'topmatch' ? 'wallet_topmatch' : 'wallet_betline';
  const winnerCount = contest.winner_count || 1;

  const usersResult = await pool.query(
    `SELECT u.* FROM users u
     JOIN contest_participants cp ON cp.user_id = u.id
     WHERE cp.contest_id = $1
       AND u.status = 'verified'
       AND u.${levelColumn} = $2
       AND u.${walletColumn} IS NOT NULL
     ORDER BY RANDOM() LIMIT $3`,
    [contest.id, contest.eligible_referral_type, winnerCount]
  );

  const winners = usersResult.rows;

  if (winners.length === 0) {
    await pool.query("UPDATE contests SET status = 'ended' WHERE id = $1", [contest.id]);
    await notifyAdminMessage(
      `🏁 Конкурс завершено / Конкурс завершён\n\n` +
      `Казино: ${casinoName(contest.casino)}\n` +
      `Конкурс: ${contest.title_uk}\n` +
      `⚠️ Немає підходящих учасників — переможців не обрано / Нет подходящих участников — победители не выбраны.`
    );
    return { contest_id: contest.id, winners: [] };
  }

  for (const w of winners) {
    await pool.query(
      'INSERT INTO contest_winners (contest_id, user_id) VALUES ($1, $2)',
      [contest.id, w.id]
    );
  }
  await pool.query("UPDATE contests SET status = 'winner_picked' WHERE id = $1", [contest.id]);

  for (const w of winners) {
    try { await notifyWinner(w, contest, w.language); } catch (e) { console.error('notifyWinner error:', e); }
  }
  try { await notifyAdmin(winners, contest); } catch (e) { console.error('notifyAdmin error:', e); }

  return { contest_id: contest.id, winners: winners.map(w => ({ telegram_id: w.telegram_id, telegram_username: w.telegram_username })) };
};

// End contests whose end_date has passed and that are still active.
const endDueContests = async () => {
  // Recover contests left in the transient 'finalizing' state by a crashed run.
  // finalizeContest is idempotent (it skips contests that already have winners),
  // so it is safe to put these back in line for processing.
  await pool.query("UPDATE contests SET status = 'active' WHERE status = 'finalizing'");

  const due = await pool.query(
    "SELECT id FROM contests WHERE status = 'active' AND end_date <= NOW()"
  );
  const results = [];
  for (const row of due.rows) {
    // Claim the contest: flip to a transient 'finalizing' state so only one
    // run processes it. We immediately re-read the full row.
    const claim = await pool.query(
      "UPDATE contests SET status = 'finalizing' WHERE id = $1 AND status = 'active' RETURNING *",
      [row.id]
    );
    if (claim.rows.length === 0) continue;
    try {
      results.push(await finalizeContest(claim.rows[0]));
    } catch (e) {
      console.error(`Finalize contest ${row.id} error:`, e);
      // Roll back the claim so it is retried next tick.
      await pool.query("UPDATE contests SET status = 'active' WHERE id = $1 AND status = 'finalizing'", [row.id]);
    }
  }
  return results;
};

const runContestMaintenance = async () => {
  try {
    await sendStartReminders();
  } catch (err) {
    console.error('Contest reminder error:', err);
  }
  try {
    return await endDueContests();
  } catch (err) {
    console.error('Contest end error:', err);
    return [];
  }
};

module.exports = { runContestMaintenance, finalizeContest, endDueContests, sendStartReminders };
