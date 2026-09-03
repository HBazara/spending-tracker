// Money is stored as integer cents everywhere. Convert only at
// the edges: once on input, once on display. Never in between.

export function toCents(input) {
  const cleaned = String(input).replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  if (isNaN(n) || n < 0) return null
  return Math.round(n * 100)
}

export function fromCents(cents) {
  return (cents / 100).toLocaleString('en-CA', {
    style: 'currency',
    currency: 'CAD',
  })
}