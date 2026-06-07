// src/lib/finance.ts — pure financial logic, no Firebase dependency

// ── LOAN MODEL: Flat Monthly Interest ────────────────────────────────────────
//
// The borrower pays a fixed interest amount every month until tenure ends.
// At the final month, they also repay the full principal.
//
// Example: ₹1,00,000 @ 1.5% / month for 12 months
//   Monthly interest  = 1,00,000 × 1.5% = ₹1,500  (same every month)
//   Total interest    = ₹1,500 × 12      = ₹18,000
//   Total repayable   = ₹1,00,000 + ₹18,000 = ₹1,18,000
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Core interest calculations ────────────────────────────────────────────────

/** Fixed interest the borrower pays each month (₹). */
export function calcMonthlyInterest(principal: number, rate: number): number {
  if (principal <= 0 || rate <= 0) return 0
  return round2(principal * (rate / 100))
}

/** Total interest over the full tenure (₹). */
export function calcTotalInterest(principal: number, rate: number, months: number): number {
  if (principal <= 0 || rate <= 0 || months <= 0) return 0
  return round2(calcMonthlyInterest(principal, rate) * months)
}

/** Total amount the borrower must repay = principal + all interest (₹). */
export function calcTotalRepayable(principal: number, rate: number, months: number): number {
  return round2(principal + calcTotalInterest(principal, rate, months))
}

// ── Kept for backward compat — DO NOT use for new calculations ───────────────
/** @deprecated Use calcMonthlyInterest / calcTotalInterest instead. */
export function calcSI(principal: number, rate: number, days: number): number {
  return round2((principal * rate * days) / (100 * 365))
}

// ── Unit helpers ──────────────────────────────────────────────────────────────

/** Convert a tenure value to months (the canonical unit). */
export function toMonths(value: number, unit: 'days' | 'months' | 'years'): number {
  if (unit === 'days')  return Math.round(value / 30)
  if (unit === 'years') return Math.round(value * 12)
  return Math.round(value)
}

/** @deprecated Convert to days — kept only for any legacy callers. */
export function toDays(value: number, unit: 'days' | 'months' | 'years'): number {
  if (unit === 'months') return Math.round(value * 30.4)
  if (unit === 'years')  return Math.round(value * 365)
  return Math.round(value)
}

// ── Date helpers ──────────────────────────────────────────────────────────────

// ── Safe date parsing ─────────────────────────────────────────────────────────
// new Date("YYYY-MM-DD") parses as UTC midnight which shifts the day in
// timezones behind UTC (e.g. IST is UTC+5:30, so it's fine, but ahead
// timezones flip the date back). We always parse as LOCAL time to be safe.

function localDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d)   // local midnight — never UTC
}

