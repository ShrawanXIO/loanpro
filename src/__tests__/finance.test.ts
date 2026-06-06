// src/__tests__/finance.test.ts
// Run with: npx jest

import {
  calcSI, toDays, daysElapsed, overdueDays,
  outstandingPrincipal, calcOverdueSI, loanSnapshot,
  addDaysToDate, fmtINR, todayStr, generateId,
} from '../lib/finance'

// ── calcSI ────────────────────────────────────────────────────
describe('calcSI', () => {
  test('basic: ₹1,00,000 at 1.5% for 365 days = ₹1,500', () => {
    expect(calcSI(100000, 1.5, 365)).toBeCloseTo(1500, 1)
  })
  test('₹20,000 at 1.5% for 90 days', () => {
    expect(calcSI(20000, 1.5, 90)).toBeCloseTo(73.97, 1)
  })
  test('returns 0 for zero principal', () => {
    expect(calcSI(0, 1.5, 90)).toBe(0)
  })
  test('returns 0 for zero rate', () => {
    expect(calcSI(10000, 0, 90)).toBe(0)
  })
  test('returns 0 for zero days', () => {
    expect(calcSI(10000, 1.5, 0)).toBe(0)
  })
  test('returns 0 for negative principal', () => {
    expect(calcSI(-1000, 1.5, 90)).toBe(0)
  })
})

// ── toDays ────────────────────────────────────────────────────
describe('toDays', () => {
  test('days passthrough', ()     => expect(toDays(90,  'days')).toBe(90))
  test('1 month = 30 days',  ()   => expect(toDays(1,   'months')).toBe(30))
  test('3 months = 91 days', ()   => expect(toDays(3,   'months')).toBe(91))
  test('6 months = 182 days', ()  => expect(toDays(6,   'months')).toBe(182))
  test('1 year = 365 days',  ()   => expect(toDays(1,   'years')).toBe(365))
  test('2 years = 730 days', ()   => expect(toDays(2,   'years')).toBe(730))
})

// ── daysElapsed ───────────────────────────────────────────────
describe('daysElapsed', () => {
  test('same day = 0',  () => expect(daysElapsed('2025-01-01', '2025-01-01')).toBe(0))
  test('30 days',       () => expect(daysElapsed('2025-01-01', '2025-01-31')).toBe(30))
  test('365 days',      () => expect(daysElapsed('2025-01-01', '2026-01-01')).toBe(365))
  test('cross month',   () => expect(daysElapsed('2025-01-15', '2025-04-15')).toBe(89))
})

// ── overdueDays ───────────────────────────────────────────────
describe('overdueDays', () => {
  test('within term = 0',      () => expect(overdueDays('2025-01-01', 90, '2025-03-01')).toBe(0))
  test('on exact due date = 0',() => expect(overdueDays('2025-01-01', 90, '2025-04-01')).toBe(0))
  test('1 day overdue',        () => expect(overdueDays('2025-01-01', 90, '2025-04-02')).toBe(1))
  test('10 days overdue',      () => expect(overdueDays('2025-01-01', 90, '2025-04-11')).toBe(10))
  test('30 days overdue',      () => expect(overdueDays('2025-01-01', 90, '2025-05-01')).toBe(30))
})

// ── outstandingPrincipal ──────────────────────────────────────
describe('outstandingPrincipal', () => {
  test('no payments = full principal', () => expect(outstandingPrincipal(10000, [])).toBe(10000))
  test('partial payment',              () => expect(outstandingPrincipal(10000, [{amount:3000}])).toBe(7000))
  test('full payment = 0',             () => expect(outstandingPrincipal(10000, [{amount:10000}])).toBe(0))
  test('overpayment clamps to 0',      () => expect(outstandingPrincipal(10000, [{amount:15000}])).toBe(0))
  test('multiple payments',            () => expect(outstandingPrincipal(10000, [{amount:3000},{amount:3000}])).toBe(4000))
  test('sequential payments reduce',   () => {
    const pays = [{amount:2000},{amount:2000},{amount:2000},{amount:2000},{amount:2000}]
    expect(outstandingPrincipal(10000, pays)).toBe(0)
  })
})

// ── calcOverdueSI ─────────────────────────────────────────────
describe('calcOverdueSI', () => {
  test('within term = 0', () => {
    expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-03-01')).toBeCloseTo(0, 2)
  })
  test('on due date = 0', () => {
    expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-04-01')).toBeCloseTo(0, 2)
  })
  test('10 days overdue, no payments', () => {
    const expected = calcSI(20000, 1.5, 10)
    expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-04-11')).toBeCloseTo(expected, 2)
  })
  test('10 days overdue, ₹5k paid (principal reduced)', () => {
    const pays = [{amount:5000, date:'2025-01-15'}]
    const expected = calcSI(15000, 1.5, 10)
    expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, pays, '2025-04-11')).toBeCloseTo(expected, 2)
  })
  test('fully paid principal = 0 overdue interest', () => {
    const pays = [{amount:20000, date:'2025-02-01'}]
    expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, pays, '2025-04-11')).toBeCloseTo(0, 2)
  })
})

