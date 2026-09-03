// Resolves a category budget row to cents. Percentage budgets
// are computed against the current monthly total, so raising
// the overall budget raises every percentage-based category.
export function resolveBudget(row, monthlyTotal) {
  if (!row) return null
  if (row.amount != null) return row.amount
  if (row.percent != null) return Math.round(monthlyTotal * row.percent / 100)
  return null
}

// Returns the alert thresholds a transaction just crossed.
// Only fires on the crossing itself, not on every save after,
// so you get one alert per threshold rather than a nag.
export function crossedThresholds({ before, after, limit, threshold }) {
  if (!limit || limit <= 0) return []
  const marks = []

  const pctBefore = (before / limit) * 100
  const pctAfter = (after / limit) * 100

  if (threshold && pctBefore < threshold && pctAfter >= threshold) {
    marks.push({ kind: 'threshold', at: threshold })
  }
  if (pctBefore < 100 && pctAfter >= 100) {
    marks.push({ kind: 'over' })
  }
  return marks
}

// "Almost there" warning: within `bufferCents` of the limit
// but not past it yet.
export function nearLimit({ spent, limit, bufferCents }) {
  if (!limit || limit <= 0) return false
  const left = limit - spent
  return left > 0 && left <= bufferCents
}