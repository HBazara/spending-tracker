# Spending Tracker

A mobile-first budgeting app. Set a monthly budget, split it across categories
by dollar amount or percentage, log expenses, and see where you stand.

**Live:** https://spending-tracker-nu.vercel.app

No bank credentials are ever requested or stored.

## Features

- **Budget by goal.** Set a monthly total, then allocate it across categories
  as fixed dollar amounts or percentages. Percentage budgets resolve against
  the monthly total, so raising the total raises those categories with it.
- **Expense entry.** Amount, merchant, category, date, and an optional note.
- **At-a-glance progress.** A ring for the month overall, with a proportional
  red arc showing how far past the budget you are, plus per-category bars
  sorted worst-offender first.
- **Threshold alerts.** Get warned when an expense pushes you past a set
  percentage of any budget. One global threshold with per-category overrides.
- **Installable.** A PWA, so it adds to a phone home screen and runs without
  browser chrome.

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React + Vite |
| Backend, database, auth | Supabase (Postgres) |
| Hosting | Vercel |

No UI framework and no chart library. The progress ring is hand-rolled SVG
using `stroke-dasharray`.

## Security model

Every user-owned table has Row Level Security enabled with a policy scoped to
`auth.uid()`, so the database itself enforces that users only ever read their
own rows. The published anon key is safe to expose precisely because of this.

Two things that are easy to get wrong and are handled explicitly in
`schema.sql`:

- **Views need `security_invoker = on`.** Without it a view runs as its owner
  and reads straight around the RLS policy on the underlying table.
- **`SECURITY DEFINER` functions need `EXECUTE` revoked.** Supabase exposes
  every function in the `public` schema as a REST endpoint, so the signup
  trigger function is explicitly revoked from `anon` and `authenticated`.

Money is stored as integer cents throughout. Floating point loses pennies on
arithmetic and totals drift.

## Running it locally

```bash
git clone https://github.com/HBazara/spending-tracker.git
cd spending-tracker
npm install
```

Create a Supabase project and run `schema.sql` in its SQL editor. That builds
every table, policy, index, and the trigger that seeds a new user's default
categories.

Copy `.env.example` to `.env` and fill in your project's values:

```
VITE_SUPABASE_URL=https://yourproject.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then:

```bash
npm run dev
```

### Auth setup

Email codes work out of the box. For Google sign-in, create an OAuth client in
the Google Cloud console with these settings, then paste the client ID and
secret into Supabase under Authentication → Providers → Google:

- Authorized JavaScript origin: `https://<your-project>.supabase.co`
- Authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback`

Add your deployed URL and `http://localhost:5173` to Supabase under
Authentication → URL Configuration.

## Roadmap

Automatic expense capture from bank alert emails: forward alerts to a
per-user inbound address, parse them against per-bank templates, and drop
anything unrecognized into a review queue. The schema already carries the
columns for it (`transactions.source`, `transactions.status`,
`profiles.inbound_alias`, and the `bank_templates` table).
