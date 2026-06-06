// src/lib/migrate.ts
// Runs once on every login. Safe to run multiple times.
// Only updates fields that are missing — never overwrites existing values.

import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { Tenant } from './firestore'
import config from './config'

export async function migrateTenant(tenant: Tenant): Promise<void> {
  const updates: Record<string, unknown> = {}

  // Missing clientLimit → set default based on tier
  if (!tenant.clientLimit || tenant.clientLimit === 0) {
    updates.clientLimit = tenant.tier === 'paid'
      ? config.paidTierLimit
      : config.freeTierLimit
  }

  // Paid tenant with no expiry date → set to 1 year from today
  if (tenant.tier === 'paid' && !tenant.proExpiresAt) {
    const d = new Date()
    d.setFullYear(d.getFullYear() + 1)
    updates.proExpiresAt = d.toISOString().slice(0, 10)
  }

  // Nothing missing — skip Firestore write entirely
  if (Object.keys(updates).length === 0) return

  await updateDoc(doc(db, 'tenants', tenant.id), updates)
}