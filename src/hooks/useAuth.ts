// src/hooks/useAuth.ts
'use client'
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { getTenantByOwner, createTenant, Tenant } from '@/lib/firestore'
import { migrateTenant } from '@/lib/migrate'

export function useAuth() {
  const [user,    setUser]    = useState<User | null>(null)
  const [tenant,  setTenant]  = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        let t = await getTenantByOwner(u.uid)

        if (!t) {
          // Brand new user — create with correct defaults
          t = await createTenant(u.uid, u.displayName || 'My Business')
        } else {
          // Existing user — fill in any missing fields silently
          await migrateTenant(t)
          // Re-fetch so UI has the updated values
          t = (await getTenantByOwner(u.uid)) ?? t
        }

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