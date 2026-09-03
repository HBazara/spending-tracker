import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  async function sendLink() {
    if (!email.trim()) return
    setStatus('sending')
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })

    if (error) {
      setError(error.message)
      setStatus('idle')
    } else {
      setStatus('sent')
    }
  }

  if (status === 'sent') {
    return (
      <div style={wrap}>
        <h1 style={title}>Check your email</h1>
        <p style={sub}>
          We sent a sign-in link to {email}. Open it on this device.
        </p>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <h1 style={title}>Spending Tracker</h1>
      <p style={sub}>Enter your email. No password needed.</p>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendLink()}
        style={input}
      />

      <button
        onClick={sendLink}
        disabled={status === 'sending'}
        style={button}
      >
        {status === 'sending' ? 'Sending...' : 'Send link'}
      </button>

      {error && <p style={{ color: '#c0392b', marginTop: 12 }}>{error}</p>}
    </div>
  )
}

const wrap = {
  maxWidth: 380,
  margin: '0 auto',
  padding: '80px 24px',
  fontFamily: 'system-ui, sans-serif',
}
const title = { fontSize: 28, margin: '0 0 8px' }
const sub = { color: '#666', margin: '0 0 24px', lineHeight: 1.5 }
const input = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 16,
  border: '1px solid #ddd',
  borderRadius: 10,
  boxSizing: 'border-box',
  marginBottom: 12,
}
const button = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 16,
  fontWeight: 600,
  color: '#fff',
  background: '#111',
  border: 'none',
  borderRadius: 10,
  cursor: 'pointer',
}