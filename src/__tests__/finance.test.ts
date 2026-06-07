// src/__tests__/finance.test.ts
// ─────────────────────────────────────────────────────────────
// Run with: npx jest --verbose
// All tests are isolated — no Firebase, no network calls.
// Tests must ALL pass before deploying to Vercel.
// ─────────────────────────────────────────────────────────────

import {
  calcSI,
  toDays,
  daysElapsed,
  overdueDays,
  outstandingPrincipal,
  calcOverdueSI,
  loanSnapshot,
  addDaysToDate,
  fmtINR,
  todayStr,
  generateId,
} from '../lib/finance'

import {
  isProActive,
  isNearExpiry,
  isExpired,
  daysUntilExpiry,
  type Tenant,
} from '../lib/firestore'

import config from '../lib/config'

// ── TEST HELPERS ──────────────────────────────────────────────

// Base loan used across multiple tests
const BASE_LOAN = {
  principal: 10000,
  rate:      1.5,
  days:      90,
  date:      '2025-01-01',
}

// Base tenant used across pro-status tests
const BASE_TENANT: Tenant = {
  id:           't1',
  ownerId:      'u1',
  businessName: 'Test Lender',
  tier:         'paid',
  clientLimit:  100,
  clientCount:  0,
  createdAt:    '2025-01-01',
}

