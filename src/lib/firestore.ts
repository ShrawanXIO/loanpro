// src/lib/firestore.ts
import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { todayStr } from './finance'
import config from './config'

// ── TYPES ─────────────────────────────────────────────────────

export interface TenantPurchase {
  date:       string   // "YYYY-MM-DD" — when payment was received
  pricePaid:  number   // actual amount paid (e.g. 4500 if discounted)
  listedPrice: number  // price shown at time of purchase (from config)
  activatedBy: string  // your name / "manual" — who flipped the switch
  expiresAt:  string   // "YYYY-MM-DD" — end of that licence period
  note?:      string   // optional: "Diwali discount", "referral", etc.
}

export interface Tenant {
  id:            string
  ownerId:       string
  businessName:  string
  logoUrl?:      string
  upiId?:        string        // lender's own UPI — their borrowers pay them
  defaultRate?:  number        // default interest rate e.g. 1.5
  tier:          'free' | 'paid'
  clientLimit:   number        // configurable per tenant in Firestore
  clientCount:   number
  proExpiresAt?: string        // "YYYY-MM-DD" — when current Pro licence ends
  purchases?:    TenantPurchase[] // full purchase history — for your analytics
  createdAt:     string
}

// ── HELPERS ───────────────────────────────────────────────────

function tsToStr(val: unknown): string {
  if (!val) return todayStr()
  if (val instanceof Timestamp) return val.toDate().toISOString().slice(0, 10)
  if (typeof val === 'string')  return val.slice(0, 10)
  if (val instanceof Date)      return val.toISOString().slice(0, 10)
  return todayStr()
}

// ── PRO STATUS HELPERS ────────────────────────────────────────

/** True if tenant has an active, non-expired Pro licence */
export function isProActive(tenant: Tenant): boolean {
  if (tenant.tier !== 'paid') return false
  if (!tenant.proExpiresAt)   return true   // legacy pro with no expiry
  return tenant.proExpiresAt >= todayStr()
}

/** Days until Pro expires. Negative = already expired. Null = no expiry set. */
export function daysUntilExpiry(tenant: Tenant): number | null {
  if (!tenant.proExpiresAt) return null
  const exp   = new Date(tenant.proExpiresAt)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((exp.getTime() - today.getTime()) / 86400000)
}

/** True if renewal reminder should be shown (within config.renewalReminderDays) */
export function isNearExpiry(tenant: Tenant): boolean {
  const days = daysUntilExpiry(tenant)
  if (days === null) return false
  return days >= 0 && days <= config.renewalReminderDays
}

/** True if Pro licence has expired */
export function isExpired(tenant: Tenant): boolean {
  const days = daysUntilExpiry(tenant)
  if (days === null) return false
  return days < 0
}

// ── TENANT ────────────────────────────────────────────────────

export async function getTenantByOwner(uid: string): Promise<Tenant | null> {
  const snap = await getDocs(
    query(collection(db, 'tenants'), where('ownerId', '==', uid))
  )
  if (snap.empty) return null
  const d    = snap.docs[0]
  const data = d.data() as Record<string, unknown>
  return {
    id:            d.id,
    ownerId:       String(data.ownerId       || ''),
    businessName:  String(data.businessName  || ''),
    logoUrl:       String(data.logoUrl       || ''),
    upiId:         String(data.upiId         || ''),
    defaultRate:   Number(data.defaultRate   || 1.5),
    tier:          (data.tier as 'free' | 'paid') || 'free',
    // clientLimit: stored value first, then config defaults
    clientLimit:   Number(data.clientLimit   || (data.tier === 'paid' ? config.paidTierLimit : config.freeTierLimit)),
    clientCount:   Number(data.clientCount   || 0),
    proExpiresAt:  data.proExpiresAt ? tsToStr(data.proExpiresAt) : undefined,
    purchases:     Array.isArray(data.purchases) ? (data.purchases as TenantPurchase[]) : [],
    createdAt:     tsToStr(data.createdAt),
  }
}

export async function createTenant(uid: string, businessName: string): Promise<Tenant> {
  const data = {
    ownerId: uid, businessName,
    logoUrl: '', upiId: '', defaultRate: 1.5,
    tier: 'free',
    clientLimit: config.freeTierLimit,
    clientCount: 0,
    purchases: [],
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'tenants'), data)
  return {
    id: ref.id, ownerId: uid, businessName,
    logoUrl: '', upiId: '', defaultRate: 1.5,
    tier: 'free', clientLimit: config.freeTierLimit,
    clientCount: 0, purchases: [], createdAt: todayStr(),
  }
}