function localDateStr(d: Date): string {
  const y  = d.getFullYear()
  const m  = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

export function daysElapsed(fromDate: string, toDate?: string): number {
  const from = localDate(fromDate)
  const to   = toDate ? localDate(toDate) : (() => { const n = new Date(); n.setHours(0,0,0,0); return n })()
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/** How many complete months have elapsed since the loan start date. */
export function monthsElapsed(fromDate: string, toDate?: string): number {
  const from = localDate(fromDate)
  const to   = toDate ? localDate(toDate) : new Date()
  let months = (to.getFullYear() - from.getFullYear()) * 12
             + (to.getMonth()    - from.getMonth())
  // Haven't reached the same day-of-month yet → one less full month
  if (to.getDate() < from.getDate()) months -= 1
  return Math.max(0, months)
}

export function addMonthsToDate(dateStr: string, n: number): string {
  const d = localDate(dateStr)
  d.setMonth(d.getMonth() + n)
  return localDateStr(d)
}

/** @deprecated use addMonthsToDate */
export function addDaysToDate(dateStr: string, n: number): string {
  const d = localDate(dateStr)
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

// ── Loan / Payment types ──────────────────────────────────────────────────────

export interface Loan {
  id:        string
  tenantId:  string
  clientId:  string
  principal: number
  rate:      number   // monthly % e.g. 1.5
  months:    number   // tenure in months  (was `days` — see migration note)
  date:      string   // "YYYY-MM-DD" disbursement date
  closed:    boolean
}

export interface Payment {
  id:       string
  tenantId: string
  loanId:   string
  amount:   number
  mode:     string
  date:     string
}

// ── Main snapshot ─────────────────────────────────────────────────────────────

export interface LoanSnapshot {
  // Loan terms
  principal:       number
  monthlyInterest: number   // fixed ₹ per month
  totalInterest:   number   // monthlyInterest × months
  totalDue:        number   // principal + totalInterest  (= totalRepayable)

  // Payment progress
  totalPaid:       number
  pending:         number   // totalDue − totalPaid (≥ 0)
  amountPaidPct:   number   // 0–100

  // Schedule position
  elapsed:         number   // months elapsed so far
  monthsRemaining: number   // months left (clamped to 0)
  dueDate:         string   // final repayment date "YYYY-MM-DD"
  daysPct:         number   // 0–100, how far through the tenure

  // Interest tracking
  interestAccrued: number   // interest that should have been paid so far
  interestOverdue: number   // interestAccrued − totalPaid when positive

  // Flags
  isOverdue:       boolean
  isClosed:        boolean

  // Legacy fields kept so existing UI components don't break
  overdueDays:          number   // 0 while within tenure; days past due date after
  outstandingPrincipal: number   // principal − principal-portion of payments
  originalSI:           number   // @deprecated = totalInterest
  overdueSI:            number   // @deprecated = interestOverdue
}

export function loanSnapshot(
  loan:     { principal: number; rate: number; months: number; date: string; closed?: boolean },
  payments: { amount: number; date: string }[],
  toDate?:  string
): LoanSnapshot {
  const { principal, rate, months, date } = loan

  // ── Core amounts ───────────────────────────────────────────
  const monthlyInterest = calcMonthlyInterest(principal, rate)
  const totalInterest   = round2(monthlyInterest * months)
  const totalDue        = round2(principal + totalInterest)

  // ── Payments ───────────────────────────────────────────────
  const sorted    = [...payments].sort((a, b) => a.date < b.date ? -1 : 1)
  const totalPaid = round2(sorted.reduce((s, p) => s + p.amount, 0))
  const pending   = round2(Math.max(0, totalDue - totalPaid))

  // ── Schedule position ──────────────────────────────────────
  const elapsed         = monthsElapsed(date, toDate)
  const monthsInTenure  = Math.min(elapsed, months)  // cap at tenure end
  const monthsRemaining = Math.max(0, months - elapsed)
  const dueDate         = addMonthsToDate(date, months)

  // Days elapsed for daysPct (kept for progress-bar UI)
  const daysTotal   = daysElapsed(date, dueDate)
  const daysGone    = daysElapsed(date, toDate)
  const daysPct     = daysTotal > 0
    ? Math.min(100, Math.round((daysGone / daysTotal) * 100))
    : 0

  // ── Interest tracking ──────────────────────────────────────
  // How much interest should the borrower have paid by now?
  const interestAccrued = round2(monthlyInterest * monthsInTenure)
  const interestOverdue = round2(Math.max(0, interestAccrued - totalPaid))

  // Overdue in days: only after tenure ends
  const dueDateObj  = localDate(dueDate)
  const todayObj    = toDate ? localDate(toDate) : (() => { const n = new Date(); n.setHours(0,0,0,0); return n })()
  const overdueDaysVal = pending > 0
    ? Math.max(0, Math.round((todayObj.getTime() - dueDateObj.getTime()) / 86400000))
    : 0

  // Outstanding principal = how much of the principal hasn't been paid
  // (all payments are treated as interest-first until all interest is cleared)
  const interestPaid    = Math.min(totalPaid, totalInterest)
  const principalPaid   = Math.max(0, totalPaid - interestPaid)
  const outstandingPrincipal = Math.max(0, principal - principalPaid)

  const isClosed  = pending <= 0 || loan.closed === true
  const isOverdue = !isClosed && (interestOverdue > 0 || overdueDaysVal > 0)

  return {
    principal,
    monthlyInterest,
    totalInterest,
    totalDue,
    totalPaid,
    pending,
    amountPaidPct: totalDue > 0
      ? Math.min(100, Math.round((totalPaid / totalDue) * 100))
      : 0,

    elapsed,
    monthsRemaining,
    dueDate,
    daysPct,

    interestAccrued,
    interestOverdue,
    isOverdue,
    isClosed,

    // Legacy compat
    overdueDays:          overdueDaysVal,
    outstandingPrincipal,
    originalSI:           totalInterest,
    overdueSI:            interestOverdue,
  }
}

// ── Monthly repayment schedule ────────────────────────────────────────────────

export interface ScheduleRow {
  month:        number   // 1-based
  dueDate:      string   // "YYYY-MM-DD"
  interestDue:  number   // always = monthlyInterest
  principalDue: number   // 0 except final month
  totalDue:     number   // interest + principalDue
  isFinalMonth: boolean
}

/**
 * Month-by-month repayment schedule.
 * Months 1 to N-1: pay interest only.
 * Month N: pay interest + full principal.
 */
export function getLoanSchedule(
  loan: { principal: number; rate: number; months: number; date: string }
): ScheduleRow[] {
  const { principal, rate, months, date } = loan
  const mi   = calcMonthlyInterest(principal, rate)
  const rows: ScheduleRow[] = []

  for (let i = 1; i <= months; i++) {
    const isFinal      = i === months
    const principalDue = isFinal ? principal : 0
    rows.push({
      month:        i,
      dueDate:      addMonthsToDate(date, i),
      interestDue:  mi,
      principalDue,
      totalDue:     round2(mi + principalDue),
      isFinalMonth: isFinal,
    })
  }

  return rows
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function fmtDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: '2-digit'
  })
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

// ── Internal ──────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Firestore migration helper ────────────────────────────────────────────────
/**
 * If existing Firestore loan documents still have a `days` field,
 * use this before passing to loanSnapshot() to convert on the fly.
 *
 *   const loan = migrateDaysToMonths(firestoreDoc)
 *   const snap = loanSnapshot(loan, payments)
 */
export function migrateDaysToMonths(
  loan: Omit<Loan, 'months'> & { days: number }
): Loan {
  return { ...loan, months: Math.round(loan.days / 30) }
}