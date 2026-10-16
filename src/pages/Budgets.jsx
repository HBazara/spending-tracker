import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fromCents, toCents } from '../lib/money'

export default function Budgets({ userId, onDone }) {
  const [monthly, setMonthly] = useState(0)
  // Raw text for the monthly field. A controlled input must hold what the
  // user typed, not a reformatted version of it, or the cursor jumps on
  // every keystroke. Parsing happens on blur and on save.
  const [monthlyText, setMonthlyText] = useState('')
  const [globalThreshold, setGlobalThreshold] = useState(80)
  const [categories, setCategories] = useState([])
  const [rows, setRows] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const [p, c, b] = await Promise.all([
        supabase.from('profiles')
          .select('monthly_budget, alert_threshold').single(),
        supabase.from('categories').select('id, name').order('sort_order'),
        supabase.from('budgets')
          .select('category_id, amount, percent, alert_threshold'),
      ])

      const mb = p.data?.monthly_budget ?? 0
      setMonthly(mb)
      setMonthlyText(mb ? (mb / 100).toFixed(2) : '')
      setGlobalThreshold(p.data?.alert_threshold ?? 80)
      setCategories(c.data ?? [])

      const map = {}
      for (const cat of c.data ?? []) {
        const existing = (b.data ?? []).find((x) => x.category_id === cat.id)
        map[cat.id] = existing
          ? {
              mode: existing.percent != null ? 'percent' : 'amount',
              value: existing.percent != null
                ? String(existing.percent)
                : String((existing.amount / 100).toFixed(2)),
              threshold: existing.alert_threshold ?? '',
            }
          : { mode: 'amount', value: '', threshold: '' }
      }
      setRows(map)
      setLoading(false)
    }
    load()
  }, [])

  function update(catId, patch) {
    setRows((r) => ({ ...r, [catId]: { ...r[catId], ...patch } }))
  }

  const allocated = categories.reduce((sum, cat) => {
    const r = rows[cat.id]
    if (!r?.value) return sum
    if (r.mode === 'percent') {
      const pct = parseFloat(r.value)
      return sum + (isNaN(pct) ? 0 : Math.round(monthly * pct / 100))
    }
    return sum + (toCents(r.value) ?? 0)
  }, 0)

  const overAllocated = allocated > monthly && monthly > 0
  const unallocated = monthly - allocated

  async function save() {
    setSaving(true)

    const threshold =
      globalThreshold === '' || isNaN(globalThreshold) ? 80 : globalThreshold

    await supabase.from('profiles').update({
      monthly_budget: monthly,
      alert_threshold: threshold,
    }).eq('id', userId)

    await supabase.from('budgets').delete().eq('user_id', userId)

    const inserts = []
    for (const cat of categories) {
      const r = rows[cat.id]
      if (!r?.value) continue

      const catThreshold =
        r.threshold === '' || r.threshold == null ? null : parseInt(r.threshold)

      if (r.mode === 'percent') {
        const pct = parseFloat(r.value)
        if (isNaN(pct) || pct <= 0) continue
        inserts.push({
          user_id: userId, category_id: cat.id,
          percent: pct, amount: null, alert_threshold: catThreshold,
        })
      } else {
        const cents = toCents(r.value)
        if (!cents) continue
        inserts.push({
          user_id: userId, category_id: cat.id,
          amount: cents, percent: null, alert_threshold: catThreshold,
        })
      }
    }

    if (inserts.length) await supabase.from('budgets').insert(inserts)

    setSaving(false)
    onDone()
  }

  if (loading) return <p style={{ padding: 24 }}>Loading...</p>

  return (
    <div style={page}>
      <h2 style={{ margin: '0 0 4px', fontSize: 22 }}>Budget</h2>
      <p style={{ color: '#888', fontSize: 14, margin: '0 0 24px' }}>
        Set a monthly total, then split it however you want.
      </p>

      <label style={label}>Monthly total</label>
      <input
        type="text" inputMode="decimal"
        value={monthlyText}
        placeholder="0.00"
        onChange={(e) => {
          const raw = e.target.value
          setMonthlyText(raw)
          setMonthly(toCents(raw) ?? 0)
        }}
        onBlur={() => {
          const cents = toCents(monthlyText)
          setMonthlyText(cents ? (cents / 100).toFixed(2) : '')
        }}
        style={{ ...input, fontSize: 24, fontWeight: 600 }}
      />

      <label style={label}>Alert me at (% of any budget)</label>
      <input
        type="number" min="1" max="99"
        value={globalThreshold}
        onChange={(e) => {
          const v = e.target.value
          setGlobalThreshold(v === '' ? '' : parseInt(v))
        }}
        onBlur={() => {
          if (globalThreshold === '' || isNaN(globalThreshold)) {
            setGlobalThreshold(80)
          }
        }}
        style={input}
      />

      <div style={{
        margin: '28px 0 8px', display: 'flex',
        justifyContent: 'space-between', fontSize: 14,
        color: overAllocated ? '#c0392b' : '#888',
      }}>
        <span>Allocated</span>
        <span>{fromCents(allocated)} of {fromCents(monthly)}</span>
      </div>

      {overAllocated && (
        <p style={{ color: '#c0392b', fontSize: 13, margin: '0 0 12px' }}>
          You have allocated more than your total. That is allowed, but you
          will go over if you spend it all.
        </p>
      )}
      {!overAllocated && monthly > 0 && unallocated > 0 && (
        <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
          {fromCents(unallocated)} unallocated.
        </p>
      )}

      {categories.map((cat) => {
        const r = rows[cat.id] ?? { mode: 'amount', value: '', threshold: '' }
        const resolved = r.mode === 'percent' && r.value
          ? Math.round(monthly * (parseFloat(r.value) || 0) / 100)
          : null

        return (
          <div key={cat.id} style={catRow}>
            <div style={{ fontWeight: 500, marginBottom: 8 }}>{cat.name}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select
                value={r.mode}
                onChange={(e) => update(cat.id, { mode: e.target.value, value: '' })}
                style={{ ...input, width: 80, marginBottom: 0 }}
              >
                <option value="amount">$</option>
                <option value="percent">%</option>
              </select>
              <input
                type="text" inputMode="decimal"
                placeholder={r.mode === 'percent' ? '15' : '0.00'}
                value={r.value}
                onChange={(e) => update(cat.id, { value: e.target.value })}
                style={{ ...input, flex: 1, marginBottom: 0 }}
              />
              <input
                type="number" min="1" max="99"
                placeholder={String(globalThreshold || 80)}
                value={r.threshold}
                onChange={(e) => update(cat.id, { threshold: e.target.value })}
                style={{ ...input, width: 70, marginBottom: 0 }}
              />
            </div>
            {resolved != null && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                = {fromCents(resolved)}
              </div>
            )}
          </div>
        )
      })}

      <p style={{ fontSize: 12, color: '#aaa', marginTop: 16 }}>
        The last box is the alert threshold for that category. Leave it blank
        to use your global {globalThreshold || 80}%.
      </p>

      <button onClick={save} disabled={saving} style={primaryBtn}>
        {saving ? 'Saving...' : 'Save budget'}
      </button>
      <button onClick={onDone} style={ghostBtn}>Cancel</button>
    </div>
  )
}

const page = {
  maxWidth: 440, margin: '0 auto', padding: '32px 24px 60px',
  fontFamily: 'system-ui, sans-serif',
}
const label = {
  display: 'block', fontSize: 13, color: '#666',
  margin: '16px 0 6px', fontWeight: 500,
}
const input = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1px solid #ddd', borderRadius: 10,
  boxSizing: 'border-box', marginBottom: 4, background: '#fff',
}
const catRow = { padding: '14px 0', borderTop: '1px solid #f0f0f0' }
const primaryBtn = {
  width: '100%', padding: '15px', fontSize: 16, fontWeight: 600,
  color: '#fff', background: '#111', border: 'none',
  borderRadius: 10, marginTop: 28, cursor: 'pointer',
}
const ghostBtn = {
  width: '100%', padding: '15px', fontSize: 16, color: '#666',
  background: 'none', border: 'none', marginTop: 8, cursor: 'pointer',
}
