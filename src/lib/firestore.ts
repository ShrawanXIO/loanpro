// src/lib/firestore.ts — all Firestore CRUD operations
import {
  collection, doc, getDocs, addDoc, updateDoc,
  query, where, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { todayStr } from './finance'

// ── TYPES ─────────────────────────────────────────────────────

export interface Tenant {
  id: string
  ownerId: string
  businessName: string
  logoUrl?: string
  upiId?: string
  tier: 'free' | 'paid'
  clientCount: number
  createdAt: string
}

export interface Client {
  id: string
  tenantId: string
  name: string
  phone: string
  createdAt: string
}

export interface Loan {
  id: string
  tenantId: string
  clientId: string
  principal: number
  rate: number
  days: number
  date: string
  closed: boolean
}

export interface Payment {
  id: string
  tenantId: string
  loanId: string
  amount: number
  mode: string
  date: string
}

// ── HELPERS ───────────────────────────────────────────────────

function tsToStr(val: unknown): string {
  if (!val) return todayStr()
  if (val instanceof Timestamp) return val.toDate().toISOString().slice(0, 10)
  if (typeof val === 'string')  return val.slice(0, 10)
  if (val instanceof Date)      return val.toISOString().slice(0, 10)
  return todayStr()
}

// ── TENANT ────────────────────────────────────────────────────

export async function getTenantByOwner(uid: string): Promise<Tenant | null> {
  const snap = await getDocs(query(collection(db, 'tenants'), where('ownerId', '==', uid)))
  if (snap.empty) return null
  const d = snap.docs[0]
  const data = d.data() as Record<string, unknown>
  return {
    id: d.id,
    ownerId:      String(data.ownerId || ''),
    businessName: String(data.businessName || ''),
    logoUrl:      String(data.logoUrl || ''),
    upiId:        String(data.upiId || ''),
    tier:         (data.tier as 'free' | 'paid') || 'free',
    clientCount:  Number(data.clientCount || 0),
    createdAt:    tsToStr(data.createdAt),
  }
}

export async function createTenant(uid: string, businessName: string): Promise<Tenant> {
  const data = {
    ownerId: uid, businessName, logoUrl: '', upiId: '',
    tier: 'free', clientCount: 0, createdAt: serverTimestamp()
  }
  const ref = await addDoc(collection(db, 'tenants'), data)
  return { id: ref.id, ownerId: uid, businessName, logoUrl: '', upiId: '', tier: 'free', clientCount: 0, createdAt: todayStr() }
}

export async function updateTenant(tenantId: string, data: Partial<Tenant>): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId), data as Record<string, unknown>)
}

// ── CLIENTS ───────────────────────────────────────────────────
// No orderBy → no composite index needed. We sort in JS.

export const FREE_TIER_LIMIT = 10
export const PAID_TIER_LIMIT = 100

export async function getClients(tenantId: string): Promise<Client[]> {
  const snap = await getDocs(
    query(collection(db, 'clients'), where('tenantId', '==', tenantId))
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:        d.id,
        tenantId:  String(data.tenantId || ''),
        name:      String(data.name || ''),
        phone:     String(data.phone || ''),
        createdAt: tsToStr(data.createdAt),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name)) // sort A-Z in JS
}

export async function addClientFS(
  tenantId: string, name: string, phone: string,
  tier: 'free' | 'paid', currentCount: number
): Promise<Client> {
  const limit = tier === 'paid' ? PAID_TIER_LIMIT : FREE_TIER_LIMIT
  if (currentCount >= limit) throw new Error(tier === 'free' ? 'FREE_LIMIT' : 'PAID_LIMIT')
  const data = { tenantId, name: name.trim(), phone: phone.trim(), createdAt: serverTimestamp() }
  const ref  = await addDoc(collection(db, 'clients'), data)
  await updateDoc(doc(db, 'tenants', tenantId), { clientCount: currentCount + 1 })
  return { id: ref.id, tenantId, name: name.trim(), phone: phone.trim(), createdAt: todayStr() }
}

// ── LOANS ─────────────────────────────────────────────────────
// No orderBy → no composite index needed. We sort in JS.

export async function getLoans(tenantId: string, clientId: string): Promise<Loan[]> {
  const snap = await getDocs(
    query(
      collection(db, 'loans'),
      where('tenantId', '==', tenantId),
      where('clientId', '==', clientId)
    )
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:        d.id,
        tenantId:  String(data.tenantId || ''),
        clientId:  String(data.clientId || ''),
        principal: Number(data.principal || 0),
        rate:      Number(data.rate || 0),
        days:      Number(data.days || 0),
        date:      tsToStr(data.date),
        closed:    Boolean(data.closed),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first in JS
}

export async function addLoan(
  tenantId: string, clientId: string,
  principal: number, rate: number, days: number
): Promise<Loan> {
  const data = { tenantId, clientId, principal, rate, days, date: serverTimestamp(), closed: false }
  const ref  = await addDoc(collection(db, 'loans'), data)
  return { id: ref.id, tenantId, clientId, principal, rate, days, date: todayStr(), closed: false }
}

export async function closeLoan(loanId: string): Promise<void> {
  await updateDoc(doc(db, 'loans', loanId), { closed: true })
}

// ── PAYMENTS ──────────────────────────────────────────────────
// No orderBy → no composite index needed. We sort in JS.

export async function getPayments(tenantId: string, loanId: string): Promise<Payment[]> {
  const snap = await getDocs(
    query(
      collection(db, 'payments'),
      where('tenantId', '==', tenantId),
      where('loanId',   '==', loanId)
    )
  )
  return snap.docs
    .map(d => {
      const data = d.data() as Record<string, unknown>
      return {
        id:      d.id,
        tenantId: String(data.tenantId || ''),
        loanId:   String(data.loanId || ''),
        amount:   Number(data.amount || 0),
        mode:     String(data.mode || ''),
        date:     tsToStr(data.date),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first in JS
}

export async function addPayment(
  tenantId: string, loanId: string, amount: number, mode: string
): Promise<Payment> {
  const data = { tenantId, loanId, amount, mode, date: serverTimestamp() }
  const ref  = await addDoc(collection(db, 'payments'), data)
  return { id: ref.id, tenantId, loanId, amount, mode, date: todayStr() }
}

// ── DASHBOARD (paid tier) ─────────────────────────────────────

export async function getDashboardData(tenantId: string) {
  const [clientsSnap, loansSnap, paymentsSnap] = await Promise.all([
    getDocs(query(collection(db, 'clients'),  where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, 'loans'),    where('tenantId', '==', tenantId))),
    getDocs(query(collection(db, 'payments'), where('tenantId', '==', tenantId))),
  ])

  const clients  = clientsSnap.docs.map(d  => ({ id: d.id,  ...d.data()  }))
  const loans    = loansSnap.docs.map(d    => {
    const data = d.data() as Record<string, unknown>
    return { id: d.id, ...data, date: tsToStr(data.date) }
  })
  const payments = paymentsSnap.docs.map(d => {
    const data = d.data() as Record<string, unknown>
    return { id: d.id, ...data, date: tsToStr(data.date) }
  })

  return { clients, loans, payments }
}