// Helper: date N days from today
function dateFromToday(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ═══════════════════════════════════════════════════════════════
//  GROUP 1 — calcSI (Simple Interest formula)
// ═══════════════════════════════════════════════════════════════
describe('calcSI — Simple Interest formula: P × R × D / (100 × 365)', () => {

  describe('correct calculations', () => {
    test('₹1,00,000 at 1.5% for 365 days = ₹1,500',
      () => expect(calcSI(100000, 1.5, 365)).toBeCloseTo(1500, 1))

    test('₹20,000 at 1.5% for 90 days',
      () => expect(calcSI(20000, 1.5, 90)).toBeCloseTo(73.97, 1))

    test('₹10,000 at 2% for 30 days',
      () => expect(calcSI(10000, 2, 30)).toBeCloseTo(16.44, 1))

    test('₹50,000 at 1.5% for 180 days',
      () => expect(calcSI(50000, 1.5, 180)).toBeCloseTo(369.86, 1))
  })

  describe('edge cases — all return 0', () => {
    test('zero principal',    () => expect(calcSI(0,     1.5, 90)).toBe(0))
    test('zero rate',         () => expect(calcSI(10000, 0,   90)).toBe(0))
    test('zero days',         () => expect(calcSI(10000, 1.5,  0)).toBe(0))
    test('negative principal',() => expect(calcSI(-5000, 1.5, 90)).toBe(0))
    test('negative rate',     () => expect(calcSI(10000, -1,  90)).toBe(0))
    test('negative days',     () => expect(calcSI(10000, 1.5, -10)).toBe(0))
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 2 — toDays (Period unit conversion)
// ═══════════════════════════════════════════════════════════════
describe('toDays — Period conversion to days', () => {

  describe('days (passthrough)', () => {
    test('90 days → 90',   () => expect(toDays(90,  'days')).toBe(90))
    test('365 days → 365', () => expect(toDays(365, 'days')).toBe(365))
    test('1 day → 1',      () => expect(toDays(1,   'days')).toBe(1))
  })

  describe('months (× 30.4, rounded)', () => {
    test('1 month → 30',   () => expect(toDays(1,  'months')).toBe(30))
    test('3 months → 91',  () => expect(toDays(3,  'months')).toBe(91))
    test('6 months → 182', () => expect(toDays(6,  'months')).toBe(182))
    test('12 months → 365',() => expect(toDays(12, 'months')).toBe(365))
  })

  describe('years (× 365)', () => {
    test('1 year → 365',  () => expect(toDays(1, 'years')).toBe(365))
    test('2 years → 730', () => expect(toDays(2, 'years')).toBe(730))
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 3 — daysElapsed (Date arithmetic)
// ═══════════════════════════════════════════════════════════════
describe('daysElapsed — Calendar day calculation', () => {
  test('same day = 0',         () => expect(daysElapsed('2025-01-01', '2025-01-01')).toBe(0))
  test('1 day apart',          () => expect(daysElapsed('2025-01-01', '2025-01-02')).toBe(1))
  test('30 days apart',        () => expect(daysElapsed('2025-01-01', '2025-01-31')).toBe(30))
  test('90 days apart',        () => expect(daysElapsed('2025-01-01', '2025-04-01')).toBe(90))
  test('365 days apart',       () => expect(daysElapsed('2025-01-01', '2026-01-01')).toBe(365))
  test('cross month boundary', () => expect(daysElapsed('2025-01-15', '2025-04-15')).toBe(89))
  test('cross year boundary',  () => expect(daysElapsed('2024-12-01', '2025-01-01')).toBe(31))
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 4 — overdueDays
// ═══════════════════════════════════════════════════════════════
describe('overdueDays — Days past due date', () => {
  test('1 day before due = 0',    () => expect(overdueDays('2025-01-01', 90, '2025-03-31')).toBe(0))
  test('on due date = 0',         () => expect(overdueDays('2025-01-01', 90, '2025-04-01')).toBe(0))
  test('1 day after due = 1',     () => expect(overdueDays('2025-01-01', 90, '2025-04-02')).toBe(1))
  test('10 days overdue',         () => expect(overdueDays('2025-01-01', 90, '2025-04-11')).toBe(10))
  test('30 days overdue',         () => expect(overdueDays('2025-01-01', 90, '2025-05-01')).toBe(30))
  test('within term = 0',         () => expect(overdueDays('2025-01-01', 90, '2025-02-01')).toBe(0))
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 5 — outstandingPrincipal (Principal-first payment order)
// ═══════════════════════════════════════════════════════════════
describe('outstandingPrincipal — Principal-first payment allocation', () => {

  describe('basic cases', () => {
    test('no payments → full principal',
      () => expect(outstandingPrincipal(10000, [])).toBe(10000))

    test('partial payment → reduced',
      () => expect(outstandingPrincipal(10000, [{ amount: 3000 }])).toBe(7000))

    test('exact payment → 0',
      () => expect(outstandingPrincipal(10000, [{ amount: 10000 }])).toBe(0))

    test('overpayment clamps to 0',
      () => expect(outstandingPrincipal(10000, [{ amount: 15000 }])).toBe(0))
  })

  describe('multiple payments', () => {
    test('two partial payments',
      () => expect(outstandingPrincipal(10000, [{ amount: 3000 }, { amount: 3000 }])).toBe(4000))

    test('five equal payments clear balance', () => {
      const pays = Array(5).fill({ amount: 2000 })
      expect(outstandingPrincipal(10000, pays)).toBe(0)
    })

    test('payments in any order give same result', () => {
      const p1 = [{ amount: 1000 }, { amount: 4000 }, { amount: 2000 }]
      const p2 = [{ amount: 4000 }, { amount: 2000 }, { amount: 1000 }]
      expect(outstandingPrincipal(10000, p1)).toBe(outstandingPrincipal(10000, p2))
    })
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 6 — calcOverdueSI (Overdue interest on outstanding principal)
// ═══════════════════════════════════════════════════════════════
describe('calcOverdueSI — Daily interest on outstanding principal after due date', () => {

  describe('not overdue → always 0', () => {
    test('within term',   () =>
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-03-01')).toBeCloseTo(0, 2))
    test('on due date',   () =>
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-04-01')).toBeCloseTo(0, 2))
  })

  describe('overdue with no payments', () => {
    test('10 days overdue on full principal', () => {
      const expected = calcSI(20000, 1.5, 10)
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-04-11'))
        .toBeCloseTo(expected, 2)
    })

    test('30 days overdue on full principal', () => {
      const expected = calcSI(20000, 1.5, 30)
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, [], '2025-05-01'))
        .toBeCloseTo(expected, 2)
    })
  })

  describe('overdue with partial payments (reduced outstanding)', () => {
    test('10 days overdue after ₹5k payment → lower interest', () => {
      const pays     = [{ amount: 5000, date: '2025-01-15' }]
      const expected = calcSI(15000, 1.5, 10)
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, pays, '2025-04-11'))
        .toBeCloseTo(expected, 2)
    })

    test('principal fully paid → 0 overdue interest', () => {
      const pays = [{ amount: 20000, date: '2025-02-01' }]
      expect(calcOverdueSI(20000, 1.5, '2025-01-01', 90, pays, '2025-04-11'))
        .toBeCloseTo(0, 2)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 7 — loanSnapshot (Full loan state)
// ═══════════════════════════════════════════════════════════════
describe('loanSnapshot — Complete loan financial state', () => {

  describe('on due date — no overdue', () => {
    const snap = loanSnapshot(BASE_LOAN, [], '2025-04-01')

    test('totalDue = principal + originalSI',
      () => expect(snap.totalDue).toBeCloseTo(10000 + calcSI(10000, 1.5, 90), 1))
    test('overdueSI = 0',      () => expect(snap.overdueSI).toBe(0))
    test('overdueDays = 0',    () => expect(snap.overdueDays).toBe(0))
    test('isOverdue = false',  () => expect(snap.isOverdue).toBe(false))
    test('isClosed = false',   () => expect(snap.isClosed).toBe(false))
    test('totalPaid = 0',      () => expect(snap.totalPaid).toBe(0))
    test('dueDate correct',    () => expect(snap.dueDate).toBe('2025-04-01'))
    test('elapsed = 90',       () => expect(snap.elapsed).toBe(90))
  })

  describe('overdue by 10 days', () => {
    const snap = loanSnapshot(BASE_LOAN, [], '2025-04-11')

    test('isOverdue = true',   () => expect(snap.isOverdue).toBe(true))
    test('overdueDays = 10',   () => expect(snap.overdueDays).toBe(10))
    test('overdueSI is positive', () => expect(snap.overdueSI).toBeGreaterThan(0))
    test('overdueSI = SI on full principal for 10 days',
      () => expect(snap.overdueSI).toBeCloseTo(calcSI(10000, 1.5, 10), 2))
    test('totalDue includes overdueSI',
      () => expect(snap.totalDue).toBeCloseTo(
        10000 + calcSI(10000, 1.5, 90) + calcSI(10000, 1.5, 10), 1))
  })

  describe('with payments', () => {
    test('isClosed when fully paid', () => {
      const total = 10000 + calcSI(10000, 1.5, 90)
      const snap  = loanSnapshot(BASE_LOAN, [{ amount: total, date: '2025-02-01' }], '2025-04-01')
      expect(snap.isClosed).toBe(true)
      expect(snap.pending).toBe(0)
    })

    test('amountPaidPct = 50 when half paid', () => {
      const total = 10000 + calcSI(10000, 1.5, 90)
      const snap  = loanSnapshot(BASE_LOAN, [{ amount: total / 2, date: '2025-02-01' }], '2025-04-01')
      expect(snap.amountPaidPct).toBe(50)
    })

    test('totalPaid sums all payments', () => {
      const pays = [{ amount: 2000, date: '2025-01-10' }, { amount: 3000, date: '2025-02-01' }]
      const snap = loanSnapshot(BASE_LOAN, pays, '2025-03-01')
      expect(snap.totalPaid).toBe(5000)
    })

    test('pending = totalDue - totalPaid', () => {
      const pays = [{ amount: 3000, date: '2025-01-10' }]
      const snap = loanSnapshot(BASE_LOAN, pays, '2025-04-01')
      expect(snap.pending).toBeCloseTo(snap.totalDue - 3000, 1)
    })

    test('overdueSI reduces as principal is paid down', () => {
      const noPay  = loanSnapshot(BASE_LOAN, [], '2025-04-11')
      const withPay = loanSnapshot(BASE_LOAN, [{ amount: 5000, date: '2025-02-01' }], '2025-04-11')
      expect(withPay.overdueSI).toBeLessThan(noPay.overdueSI)
    })
  })

  describe('amountPaidPct bounds', () => {
    test('0% when no payments',
      () => expect(loanSnapshot(BASE_LOAN, [], '2025-03-01').amountPaidPct).toBe(0))

    test('100% when fully paid', () => {
      const total = 10000 + calcSI(10000, 1.5, 90)
      const snap  = loanSnapshot(BASE_LOAN, [{ amount: total * 2, date: '2025-02-01' }], '2025-04-01')
      expect(snap.amountPaidPct).toBe(100)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 8 — Business rules
// ═══════════════════════════════════════════════════════════════
describe('Business rules', () => {

  test('principal reduces before interest (principal-first order)', () => {
    const si   = calcSI(10000, 1.5, 90)
    // Pay exactly the principal — interest should still be outstanding
    const snap = loanSnapshot(BASE_LOAN, [{ amount: 10000, date: '2025-01-15' }], '2025-04-01')
    expect(snap.outstandingPrincipal).toBe(0)
    expect(snap.pending).toBeCloseTo(si, 1)
    expect(snap.isClosed).toBe(false)
  })

  test('overdue interest stops when outstanding principal = 0', () => {
    // Pay full principal, then go overdue
    const snap = loanSnapshot(
      BASE_LOAN,
      [{ amount: 10000, date: '2025-02-01' }],
      '2025-04-11'
    )
    expect(snap.overdueSI).toBeCloseTo(0, 2)
  })

  test('total due = principal + originalSI + overdueSI', () => {
    const snap     = loanSnapshot(BASE_LOAN, [], '2025-04-11')
    const expected = 10000 + calcSI(10000, 1.5, 90) + calcSI(10000, 1.5, 10)
    expect(snap.totalDue).toBeCloseTo(expected, 1)
  })

  test('overpayment: pending goes negative (records without crash)', () => {
    const total = 10000 + calcSI(10000, 1.5, 90)
    const snap  = loanSnapshot(BASE_LOAN, [{ amount: total + 500, date: '2025-02-01' }], '2025-04-01')
    expect(snap.pending).toBe(0)       // clamped to 0
    expect(snap.isClosed).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 9 — Pro status helpers (isProActive, isExpired etc.)
// ═══════════════════════════════════════════════════════════════
describe('Pro status helpers', () => {

  describe('isProActive', () => {
    test('paid + no expiry = active (legacy)',
      () => expect(isProActive({ ...BASE_TENANT })).toBe(true))

    test('paid + future expiry = active',
      () => expect(isProActive({ ...BASE_TENANT, proExpiresAt: '2099-12-31' })).toBe(true))

    test('paid + past expiry = NOT active',
      () => expect(isProActive({ ...BASE_TENANT, proExpiresAt: '2020-01-01' })).toBe(false))

    test('free tier = NOT active regardless of expiry',
      () => expect(isProActive({ ...BASE_TENANT, tier: 'free' })).toBe(false))
  })

  describe('isExpired', () => {
    test('past date = expired',
      () => expect(isExpired({ ...BASE_TENANT, proExpiresAt: '2020-01-01' })).toBe(true))

    test('future date = not expired',
      () => expect(isExpired({ ...BASE_TENANT, proExpiresAt: '2099-12-31' })).toBe(false))

    test('no expiry = not expired',
      () => expect(isExpired({ ...BASE_TENANT })).toBe(false))
  })

  describe('daysUntilExpiry', () => {
    test('no expiry = null',
      () => expect(daysUntilExpiry({ ...BASE_TENANT })).toBeNull())

    test('past date = negative',
      () => expect(daysUntilExpiry({ ...BASE_TENANT, proExpiresAt: '2020-01-01' })).toBeLessThan(0))

    test('future date = positive',
      () => expect(daysUntilExpiry({ ...BASE_TENANT, proExpiresAt: '2099-12-31' })).toBeGreaterThan(0))

    test('today = 0', () =>
      expect(daysUntilExpiry({ ...BASE_TENANT, proExpiresAt: todayStr() })).toBe(0))
  })

  describe('isNearExpiry — within renewalReminderDays window', () => {
    test('5 days away = near expiry (within 15 day window)', () => {
      expect(isNearExpiry({ ...BASE_TENANT, proExpiresAt: dateFromToday(5) })).toBe(true)
    })

    test('exactly at renewalReminderDays = near expiry', () => {
      expect(isNearExpiry({
        ...BASE_TENANT,
        proExpiresAt: dateFromToday(config.renewalReminderDays)
      })).toBe(true)
    })

    test('1 day beyond renewalReminderDays = NOT near expiry', () => {
      expect(isNearExpiry({
        ...BASE_TENANT,
        proExpiresAt: dateFromToday(config.renewalReminderDays + 1)
      })).toBe(false)
    })

    test('already expired = NOT near expiry (it is expired)', () => {
      expect(isNearExpiry({ ...BASE_TENANT, proExpiresAt: '2020-01-01' })).toBe(false)
    })

    test('free tier = never near expiry', () => {
      expect(isNearExpiry({ ...BASE_TENANT, tier: 'free', proExpiresAt: dateFromToday(5) }))
        .toBe(false)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 10 — Config values (must come from config, not hardcoded)
// ═══════════════════════════════════════════════════════════════
describe('Config — single source of truth', () => {
  test('currentPriceINR is a positive number',
    () => expect(config.currentPriceINR).toBeGreaterThan(0))

  test('freeTierLimit = 10',
    () => expect(config.freeTierLimit).toBe(10))

  test('paidTierLimit = 100',
    () => expect(config.paidTierLimit).toBe(100))

  test('renewalReminderDays = 15',
    () => expect(config.renewalReminderDays).toBe(15))

  test('paidTierLimit > freeTierLimit',
    () => expect(config.paidTierLimit).toBeGreaterThan(config.freeTierLimit))

  test('ownerUpi is a non-empty string',
    () => expect(config.ownerUpi.length).toBeGreaterThan(0))

  test('ownerWhatsApp is a non-empty string',
    () => expect(config.ownerWhatsApp.length).toBeGreaterThan(0))

  test('ownerEmail contains @',
    () => expect(config.ownerEmail).toContain('@'))
})

// ═══════════════════════════════════════════════════════════════
//  GROUP 11 — Utility functions
// ═══════════════════════════════════════════════════════════════
describe('Utility functions', () => {

  describe('addDaysToDate', () => {
    test('+0 days',          () => expect(addDaysToDate('2025-01-01',   0)).toBe('2025-01-01'))
    test('+1 day',           () => expect(addDaysToDate('2025-01-31',   1)).toBe('2025-02-01'))
    test('+90 days',         () => expect(addDaysToDate('2025-01-01',  90)).toBe('2025-04-01'))
    test('+365 days',        () => expect(addDaysToDate('2025-01-01', 365)).toBe('2026-01-01'))
    test('leap year',        () => expect(addDaysToDate('2024-02-28',   1)).toBe('2024-02-29'))
  })

  describe('fmtINR — Indian number formatting', () => {
    test('₹0',          () => expect(fmtINR(0)).toBe('₹0'))
    test('₹1,000',      () => expect(fmtINR(1000)).toBe('₹1,000'))
    test('₹10,000',     () => expect(fmtINR(10000)).toBe('₹10,000'))
    test('₹1,00,000',   () => expect(fmtINR(100000)).toBe('₹1,00,000'))
    test('rounds 0.4',  () => expect(fmtINR(1000.4)).toBe('₹1,000'))
    test('rounds 0.6',  () => expect(fmtINR(1000.6)).toBe('₹1,001'))
  })

  describe('todayStr', () => {
    test('returns YYYY-MM-DD format',
      () => expect(todayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/))

    test('matches current date',
      () => expect(todayStr()).toBe(new Date().toISOString().slice(0, 10)))
  })

  describe('generateId', () => {
    test('returns non-empty string',
      () => expect(generateId().length).toBeGreaterThan(4))

    test('100 calls produce 100 unique IDs', () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateId()))
      expect(ids.size).toBe(100)
    })
  })
})