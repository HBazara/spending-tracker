import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fromCents } from '../lib/money'
import { resolveBudget, crossedThresholds } from '../lib/budget'
import { monthStartLocal } from '../lib/dates'
import AddExpense from './AddExpense'
import Budgets from './Budgets'

// Sums a transaction list into an overall total plus a per-category map.
// Used twice per save: once on the old list, once on the fresh one, so we
// can tell which thresholds were crossed by THIS expense.
function totalsFrom(list) {
  const byCat = {}
  let total = 0
  for (const t of list) {
    total += t.amount
    if (t.category_id) {
      byCat[t.category_id] = (byCat[t.category_id] ?? 0) + t.amount
    }
  }
  return { total, byCat }
}

export default function Dashboard({ session }) {
  const userId = session.user.id
  const [budget, setBudget] = useState(0)
  const [txns, setTxns] = useState([])
  const [categories, setCategories] = useState([])
  const [budgetRows, setBudgetRows] = useState([])
  const [adding, setAdding] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState([])

  const monthStartStr = monthStartLocal()

  const load = useCallback(async () => {
    const [p, t, c, b] = await Promise.all([
      supabase.from('profiles')
        .select('monthly_budget, alert_threshold').single(),
      supabase
        .from('transactions')
        .select('id, amount, merchant, occurred_at, category_id, categories(name)')
        .gte('occurred_at', monthStartStr)
        .order('occurred_at', { ascending: false }),
      supabase.from('categories').select('id, name').order('sort_order'),
      supabase.from('budgets')
        .select('category_id, amount, percent, alert_threshold'),
    ])

    const next = {
      budget: p.data?.monthly_budget ?? 0,
      threshold: p.data?.alert_threshold ?? 80,
      txns: t.data ?? [],
      categories: c.data ?? [],
      budgetRows: b.data ?? [],
    }

    setBudget(next.budget)
    setTxns(next.txns)
    setCategories(next.categories)
    setBudgetRows(next.budgetRows)
    setLoading(false)

    return next
  }, [monthStartStr])

  useEffect(() => { load() }, [load])

  // Runs after an expense is saved. Compares before and after to find
  // thresholds this expense pushed us past, overall and per category.
  async function handleSaved() {
    const before = totalsFrom(txns)
    setAdding(false)

    const next = await load()
    const after = totalsFrom(next.txns)
    const found = []

    for (const mark of crossedThresholds({
      before: before.total,
      after: after.total,
      limit: next.budget,
      threshold: next.threshold,
    })) {
      found.push({ ...mark, scope: 'your monthly budget' })
    }

    for (const row of next.budgetRows) {
      const limit = resolveBudget(row, next.budget)
      if (!limit) continue
      const name =
        next.categories.find((c) => c.id === row.category_id)?.name
      if (!name) continue

      for (const mark of crossedThresholds({
        before: before.byCat[row.category_id] ?? 0,
        after: after.byCat[row.category_id] ?? 0,
        limit,
        threshold: row.alert_threshold ?? next.threshold,
      })) {
        found.push({ ...mark, scope: name })
      }
    }

    setAlerts(found)
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>

  const { total: spent, byCat } = totalsFrom(txns)
  const left = budget - spent
  const over = spent > budget && budget > 0

  // Ring represents one budget. Under budget: one partial arc.
  // Over budget: full arc, plus a red second lap sized to the
  // overage. Capped at one full lap so 10x over still renders.
  const basePct = budget > 0 ? Math.min(spent / budget, 1) : 0
  const overPct = over ? Math.min((spent - budget) / budget, 1) : 0

  const R = 80
  const C = 2 * Math.PI * R

  // Categories that have a budget set, worst-offender first.
  const catProgress = budgetRows
    .map((row) => {
      const limit = resolveBudget(row, budget)
      const name = categories.find((c) => c.id === row.category_id)?.name
      return {
        id: row.category_id,
        name,
        limit,
        used: byCat[row.category_id] ?? 0,
      }
    })
    .filter((x) => x.name && x.limit > 0)
    .sort((a, b) => b.used / b.limit - a.used / a.limit)

  // Spending in categories with no budget, so the numbers reconcile.
  const budgetedIds = new Set(catProgress.map((c) => c.id))
  const unbudgeted = Object.entries(byCat)
    .filter(([id]) => !budgetedIds.has(id))
    .reduce((sum, [, amt]) => sum + amt, 0)

  if (adding) {
    return (
      <AddExpense
        categories={categories}
        userId={userId}
        onSaved={handleSaved}
        onCancel={() => setAdding(false)}
      />
    )
  }

  if (editingBudget) {
    return (
      <Budgets
        userId={userId}
        onDone={() => { setEditingBudget(false); load() }}
      />
    )
  }

  return (
    <div style={page}>
      {alerts.length > 0 && (
        <div style={{ width: '100%', maxWidth: 380, marginBottom: 16 }}>
          {alerts.map((a, i) => (
            <div
              key={i}
              style={{
                ...banner,
                background: a.kind === 'over' ? '#fdecea' : '#fff6e5',
                color: a.kind === 'over' ? '#9b2c20' : '#8a5a00',
              }}
            >
              {a.kind === 'over'
                ? `You are over ${a.scope}.`
                : `You have used ${a.at}% of ${a.scope}.`}
            </div>
          ))}
          <button onClick={() => setAlerts([])} style={dismissBtn}>
            Dismiss
          </button>
        </div>
      )}

      <svg viewBox="0 0 200 200" style={{ width: 200, height: 200 }}>
        <circle cx="100" cy="100" r={R} fill="none"
          stroke="#eee" strokeWidth="16" />

        <circle cx="100" cy="100" r={R} fill="none"
          stroke="#111" strokeWidth="16" strokeLinecap="round"
          strokeDasharray={`${basePct * C} ${C}`}
          transform="rotate(-90 100 100)" />

        {over && (
          <circle cx="100" cy="100" r={R} fill="none"
            stroke="#c0392b" strokeWidth="16" strokeLinecap="round"
            strokeDasharray={`${overPct * C} ${C}`}
            transform="rotate(-90 100 100)" />
        )}

        <text x="100" y="94" textAnchor="middle"
          fontSize="26" fontWeight="600" fill={over ? '#c0392b' : '#111'}>
          {fromCents(spent)}
        </text>
        <text x="100" y="116" textAnchor="middle" fontSize="12" fill="#888">
          spent this month
        </text>
      </svg>

      <p style={{ color: over ? '#c0392b' : '#666', margin: '4px 0 24px' }}>
        {budget === 0
          ? 'No budget set'
          : over
            ? `${fromCents(Math.abs(left))} over budget`
            : `${fromCents(left)} left of ${fromCents(budget)}`}
        {' · '}
        <button onClick={() => setEditingBudget(true)} style={linkBtn}>
          edit
        </button>
      </p>

      {catProgress.length > 0 && (
        <div style={{ width: '100%', maxWidth: 380, marginBottom: 28 }}>
          <h3 style={sectionHead}>By category</h3>
          {catProgress.map((c) => {
            const pct = Math.min(c.used / c.limit, 1)
            const isOver = c.used > c.limit
            return (
              <div key={c.id} style={{ marginBottom: 14 }}>
                <div style={barLabel}>
                  <span>{c.name}</span>
                  <span style={{ color: isOver ? '#c0392b' : '#888' }}>
                    {fromCents(c.used)} / {fromCents(c.limit)}
                  </span>
                </div>
                <div style={barTrack}>
                  <div
                    style={{
                      ...barFill,
                      width: `${pct * 100}%`,
                      background: isOver ? '#c0392b' : '#111',
                    }}
                  />
                </div>
              </div>
            )
          })}
          {unbudgeted > 0 && (
            <p style={{ fontSize: 12, color: '#aaa', marginTop: 12 }}>
              {fromCents(unbudgeted)} spent in categories with no budget.
            </p>
          )}
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 380 }}>
        <h3 style={sectionHead}>Transactions</h3>
        {txns.length === 0 && (
          <p style={{ color: '#999', textAlign: 'center' }}>
            Nothing yet this month.
          </p>
        )}
        {txns.map((t) => (
          <div key={t.id} style={row}>
            <div>
              <div style={{ fontWeight: 500 }}>{t.merchant}</div>
              <div style={{ fontSize: 13, color: '#888' }}>
                {t.categories?.name ?? 'Uncategorized'} · {t.occurred_at}
              </div>
            </div>
            <div style={{ fontWeight: 600 }}>{fromCents(t.amount)}</div>
          </div>
        ))}
      </div>

      <button
        onClick={() => supabase.auth.signOut()}
        style={signOutBtn}
      >
        Sign out
      </button>

      <button onClick={() => setAdding(true)} style={fab}>+</button>
    </div>
  )
}

const page = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: '32px 24px 100px', fontFamily: 'system-ui, sans-serif',
  maxWidth: 480, margin: '0 auto',
}
const row = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 0', borderBottom: '1px solid #f0f0f0',
}
const sectionHead = {
  fontSize: 13, fontWeight: 600, color: '#888',
  textTransform: 'uppercase', letterSpacing: 0.5,
  margin: '0 0 12px',
}
const barLabel = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: 14, marginBottom: 6,
}
const barTrack = {
  width: '100%', height: 8, background: '#eee',
  borderRadius: 4, overflow: 'hidden',
}
const barFill = { height: '100%', borderRadius: 4 }
const banner = {
  padding: '12px 14px', borderRadius: 10,
  fontSize: 14, marginBottom: 8,
}
const dismissBtn = {
  background: 'none', border: 'none', color: '#888',
  fontSize: 13, cursor: 'pointer', padding: 0,
}
const linkBtn = {
  background: 'none', border: 'none', color: '#888',
  textDecoration: 'underline', cursor: 'pointer', padding: 0,
  fontSize: 'inherit',
}
const signOutBtn = {
  background: 'none', border: 'none', color: '#aaa',
  fontSize: 14, cursor: 'pointer', marginTop: 32, padding: 8,
}
const fab = {
  position: 'fixed', bottom: 28, right: 28,
  width: 60, height: 60, borderRadius: 30,
  background: '#111', color: '#fff', fontSize: 30,
  border: 'none', cursor: 'pointer', lineHeight: 1,
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
}
