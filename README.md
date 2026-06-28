# Casino Referral Bot — Telegram Mini App

Full-stack Telegram Mini App for casino referral tracking. Users register via Telegram, submit casino IDs, get auto-verified as referrals, track deposits, and participate in contests.

**Stack:** Node.js + Express, PostgreSQL, Telegraf (Telegram Bot API), React 18 + Vite.

---

## Quick Start (10 minutes)

### 1. Prerequisites

- Node.js 18+
- PostgreSQL 14+
- A Telegram account (to create the bot)

### 2. Create a Telegram Bot

Open [@BotFather](https://t.me/botfather) and run:

```
/newbot
```

Choose a name (e.g. `My Casino Bot`) and a username (e.g. `my_casino_bot`). BotFather returns a **token** — save it as `BOT_TOKEN`.

Then create a **Mini App**:

```
/mybots → select your bot → Bot Settings → Menu Button → Configure menu button URL
```

Enter your future app URL (e.g. `https://your-app.railway.app`). You can change this later.

### 3. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/repo-name.git
cd repo-name

# Server
cd server
cp .env.example .env
# Edit .env with your values (see below)
npm install

# Client
cd ../client
npm install
```

### 4. Configure Environment

Edit `server/.env`:

```env
# Required — get from @BotFather
BOT_TOKEN=1234567890:ABCdefGHIjklmNOPqrstUVwxyz

# Required — your Telegram user ID (get from @userinfobot)
ADMIN_TELEGRAM_IDS=111111111,222222222

# Required — PostgreSQL connection string
DATABASE_URL=postgresql://user:password@localhost:5432/referral_bot

# Required — public URL of your deployed app (can use localhost for dev)
APP_URL=http://localhost:3000

# Required — at least one referral link
REFERRAL_LINK=https://trackmyaff.com/?serial=YOUR_SERIAL&creative_id=YOUR_ID&anid=YOUR_ANID

# Required for referral/deposit API (generate a random string)
REFERRAL_API_KEY=generate_a_random_256bit_key_here

# Webhook secret (generate via: openssl rand -hex 32)
WEBHOOK_SECRET_PATH=your_64_char_hex_string_here

# Optional — overrides per casino
REFERRAL_LINK_TOPMATCH=
REFERRAL_LINK_BETLINE=
```

Full variable reference is in `server/.env.example`.

### 5. Create the Database

```bash
createdb referral_bot
# Or via psql:
# CREATE DATABASE referral_bot;
```

The schema auto-migrates on first startup.

### 6. Run Locally (Development)

```bash
# Terminal 1: Server
cd server
npm run dev

# Terminal 2: Client
cd client
npm start
```

The client dev server runs on `http://localhost:3001` and proxies `/api` to the server on `http://localhost:3000`.

**In dev mode**, Telegram auth is **disabled by default**. To enable it, set:

```env
DEV_MODE=true
DEV_TELEGRAM_ID=your_telegram_id
```

> **Never set `DEV_MODE=true` in production.**

### 7. Open in Telegram

1. Send `/start` to your bot
2. Click the **"Open App"** button
3. The Mini App opens inside Telegram

---

## Architecture

```
┌─────────────────────────┐     ┌──────────────────────┐
│   Telegram User         │     │  Casino Backend      │
│   (Mini App / Bot)      │     │  (external)          │
└─────────┬───────────────┘     └──────────┬───────────┘
          │ Telegram API                   │ HTTP (API Key)
          ▼                                ▼
┌─────────────────────────────────────────────────────────┐
│                  Express Server (server/)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  │
│  │ routes   │  │ bot      │  │ db       │  │ config │  │
│  │ (API)    │  │ (Telegraf)│  │ (PG)     │  │ (.env) │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────┘  │
└──────────────────────────┬──────────────────────────────┘
                           │ TCP
                           ▼
                    ┌──────────────┐
                    │  PostgreSQL  │
                    └──────────────┘
```

### Key Flows

**Referral Verification:**
1. Casino backend calls `POST /api/referral/check` with the user's casino account ID
2. System records the referral and auto-sets Level 1 if linked to a Telegram user
3. User opens Mini App, submits their casino ID
4. System checks `confirmed_referrals` table → if found, auto-approves; if not, rejects with notification

**Deposit Tracking:**
1. Casino backend calls `POST /api/deposit` with amount and casino account ID
2. First deposit → Level 2. Total deposits ≥ admin threshold → Level 3
3. User can view deposit totals per casino on the Deposits page

**Admin Controls:**
- Set deposit thresholds for Level 3 via admin Settings page
- Manage users, contests, broadcasts from admin dashboard

---

## API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/init` | Telegram initData | Register or login user |
| POST | `/api/auth/language` | Telegram initData | Update language preference |

### User
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/user/me` | Telegram initData | Current user profile |
| GET | `/api/user/deposits` | Telegram initData | Deposit totals per casino |
| GET | `/api/casino/:id/me` | Telegram initData | Casino-specific user data + referral link |
| POST | `/api/casino/:id/submit-id` | Telegram initData | Submit casino account ID (auto-checks referral) |
| POST | `/api/casino/:id/submit-wallet` | Telegram initData | Submit TRC20 wallet address |
| POST | `/api/wallet/:casinoId/submit` | Telegram initData | Alt wallet submission endpoint |

### Casino API (server-to-server)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/referral/check` | `Authorization: Bearer <REFERRAL_API_KEY>` | Report a user as referral → Level 1 |
| POST | `/api/deposit` | `Authorization: Bearer <REFERRAL_API_KEY>` | Report a deposit → Level 2/3 |

### Contests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/contests?casino=topmatch` | Telegram initData | Active contests for user's level |
| GET | `/api/contests/history?casino=topmatch` | Telegram initData | Contest history |
| POST | `/api/contests/:id/join` | Telegram initData | Join a contest |
| POST | `/api/contests/:id/leave` | Telegram initData | Leave a contest |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/users` | Admin (telegram_id) | Paginated user list with filters |
| GET | `/api/admin/users/:id` | Admin | User details |
| POST | `/api/admin/users/:id/verify` | Admin | Approve/reject user |
| POST | `/api/admin/users/:id/set-level` | Admin | Set user level (1/2/3) |
| POST | `/api/admin/users/:id/ban` | Admin | Ban user |
| POST | `/api/admin/users/:id/unban` | Admin | Unban user |
| GET | `/api/admin/contests` | Admin | All contests |
| POST | `/api/admin/contests` | Admin | Create contest |
| PUT | `/api/admin/contests/:id` | Admin | Update contest |
| DELETE | `/api/admin/contests/:id` | Admin | Delete contest |
| POST | `/api/admin/contests/:id/pick-winner` | Admin | Pick random winner |
| POST | `/api/admin/broadcast` | Admin | Send broadcast to users |
| GET | `/api/admin/stats` | Admin | Dashboard statistics |
| GET | `/api/admin/settings` | Admin | Get admin settings |
| PUT | `/api/admin/settings` | Admin | Update settings (deposit thresholds) |
| GET/POST/PUT/DELETE | `/api/admin/streams` | Admin | Stream management CRUD |
| GET/POST/PUT/DELETE | `/api/admin/announcements` | Admin | Announcement management CRUD |
| GET | `/api/admin/pending-changes` | Admin | List pending wallet/ID changes |
| POST | `/api/admin/pending-changes/:id/approve` | Admin | Approve pending change |
| POST | `/api/admin/pending-changes/:id/reject` | Admin | Reject pending change |
| POST | `/api/admin/upload` | Admin | Upload banner image |

---

## Deploy to Production

### Railway (recommended)

1. Push your repo to GitHub
2. Create a Railway project from the repo
3. Set root directory to `server/`
4. Add all env vars from `.env.example` in Railway dashboard
5. Add a PostgreSQL plugin — Railway provides `DATABASE_URL`
6. Set `NODE_ENV=production` and `WEBHOOK_URL=https://your-app.railway.app`
7. Deploy — migrations run automatically on startup
8. Set the Telegram webhook:

```bash
curl -F "url=https://your-app.railway.app/webhook/YOUR_WEBHOOK_SECRET_PATH" \
     -F "secret_token=YOUR_WEBHOOK_SECRET_PATH" \
     https://api.telegram.org/bot<BOT_TOKEN>/setWebhook
```

### Vercel (serverless)

The `api/index.js` provides a Vercel serverless entry point. Deploy with:

```bash
# Build the client first
cd client && npm run build

# Deploy the project root to Vercel
vercel --prod
```

The `vercel.json` handles routing. Ensure all env vars are set in Vercel project settings.

---

## Setting Up Casino Referral/Deposit API

The referral and deposit endpoints require the casino's backend to send API calls with the `REFERRAL_API_KEY`.

### Example: Reporting a Referral

```bash
curl -X POST https://your-app.com/api/referral/check \
  -H "Authorization: Bearer YOUR_REFERRAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "casino": "topmatch",
    "casino_account_id": "player123",
    "telegram_id": 822479618
  }'
```

The casino should call this when a new user registers via the referral link. The `telegram_id` is embedded in the referral link as `sub_id=<telegram_id>`.

### Example: Reporting a Deposit

```bash
curl -X POST https://your-app.com/api/deposit \
  -H "Authorization: Bearer YOUR_REFERRAL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "casino": "topmatch",
    "casino_account_id": "player123",
    "amount": 50.00
  }'
```

The casino should call this whenever the user makes a deposit. The system automatically manages level progression.

---

## Level System

| Level | Requirement | Auto-granted? |
|-------|-------------|---------------|
| 1 | User is a confirmed referral | Yes — via `/api/referral/check` |
| 2 | User made any deposit | Yes — via `/api/deposit` |
| 3 | Total deposits ≥ threshold | Yes — configurable in admin Settings |

Admins can also manually set any level via the admin panel.

---

## Security Notes

- **Telegram initData** is verified via HMAC-SHA256 on every request
- **Admin access** is gated by `ADMIN_TELEGRAM_IDS` — only those Telegram IDs can access admin routes
- **Referral/deposit API** is protected by `REFERRAL_API_KEY` — keep this secret
- **Rate limiting** on all endpoints (global 100/min, auth 10/min)
- **No secrets in client bundle** — pre-build scanner checks this
- **All SQL uses parameterized queries** — no string concatenation
- **Session tokens** use HMAC-SHA256 with timing-safe comparison
- **File uploads** are restricted to image types by extension and MIME

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Bot doesn't respond | Check `BOT_TOKEN` is correct; in production, ensure webhook is set |
| Mini App shows "This app must be opened from Telegram" | You're accessing via browser, not Telegram; use `DEV_MODE=true` for local dev |
| Auth fails in production | Ensure `NODE_ENV=production` is set (otherwise auth is bypassed) |
| Referral API returns 503 | Set `REFERRAL_API_KEY` in environment |
| Database errors on startup | Check `DATABASE_URL` and that PostgreSQL is running |
| 401 on admin routes | Your Telegram ID must be in `ADMIN_TELEGRAM_IDS` |

---

## Project Structure

```
/
├── server/               # Node.js + Express backend
│   ├── index.js          # Entry point, startup
│   ├── app.js            # Express app (middleware, CORS, static)
│   ├── bot.js            # Telegraf bot (commands, notifications)
│   ├── db.js             # PostgreSQL connection + schema migration
│   ├── middleware.js     # Auth: Telegram initData, admin, session
│   ├── routes.js         # All API routes (~1600 lines)
│   ├── casinos.js        # Casino config objects
│   ├── .env.example      # Template (safe for git)
│   └── .env              # Actual secrets (git-ignored)
├── client/               # React 18 + Vite
│   ├── src/
│   │   ├── App.jsx       # Routes, auth init
│   │   ├── axios.jsx     # Axios with Telegram initData interceptor
│   │   ├── contexts/     # AppContext (user, theme, admin state)
│   │   ├── components/   # BottomNav, AdminNav, Notifications
│   │   ├── pages/        # Home, Casino, Contests, Deposits, Settings
│   │   └── locales/      # uk.json, ru.json (i18next)
│   └── vite.config.js
├── api/index.js          # Vercel serverless entry point
├── scripts/check-secrets.js  # Pre-build secret scanner
├── resources/photos/     # Casino banner backgrounds
└── vercel.json           # Vercel deployment config
```
