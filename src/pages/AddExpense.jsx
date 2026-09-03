import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toCents } from '../lib/money'

export default function AddExpense({ categories, userId, onSaved, onCancel }) {
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    const cents = toCents(amount)
    if (cents === null || cents === 0) {
      setError('Enter a valid amount')
      return
    }
    if (!merchant.trim()) {
      setError('Enter where you spent it')
      return
    }

    setSaving(true)
    setError('')

    const { error } = await supabase.from('transactions').insert({
      user_id: userId,
      amount: cents,
      merchant: merchant.trim(),
      category_id: categoryId || null,
      occurred_at: date,
      note: note.trim() || null,
    })

    setSaving(false)
    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <div style={sheet}>
      <div style={handle} />
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>Add expense</h2>

      <label style={label}>Amount</label>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ ...input, fontSize: 32, fontWeight: 600 }}
        autoFocus
      />

      <label style={label}>Where</label>
      <input
        type="text"
        placeholder="Tim Hortons"
        value={merchant}
        onChange={(e) => setMerchant(e.target.value)}
        style={input}
      />

      <label style={label}>Category</label>
      <select
        value={categoryId}
        onChange={(e) => setCategoryId(e.target.value)}
        style={input}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label style={label}>Date</label>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={input}
      />

      <label style={label}>Note (optional)</label>
      <input
        type="text"
        placeholder=""
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={input}
      />

      {error && <p style={{ color: '#c0392b', margin: '4px 0 0' }}>{error}</p>}

      <button onClick={save} disabled={saving} style={primaryBtn}>
        {saving ? 'Saving...' : 'Save'}
      </button>
      <button onClick={onCancel} style={ghostBtn}>Cancel</button>
    </div>
  )
}

const sheet = {
  position: 'fixed',
  inset: 0,
  background: '#fff',
  padding: '16px 24px 40px',
  overflowY: 'auto',
  fontFamily: 'system-ui, sans-serif',
}
const handle = {
  width: 40, height: 4, background: '#ddd', borderRadius: 2,
  margin: '0 auto 20px',
}
const label = {
  display: 'block', fontSize: 13, color: '#666',
  margin: '16px 0 6px', fontWeight: 500,
}
const input = {
  width: '100%', padding: '12px 14px', fontSize: 16,
  border: '1px solid #ddd', borderRadius: 10,
  boxSizing: 'border-box', background: '#fff',
}
const primaryBtn = {
  width: '100%', padding: '15px', fontSize: 16, fontWeight: 600,
  color: '#fff', background: '#111', border: 'none',
  borderRadius: 10, marginTop: 28, cursor: 'pointer',
}
const ghostBtn = {
  width: '100%', padding: '15px', fontSize: 16,
  color: '#666', background: 'none', border: 'none',
  marginTop: 8, cursor: 'pointer',
}