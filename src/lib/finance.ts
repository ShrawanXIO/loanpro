// src/lib/finance.ts — pure financial logic, no Firebase dependency

export function calcSI(principal: number, rate: number, days: number): number {
  if (principal <= 0 || rate <= 0 || days <= 0) return 0
  return (principal * rate * days) / (100 * 365)
}

export function toDays(value: number, unit: 'days' | 'months' | 'years'): number {
  if (unit === 'months') return Math.round(value * 30.4)
  if (unit === 'years')  return Math.round(value * 365)
  return Math.round(value)
}

export function daysElapsed(fromDate: string, toDate?: string): number {
  const from = new Date(fromDate); from.setHours(0,0,0,0)
  const to   = toDate ? new Date(toDate) : new Date(); to.setHours(0,0,0,0)
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

export function overdueDays(loanDate: string, termDays: number, toDate?: string): number {
  return Math.max(0, daysElapsed(loanDate, toDate) - termDays)
}

export function addDaysToDate(dateStr: string, n: number): string {
  const d = new Date(dateStr); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function outstandingPrincipal(principal: number, payments: { amount: number }[]): number {
  let rem = principal
  for (const p of payments) { if (rem <= 0) break; rem -= p.amount }
  return Math.max(0, rem)
}

export function calcOverdueSI(
  principal: number, rate: number,
  loanDate: string, termDays: number,
  payments: { amount: number; date: string }[],
  toDate?: string
): number {
  const od = overdueDays(loanDate, termDays, toDate)
  if (od <= 0) return 0
  const sorted = [...payments].sort((a,b) => a.date < b.date ? -1 : 1)
  const outstanding = outstandingPrincipal(principal, sorted)
  if (outstanding <= 0) return 0
  return calcSI(outstanding, rate, od)
}

export interface LoanSnapshot {
  originalSI: number
  overdueSI: number
  totalDue: number
  totalPaid: number
  pending: number
  overdueDays: number
  elapsed: number
  dueDate: string
  isOverdue: boolean
  isClosed: boolean
  outstandingPrincipal: number
  amountPaidPct: number
  daysPct: number
}

export function loanSnapshot(
  loan: { principal: number; rate: number; days: number; date: string },
  payments: { amount: number; date: string }[],
  toDate?: string
): LoanSnapshot {
  const sorted     = [...payments].sort((a,b) => a.date < b.date ? -1 : 1)
  const originalSI = calcSI(loan.principal, loan.rate, loan.days)
  const overdueSI  = calcOverdueSI(loan.principal, loan.rate, loan.date, loan.days, sorted, toDate)
  const totalDue   = loan.principal + originalSI + overdueSI
  const totalPaid  = sorted.reduce((s,p) => s + p.amount, 0)
  const pending    = Math.max(0, totalDue - totalPaid)
  const od         = overdueDays(loan.date, loan.days, toDate)
  const elapsed    = daysElapsed(loan.date, toDate)
  const dueDate    = addDaysToDate(loan.date, loan.days)
  const outstanding = outstandingPrincipal(loan.principal, sorted)
  return {
    originalSI, overdueSI, totalDue, totalPaid, pending,
    overdueDays: od, elapsed, dueDate,
    isOverdue:   od > 0 && pending > 0,
    isClosed:    pending <= 0,
    outstandingPrincipal: outstanding,
    amountPaidPct: totalDue > 0 ? Math.min(100, Math.round(totalPaid / totalDue * 100)) : 0,
    daysPct:       Math.min(100, Math.round(elapsed / loan.days * 100)),
  }
}

export function fmtINR(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

export function fmtDate(d: string): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
