-- ============================================================
-- Spending tracker: database schema
--
-- This file documents the full database structure. It is the
-- recipe for rebuilding the backend from scratch.
--
-- Run this once in the Supabase SQL editor on a NEW project.
-- Do not re-run it on a database that already has these tables.
--
-- Every user-owned table has RLS enabled with a policy scoped
-- to auth.uid(). Every view has security_invoker = on. Do not
-- skip either: RLS on a table does nothing if a view or a
-- SECURITY DEFINER function can read around it.
-- ============================================================

-- ---------- profiles ----------
-- One row per auth user, created automatically by the trigger
-- at the bottom of this file.
-- monthly_budget is stored in cents, like all money here.
-- inbound_alias is reserved for email ingestion (Phase 3).
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  display_name   text,
  currency       char(3) not null default 'CAD',
  monthly_budget bigint not null default 0,
  alert_threshold int not null default 80,
  inbound_alias  text unique,
  created_at     timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- categories ----------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  icon       text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table public.categories enable row level security;

create policy "own categories" on public.categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.categories (user_id);

-- ---------- transactions ----------
-- amount is stored in cents as an integer. Never use float for
-- money: 0.1 + 0.2 is not 0.3 in floating point, and totals drift.
-- Positive = money out. Negative = refund or income.
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      bigint not null,
  merchant    text not null,
  category_id uuid references public.categories(id) on delete set null,
  occurred_at date not null default current_date,
  note        text,
  source      text not null default 'manual'
                check (source in ('manual', 'email')),
  status      text not null default 'confirmed'
                check (status in ('confirmed', 'needs_review')),
  created_at  timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.transactions (user_id, occurred_at desc);
create index on public.transactions (user_id, status);

-- ---------- budgets ----------
-- One budget per category, recurring rather than per-month.
-- Exactly one of amount (cents) or percent is set. A percent budget
-- resolves against profiles.monthly_budget at read time, so raising
-- the overall budget raises every percentage-based category with it.
-- alert_threshold null means "use the profile's global threshold".
create table public.budgets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category_id     uuid not null references public.categories(id) on delete cascade,
  amount          bigint,
  percent         numeric(5,2),
  alert_threshold int,
  constraint budgets_one_mode check (
    (amount is not null and percent is null) or
    (amount is null and percent is not null)
  ),
  constraint budgets_user_category_key unique (user_id, category_id)
);

alter table public.budgets enable row level security;

create policy "own budgets" on public.budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.budgets (user_id);

-- ---------- goals ----------
create table public.goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  target_amount bigint not null,
  saved_amount  bigint not null default 0,
  target_date   date,
  created_at    timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.goals (user_id);

-- ---------- merchant_rules ----------
-- Learned per user. "TIM HORTONS" -> Restaurants, applied to
-- future transactions whose merchant matches the pattern.
create table public.merchant_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  pattern     text not null,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, pattern)
);

alter table public.merchant_rules enable row level security;

create policy "own merchant rules" on public.merchant_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on public.merchant_rules (user_id);

-- ---------- bank_templates ----------
-- Global, not per-user. Every template added helps every user.
-- Unused until Phase 3. Readable by any signed-in user, writable
-- only via the service role key.
create table public.bank_templates (
  id             uuid primary key default gen_random_uuid(),
  bank_name      text not null,
  from_pattern   text not null,
  amount_regex   text not null,
  merchant_regex text not null,
  date_regex     text,
  enabled        boolean not null default true,
  created_at     timestamptz not null default now()
);

alter table public.bank_templates enable row level security;

create policy "anyone signed in can read templates"
  on public.bank_templates
  for select to authenticated using (true);

-- ============================================================
-- New user bootstrap
-- Creates a profile and seven default categories on signup, so
-- a new user never lands in an empty app.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));

  insert into public.categories (user_id, name, icon, sort_order)
  values
    (new.id, 'Groceries',   'shopping-cart', 1),
    (new.id, 'Restaurants', 'utensils',      2),
    (new.id, 'Transport',   'bus',           3),
    (new.id, 'Bills',       'receipt',       4),
    (new.id, 'Fun',         'sparkles',      5),
    (new.id, 'Investing',   'trending-up',   6),
    (new.id, 'Other',       'circle',        7);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Supabase exposes every function in the public schema as a REST
-- endpoint. This one is SECURITY DEFINER, so it must not be
-- callable directly. Revoking EXECUTE does not affect the trigger,
-- which checks privileges at creation time, not on each fire.
revoke execute on function public.handle_new_user()
  from public, anon, authenticated;

-- ============================================================
-- Monthly spend by category, for future breakdown views.
-- security_invoker = on makes the view run as the calling user
-- so RLS on transactions applies. Without it the view runs as
-- its owner and leaks every user's totals.
-- ============================================================
create or replace view public.monthly_category_totals
  with (security_invoker = on) as
select
  t.user_id,
  date_trunc('month', t.occurred_at)::date as period,
  t.category_id,
  c.name  as category_name,
  sum(t.amount) as total
from public.transactions t
left join public.categories c on c.id = t.category_id
where t.status = 'confirmed'
group by t.user_id, 1, 2, 3, 4;
