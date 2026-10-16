import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signInWithGoogle() {
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) setError(error.message)
  }

  async function sendCode() {
    if (!email.trim()) return
    setBusy(true)
    setError('')

    // Sends both a link and a 6-digit code in the same email. The link
    // still works; the code exists so you never have to hop browsers.
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
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
    // On success the auth listener swaps the screen for us.
  }

  if (step === 'code') {
    return (
      <div style={wrap}>
        <h1 style={title}>Check your email</h1>
        <p style={sub}>
          We sent a sign-in code to {email}. Enter it below, or just click the
          link in the email.
        </p>

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
      <p style={sub}>Track what you spend. No bank login, ever.</p>

      <button onClick={signInWithGoogle} style={googleBtn}>
        Continue with Google
      </button>

      <div style={divider}>
        <span style={dividerLine} />
        <span style={{ color: '#aaa', fontSize: 13 }}>or</span>
        <span style={dividerLine} />
      </div>

      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendCode()}
        style={input}
      />

      <button onClick={sendCode} disabled={busy} style={button}>
        {busy ? 'Sending...' : 'Email me a code'}
      </button>

      {error && <p style={errStyle}>{error}</p>}
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
const googleBtn = {
  width: '100%',
  padding: '14px 16px',
  fontSize: 16,
  fontWeight: 500,
  color: '#111',
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 10,
  cursor: 'pointer',
}
const divider = {
  display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0',
}
const dividerLine = { flex: 1, height: 1, background: '#eee' }
const ghost = {
  width: '100%',
  padding: '14px',
  fontSize: 15,
  color: '#666',
  background: 'none',
  border: 'none',
  marginTop: 12,
  cursor: 'pointer',
}
const errStyle = { color: '#c0392b', marginTop: 12 }