// ── loanSnapshot ─────────────────────────────────────────────
describe('loanSnapshot', () => {
  const loan = { principal:10000, rate:1.5, days:90, date:'2025-01-01' }

  test('totalDue = principal + SI on due date', () => {
    const snap = loanSnapshot(loan, [], '2025-04-01')
    expect(snap.totalDue).toBeCloseTo(10000 + calcSI(10000, 1.5, 90), 1)
  })
  test('not overdue on due date', () => {
    const snap = loanSnapshot(loan, [], '2025-04-01')
    expect(snap.isOverdue).toBe(false)
    expect(snap.overdueDays).toBe(0)
  })
  test('overdue after due date', () => {
    const snap = loanSnapshot(loan, [], '2025-04-11')
    expect(snap.isOverdue).toBe(true)
    expect(snap.overdueDays).toBe(10)
    expect(snap.overdueSI).toBeCloseTo(calcSI(10000, 1.5, 10), 2)
  })
  test('isClosed when fully paid', () => {
    const si   = calcSI(10000, 1.5, 90)
    const pays = [{amount: 10000 + si, date:'2025-02-01'}]
    const snap = loanSnapshot(loan, pays, '2025-04-01')
    expect(snap.isClosed).toBe(true)
    expect(snap.pending).toBe(0)
  })
  test('amountPaidPct is correct', () => {
    const totalDue = 10000 + calcSI(10000, 1.5, 90)
    const pays = [{amount: totalDue / 2, date:'2025-02-01'}]
    const snap = loanSnapshot(loan, pays, '2025-04-01')
    expect(snap.amountPaidPct).toBe(50)
  })
  test('totalPaid sums all payments', () => {
    const pays = [{amount:2000, date:'2025-01-10'},{amount:3000, date:'2025-02-01'}]
    const snap = loanSnapshot(loan, pays, '2025-03-01')
    expect(snap.totalPaid).toBe(5000)
  })
  test('pending = totalDue - totalPaid', () => {
    const pays = [{amount:3000, date:'2025-01-10'}]
    const snap = loanSnapshot(loan, pays, '2025-04-01')
    const expected = snap.totalDue - 3000
    expect(snap.pending).toBeCloseTo(expected, 1)
  })
})

// ── addDaysToDate ─────────────────────────────────────────────
describe('addDaysToDate', () => {
  test('+0 days',   () => expect(addDaysToDate('2025-01-01',   0)).toBe('2025-01-01'))
  test('+90 days',  () => expect(addDaysToDate('2025-01-01',  90)).toBe('2025-04-01'))
  test('+365 days', () => expect(addDaysToDate('2025-01-01', 365)).toBe('2026-01-01'))
  test('month boundary', () => expect(addDaysToDate('2025-01-31', 1)).toBe('2025-02-01'))
})

// ── fmtINR ────────────────────────────────────────────────────
describe('fmtINR', () => {
  test('formats correctly',  () => expect(fmtINR(1000)).toBe('₹1,000'))
  test('rounds decimals',    () => expect(fmtINR(1000.7)).toBe('₹1,001'))
  test('lakhs formatting',   () => expect(fmtINR(100000)).toBe('₹1,00,000'))
  test('zero',               () => expect(fmtINR(0)).toBe('₹0'))
})

// ── todayStr ──────────────────────────────────────────────────
describe('todayStr', () => {
  test('returns YYYY-MM-DD format', () => {
    expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  test('matches current date', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(todayStr()).toBe(today)
  })
})

// ── generateId ────────────────────────────────────────────────
describe('generateId', () => {
  test('returns a non-empty string', () => {
    expect(typeof generateId()).toBe('string')
    expect(generateId().length).toBeGreaterThan(4)
  })
  test('generates unique IDs', () => {
    const ids = new Set(Array.from({length: 100}, () => generateId()))
    expect(ids.size).toBe(100)
  })
})

// ── Business rule: payment order (principal first) ────────────
describe('Payment order: principal first', () => {
  test('payment reduces principal before interest', () => {
    const loan = { principal:10000, rate:1.5, days:90, date:'2025-01-01' }
    const si   = calcSI(10000, 1.5, 90)
    // Pay only the principal — interest still outstanding
    const pays = [{amount:10000, date:'2025-01-15'}]
    const snap = loanSnapshot(loan, pays, '2025-04-01')
    expect(snap.outstandingPrincipal).toBe(0)
    expect(snap.pending).toBeCloseTo(si, 1)
    expect(snap.isClosed).toBe(false)
  })

  test('multiple small payments accumulate correctly', () => {
    const loan = { principal:10000, rate:1.5, days:90, date:'2025-01-01' }
    const pays = [
      {amount:2000, date:'2025-01-10'},
      {amount:2000, date:'2025-02-10'},
      {amount:2000, date:'2025-03-10'},
    ]
    const snap = loanSnapshot(loan, pays, '2025-04-01')
    expect(snap.totalPaid).toBe(6000)
    expect(snap.outstandingPrincipal).toBe(4000)
  })
})

// ── Tier limits ───────────────────────────────────────────────
describe('Tier limits', () => {
  test('free tier limit is 10', () => {
    const { FREE_TIER_LIMIT } = require('../lib/firestore')
    expect(FREE_TIER_LIMIT).toBe(10)
  })
  test('paid tier limit is 100', () => {
    const { PAID_TIER_LIMIT } = require('../lib/firestore')
    expect(PAID_TIER_LIMIT).toBe(100)
  })
})
