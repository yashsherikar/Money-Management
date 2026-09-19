# Money Manager

Personal finance tracker: accounts, transactions, categories, monthly savings, EMI/FD/insurance obligations, EMI-to-income health check, unwanted-expense flagging.

Stack: Spring Boot 3 (Java 17) + PostgreSQL + Flyway + JWT auth on the backend, React 18 + Vite + Tailwind + Recharts on the frontend.

## What's built (MVP)

- Signup/login with JWT
- Accounts (bank/cash/card) with running balance
- Transactions (income/expense) with categories, auto-updates account balance
- Predefined + custom categories, tagged essential/non-essential
- Dashboard: income, expense, savings, savings rate, vs last month, spend-by-category chart, "money wasted this month" (non-essential spend)
- EMI tracker with a nightly scheduled job that auto-logs the EMI as an expense once its due day passes each month
- FD tracker with maturity-soon flag (30 days)
- Insurance tracker with premium-due-soon flag (15 days)
- Unified obligations view + EMI-to-income ratio, flagged unhealthy above 40%
- Groups (invite-code based) for splitting purchases with roommates/friends — each member's own accounts/transactions stay private, only group membership is shared
- Wishlist items with an affordability check against your own account balances (affordable / comfortable-with-buffer / short, with a recommendation)
- Contribution requests: ask specific group members to cover part of the shortfall; they accept/decline, then pay you via a generated UPI deep link (`upi://pay?...`) using the UPI ID on your profile; you mark it received once the money lands, which logs it as income on your account
- Udhar tracker: money you lent or borrowed with a contact (name is free text, doesn't need an account), optional link to one of your accounts so the balance moves immediately, settle when repaid, dashboard shows what's owed to you vs what you owe
- Recurring transactions: any monthly expense/income (mobile recharge, sending a fixed amount to parents, rent, subscriptions, salary). On/after its day of the month, a popup asks "did you pay this?" on next login — Yes logs it and moves the account balance, View details shows account/category/amount, closing it just asks again next time (nothing is silently assumed paid). Note: EMIs still auto-log silently on their due day (unchanged, separate feature) — say so if you want that changed to the same confirm-first flow.
- Split bills (one-off, no group needed): log a bill you paid in full, list who owes what by name, mark each person paid as they settle up — optionally deducts the full amount from an account up front and credits it back per person as they pay
- Investment tracker: mutual funds/stocks/SIPs, log buy/sell cash flows plus a manually-updated current value, XIRR computed per investment and across the whole portfolio
- Dark mode: toggle in the sidebar, persisted per browser

Not built yet (v2, on purpose — see feature list you gave): category budgets/alerts, financial health score, notifications, bank statement import, goals, multi-currency, AI insights. Ask for any of these specifically and I'll add them.

## Run locally

Prereqs: JDK 17, Maven, Node 18+, a Postgres database (local or free cloud, see below).

Backend:
```
cd backend
$env:DB_URL="jdbc:postgresql://localhost:5432/moneymanager"   # PowerShell
$env:DB_USERNAME="postgres"
$env:DB_PASSWORD="postgres"
$env:JWT_SECRET="dev-secret-change-me-dev-secret-change-me"
mvn spring-boot:run
```
Flyway creates the schema on startup. API runs on `http://localhost:8080`.

Frontend:
```
cd frontend
npm install
cp .env.example .env
npm run dev
```
Opens on `http://localhost:5173`.

Run backend tests: `cd backend; mvn test`

## Deploy for free

**1. Database — Supabase (free Postgres, no card required)**
- Create a project at supabase.com.
- Settings → Database → Connection string → pick **Session pooler** (port 5432), not "Transaction pooler" (port 6543 breaks Flyway's DDL/prepared statements) and not the raw direct host (IPv6-only, Render can't reach it).
- Host looks like `aws-0-<region>.pooler.supabase.com`, user is `postgres.<project-ref>`.
- Set:
  - `DB_URL` = `jdbc:postgresql://aws-0-<region>.pooler.supabase.com:5432/postgres`
  - `DB_USERNAME` = `postgres.<project-ref>`
  - `DB_PASSWORD` = the DB password you set when creating the project (Settings → Database → reset if forgotten)

**2. Backend — Render (free web service)**
- Push this repo to GitHub.
- On render.com, "New > Blueprint", point it at the repo — it picks up `render.yaml`.
- Fill in `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `ALLOWED_ORIGINS` (your Vercel URL, added after step 3) in the Render dashboard. `JWT_SECRET` is auto-generated.
- Free tier spins down after 15 min idle; first request after that takes ~30s to wake up.

**3. Frontend — Vercel (free)**
- Import the repo on vercel.com, set root directory to `frontend`.
- Add env var `VITE_API_URL` = `https://<your-render-service>.onrender.com/api`.
- Deploy. Then go back to Render and set `ALLOWED_ORIGINS` to your Vercel domain.

Total cost: ₹0. Trade-off: Render free backend cold-starts after idling.

## Note on UPI pay links

`upi://pay?...` links only open a UPI app (GPay, PhonePe, Paytm...) on a phone; on desktop browsers nothing happens. That's the standard UPI intent scheme's limitation, not a bug here — fine since this is meant to be used on mobile.
