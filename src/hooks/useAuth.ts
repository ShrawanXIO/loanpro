// src/hooks/useAuth.ts
'use client'
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { getOrCreateTenant, getTenantByOwner, Tenant } from '@/lib/firestore'
import { migrateTenant } from '@/lib/migrate'

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null)
  const [tenant,  setTenant]  = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        // getOrCreateTenant: searches first, deduplicates, creates only if truly new
        let t = await getOrCreateTenant(u.uid, u.displayName || 'My Business')

        // Backfill any missing fields (clientLimit, proExpiresAt etc.)
        await migrateTenant(t)

        // Re-fetch to get the final clean state
        t = await getTenantByOwner(u.uid) ?? t

        setTenant(t)
      } else {
        setTenant(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn      = () => signInWithPopup(auth, googleProvider)
  const signOutUser = () => signOut(auth)

  return { user, tenant, loading, signIn, signOut: signOutUser }
}