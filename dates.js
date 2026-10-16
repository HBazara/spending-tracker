// Date helpers that work in the user's LOCAL timezone.
//
// new Date().toISOString() converts to UTC first. For anyone west of
// Greenwich that means the date flips forward in the evening: at 9pm in
// Toronto, toISOString() already reports tomorrow. That silently broke
// the "this month" filter on the 1st of the month and made new expenses
// default to the wrong day. Build the string from local parts instead.

export function todayLocal() {
  const d = new Date()
  return fmt(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

export function monthStartLocal() {
  const d = new Date()
  return fmt(d.getFullYear(), d.getMonth() + 1, 1)
}

function fmt(y, m, day) {
  return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