export async function updateTenant(
  tenantId: string, data: Partial<Tenant>
): Promise<void> {
  await updateDoc(
    doc(db, 'tenants', tenantId),
    data as Record<string, unknown>
  )
}

// ── CLIENTS ───────────────────────────────────────────────────

export async function getClients(tenantId: string) {
  const snap = await getDocs(
    query(collection(db, 'clients'), where('tenantId', '==', tenantId))
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:        d.id,
        tenantId:  String(data.tenantId  || ''),
        name:      String(data.name      || ''),
        phone:     String(data.phone     || ''),
        createdAt: tsToStr(data.createdAt),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function addClientFS(
  tenantId: string,
  name:     string,
  phone:    string,
  tenant:   Tenant,
) {
  if (tenant.clientCount >= tenant.clientLimit) {
    throw new Error(tenant.tier === 'free' ? 'FREE_LIMIT' : 'PAID_LIMIT')
  }
  const data = {
    tenantId,
    name:  name.trim(),
    phone: phone.trim(),
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'clients'), data)
  await updateDoc(doc(db, 'tenants', tenantId), {
    clientCount: tenant.clientCount + 1,
  })
  return {
    id: ref.id, tenantId,
    name: name.trim(), phone: phone.trim(),
    createdAt: todayStr(),
  }
}

// ── LOANS ─────────────────────────────────────────────────────

export async function getLoans(tenantId: string, clientId: string) {
  const snap = await getDocs(
    query(
      collection(db, 'loans'),
      where('tenantId', '==', tenantId),
      where('clientId', '==', clientId),
    )
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:        d.id,
        tenantId:  String(data.tenantId  || ''),
        clientId:  String(data.clientId  || ''),
        principal: Number(data.principal || 0),
        rate:      Number(data.rate      || 0),
        days:      Number(data.days      || 0),
        date:      tsToStr(data.date),
        closed:    Boolean(data.closed),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function addLoan(
  tenantId:  string,
  clientId:  string,
  principal: number,
  rate:      number,
  days:      number,
) {
  const data = {
    tenantId, clientId, principal, rate, days,
    date: serverTimestamp(), closed: false,
  }
  const ref = await addDoc(collection(db, 'loans'), data)
  return {
    id: ref.id, tenantId, clientId,
    principal, rate, days, date: todayStr(), closed: false,
  }
}

export async function closeLoan(loanId: string): Promise<void> {
  await updateDoc(doc(db, 'loans', loanId), { closed: true })
}

// ── PAYMENTS ──────────────────────────────────────────────────

export async function getPayments(tenantId: string, loanId: string) {
  const snap = await getDocs(
    query(
      collection(db, 'payments'),
      where('tenantId', '==', tenantId),
      where('loanId',   '==', loanId),
    )
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:       d.id,
        tenantId: String(data.tenantId || ''),
        loanId:   String(data.loanId   || ''),
        amount:   Number(data.amount   || 0),
        mode:     String(data.mode     || ''),
        date:     tsToStr(data.date),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date))
}

export async function addPayment(
  tenantId: string,
  loanId:   string,
  amount:   number,
  mode:     string,
) {
  const data = { tenantId, loanId, amount, mode, date: serverTimestamp() }
  const ref  = await addDoc(collection(db, 'payments'), data)
  return { id: ref.id, tenantId, loanId, amount, mode, date: todayStr() }
}

// ── DASHBOARD ─────────────────────────────────────────────────

export async function getDashboardData(tenantId: string) {
  const [clientsSnap, loansSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, 'clients'),  where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, 'loans'),    where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, 'payments'), where('tenantId', '==', tenantId))),
  ])
  const toDate = (d: Record<string,unknown>) => ({ ...d, date: tsToStr(d.date) })
  return {
    clients:  clientsSnap.docs.map(d  => ({ id: d.id, ...d.data() })),
    loans:    loansSnap.docs.map(d    => ({ id: d.id, ...toDate(d.data() as Record<string,unknown>) })),
    payments: paymentsSnap.docs.map(d => ({ id: d.id, ...toDate(d.data() as Record<string,unknown>) })),
  }
}

// ── EXPORTED TYPES (inferred from functions) ──────────────────
export type Client  = Awaited<ReturnType<typeof getClients>>[0]
export type Loan    = Awaited<ReturnType<typeof getLoans>>[0]
export type Payment = Awaited<ReturnType<typeof getPayments>>[0]