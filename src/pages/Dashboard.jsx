import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fromCents } from '../lib/money'
import AddExpense from './AddExpense'
import Budgets from './Budgets'

export default function Dashboard({ session }) {
  const userId = session.user.id
  const [budget, setBudget] = useState(0)
  const [txns, setTxns] = useState([])
  const [categories, setCategories] = useState([])
  const [adding, setAdding] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [loading, setLoading] = useState(true)

  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  const load = useCallback(async () => {
    const [p, t, c] = await Promise.all([
      supabase.from('profiles').select('monthly_budget').single(),
      supabase
        .from('transactions')
        .select('id, amount, merchant, occurred_at, categories(name)')
        .gte('occurred_at', monthStartStr)
        .order('occurred_at', { ascending: false }),
      supabase.from('categories').select('id, name').order('sort_order'),
    ])
    setBudget(p.data?.monthly_budget ?? 0)
    setTxns(t.data ?? [])
    setCategories(c.data ?? [])
    setLoading(false)
  }, [monthStartStr])

  useEffect(() => { load() }, [load])



  if (loading) return <p style={{ padding: 24 }}>Loading...</p>

  const spent = txns.reduce((sum, t) => sum + t.amount, 0)
  const left = budget - spent
  const over = spent > budget && budget > 0

  // Ring represents one budget. Under budget: one partial arc.
  // Over budget: full arc, plus a red second lap sized to the
  // overage. Capped at one full lap so 10x over still renders.
  const basePct = budget > 0 ? Math.min(spent / budget, 1) : 0
  const overPct = over ? Math.min((spent - budget) / budget, 1) : 0

  const R = 80
  const C = 2 * Math.PI * R

  if (adding) {
    return (
      <AddExpense
        categories={categories}
        userId={userId}
        onSaved={() => { setAdding(false); load() }}
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
        <button onClick={() => setEditingBudget(true)} style={linkBtn}>edit</button>
      </p>

      <div style={{ width: '100%', maxWidth: 380 }}>
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
const linkBtn = {
  background: 'none', border: 'none', color: '#888',
  textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: 'inherit',
}
const fab = {
  position: 'fixed', bottom: 28, right: 28,
  width: 60, height: 60, borderRadius: 30,
  background: '#111', color: '#fff', fontSize: 30,
  border: 'none', cursor: 'pointer', lineHeight: 1,
  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
}