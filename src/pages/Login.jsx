import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendCode() {
    if (!email.trim()) return
    setBusy(true)
    setError('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
    })

    setBusy(false)
    if (error) setError(error.message)
    else setStep('code')
  }

  async function verifyCode() {
    if (code.length < 6) return
    setBusy(true)
    setError('')

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })

    setBusy(false)
    if (error) setError(error.message)
    // On success the auth listener takes over and swaps the screen.
  }

  if (step === 'code') {
    return (
      <div style={wrap}>
        <h1 style={title}>Enter your code</h1>
        <p style={sub}>We sent a 6-digit code to {email}.</p>

        <input
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          onKeyDown={(e) => e.key === 'Enter' && verifyCode()}
          style={{ ...input, fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
          autoFocus
        />

        <button onClick={verifyCode} disabled={busy} style={button}>
          {busy ? 'Checking...' : 'Sign in'}
        </button>

        {error && <p style={errStyle}>{error}</p>}

        <button
          onClick={() => { setStep('email'); setCode(''); setError('') }}
          style={ghost}
        >
          Use a different email
        </button>
      </div>
    )
  }

  return (
    <div style={wrap}>
      <h1 style={title}>Spending Tracker</h1>
      <p style={sub}>Enter your email and we'll send you a code.</p>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendCode()}
        style={input}
        autoFocus
      />

      <button onClick={sendCode} disabled={busy} style={button}>
        {busy ? 'Sending...' : 'Send code'}
      </button>

      {error && <p style={errStyle}>{error}</p>}
    </div>
  )
}

const wrap = {
  maxWidth: 380, margin: '0 auto', padding: '80px 24px',
  fontFamily: 'system-ui, sans-serif',
}
const title = { fontSize: 28, margin: '0 0 8px' }
const sub = { color: '#666', margin: '0 0 24px', lineHeight: 1.5 }
const input = {
  width: '100%', padding: '14px 16px', fontSize: 16,
  border: '1px solid #ddd', borderRadius: 10,
  boxSizing: 'border-box', marginBottom: 12,
}
const button = {
  width: '100%', padding: '14px 16px', fontSize: 16, fontWeight: 600,
  color: '#fff', background: '#111', border: 'none',
  borderRadius: 10, cursor: 'pointer',
}
const ghost = {
  width: '100%', padding: '14px', fontSize: 15, color: '#666',
  background: 'none', border: 'none', marginTop: 12, cursor: 'pointer',
}
const errStyle = { color: '#c0392b', marginTop: 12 }