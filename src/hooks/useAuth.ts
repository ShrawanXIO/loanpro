// src/hooks/useAuth.ts
'use client'
import { useState, useEffect } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { getTenantByOwner, createTenant, Tenant } from '@/lib/firestore'

export function useAuth() {
  const [user,   setUser]   = useState<User | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        let t = await getTenantByOwner(u.uid)
        if (!t) t = await createTenant(u.uid, u.displayName || 'My Business')
        setTenant(t)
      } else {
        setTenant(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  const signIn = () => signInWithPopup(auth, googleProvider)
  const signOutUser = () => signOut(auth)

  return { user, tenant, loading, signIn, signOut: signOutUser }
}
