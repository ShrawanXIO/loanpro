// src/lib/firestore.ts
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, serverTimestamp, Timestamp
} from 'firebase/firestore'
import { db } from './firebase'
import { todayStr } from './finance'
import config from './config'

// ── TYPES ─────────────────────────────────────────────────────

export interface TenantPurchase {
  date:        string
  pricePaid:   number
  listedPrice: number
  activatedBy: string
  expiresAt:   string
  note?:       string
}

export interface Tenant {
  id:            string
  ownerId:       string
  businessName:  string
  logoUrl?:      string
  defaultRate?:  number
  tier:          'free' | 'paid'
  clientLimit:   number
  clientCount:   number
  proExpiresAt?: string
  purchases?:    TenantPurchase[]
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

function docToTenant(id: string, data: Record<string, unknown>): Tenant {
  return {
    id,
    ownerId:      String(data.ownerId      || ''),
    businessName: String(data.businessName || ''),
    logoUrl:      String(data.logoUrl      || ''),
    defaultRate:  Number(data.defaultRate  || 1.5),
    tier:         (data.tier as 'free' | 'paid') || 'free',
    clientLimit:  Number(data.clientLimit  || (data.tier === 'paid' ? config.paidTierLimit : config.freeTierLimit)),
    clientCount:  Number(data.clientCount  || 0),
    proExpiresAt: data.proExpiresAt ? tsToStr(data.proExpiresAt) : undefined,
    purchases:    Array.isArray(data.purchases) ? data.purchases as TenantPurchase[] : [],
    createdAt:    tsToStr(data.createdAt),
  }
}

// ── PRO STATUS HELPERS ────────────────────────────────────────

export function isProActive(tenant: Tenant): boolean {
  if (tenant.tier !== 'paid') return false
  if (!tenant.proExpiresAt)   return true
  return tenant.proExpiresAt >= todayStr()
}

export function daysUntilExpiry(tenant: Tenant): number | null {
  if (!tenant.proExpiresAt) return null
  const exp   = new Date(tenant.proExpiresAt)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((exp.getTime() - today.getTime()) / 86400000)
}

export function isNearExpiry(tenant: Tenant): boolean {
  const days = daysUntilExpiry(tenant)
  if (days === null) return false
  return days >= 0 && days <= config.renewalReminderDays
}

export function isExpired(tenant: Tenant): boolean {
  const days = daysUntilExpiry(tenant)
  if (days === null) return false
  return days < 0
}

// ── TENANT ────────────────────────────────────────────────────

// Get ALL tenants for a user — used for deduplication
async function getAllTenantsForOwner(uid: string): Promise<Tenant[]> {
  const snap = await getDocs(
    query(collection(db, 'tenants'), where('ownerId', '==', uid))
  )
  return snap.docs.map(d => docToTenant(d.id, d.data() as Record<string, unknown>))
}

// Merge clients/loans/payments from duplicate into keeper, then delete duplicate
async function mergeTenants(keepId: string, deleteId: string): Promise<void> {
  // Move clients
  const clients = await getDocs(query(collection(db, 'clients'), where('tenantId', '==', deleteId)))
  await Promise.all(clients.docs.map(d => updateDoc(doc(db, 'clients', d.id), { tenantId: keepId })))

  // Move loans
  const loans = await getDocs(query(collection(db, 'loans'), where('tenantId', '==', deleteId)))
  await Promise.all(loans.docs.map(d => updateDoc(doc(db, 'loans', d.id), { tenantId: keepId })))

  // Move payments
  const payments = await getDocs(query(collection(db, 'payments'), where('tenantId', '==', deleteId)))
  await Promise.all(payments.docs.map(d => updateDoc(doc(db, 'payments', d.id), { tenantId: keepId })))

  // Delete the duplicate tenant
  await deleteDoc(doc(db, 'tenants', deleteId))
}

// Main function — always search first, create only if truly not found
export async function getOrCreateTenant(uid: string, displayName: string): Promise<Tenant> {
  const all = await getAllTenantsForOwner(uid)

  // No tenant at all — create fresh
  if (all.length === 0) {
    const data = {
      ownerId:      uid,
      businessName: displayName,
      logoUrl:      '',
      defaultRate:  1.5,
      tier:         'free',
      clientLimit:  config.freeTierLimit,
      clientCount:  0,
      purchases:    [],
      createdAt:    serverTimestamp(),  // server timestamp — accurate always
    }
    const ref = await addDoc(collection(db, 'tenants'), data)
    return {
      id:           ref.id,
      ownerId:      uid,
      businessName: displayName,
      logoUrl:      '',
      defaultRate:  1.5,
      tier:         'free',
      clientLimit:  config.freeTierLimit,
      clientCount:  0,
      purchases:    [],
      createdAt:    todayStr(),
    }
  }

  // Exactly one tenant — perfect, return it
  if (all.length === 1) return all[0]

  // Multiple tenants — deduplicate:
  // Priority: paid > free, then oldest createdAt
  const sorted = [...all].sort((a, b) => {
    if (a.tier === 'paid' && b.tier !== 'paid') return -1
    if (b.tier === 'paid' && a.tier !== 'paid') return 1
    return a.createdAt < b.createdAt ? -1 : 1
  })

  const [keep, ...duplicates] = sorted

  // Merge all duplicates into the keeper (moves all data, no loss)
  await Promise.all(duplicates.map(d => mergeTenants(keep.id, d.id)))

  // Update clientCount on keeper after merge
  const totalClients = await getDocs(
    query(collection(db, 'clients'), where('tenantId', '==', keep.id))
  )
  await updateDoc(doc(db, 'tenants', keep.id), {
    clientCount: totalClients.size
  })

  return { ...keep, clientCount: totalClients.size }
}

// Keep this for backward compatibility
export async function getTenantByOwner(uid: string): Promise<Tenant | null> {
  const all = await getAllTenantsForOwner(uid)
  if (all.length === 0) return null
  // return paid first, then oldest
  return all.sort((a, b) => {
    if (a.tier === 'paid' && b.tier !== 'paid') return -1
    if (b.tier === 'paid' && a.tier !== 'paid') return 1
    return a.createdAt < b.createdAt ? -1 : 1
  })[0]
}

export async function createTenant(uid: string, businessName: string): Promise<Tenant> {
  return getOrCreateTenant(uid, businessName)
}

export async function updateTenant(tenantId: string, data: Partial<Tenant>): Promise<void> {
  await updateDoc(doc(db, 'tenants', tenantId), data as Record<string, unknown>)
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
  tenantId: string, name: string, phone: string, tenant: Tenant
) {
  if (tenant.clientCount >= tenant.clientLimit) {
    throw new Error(tenant.tier === 'free' ? 'FREE_LIMIT' : 'PAID_LIMIT')
  }
  const data = {
    tenantId,
    name:      name.trim(),
    phone:     phone.trim(),
    createdAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'clients'), data)
  await updateDoc(doc(db, 'tenants', tenantId), { clientCount: tenant.clientCount + 1 })
  return { id: ref.id, tenantId, name: name.trim(), phone: phone.trim(), createdAt: todayStr() }
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
  tenantId: string, clientId: string,
  principal: number, rate: number, days: number,
) {
  const data = { tenantId, clientId, principal, rate, days, date: serverTimestamp(), closed: false }
  const ref  = await addDoc(collection(db, 'loans'), data)
  return { id: ref.id, tenantId, clientId, principal, rate, days, date: todayStr(), closed: false }
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
  tenantId: string, loanId: string, amount: number, mode: string,
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

// ── EXPORTED TYPES ────────────────────────────────────────────
export type Client  = Awaited<ReturnType<typeof getClients>>[0]
export type Loan    = Awaited<ReturnType<typeof getLoans>>[0]
export type Payment = Awaited<ReturnType<typeof getPayments>>[0]