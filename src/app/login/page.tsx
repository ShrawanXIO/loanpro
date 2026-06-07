'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/lib/logo'

export default function LoginPage() {
  const { user, loading, signIn } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) router.replace('/app')
  }, [user, loading, router])

  return (
    <div className="min-h-screen bg-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-8 w-full max-w-sm text-center"
        style={{boxShadow:'0 20px 60px rgba(0,0,0,.25)'}}>

        <div className="flex justify-center mb-4">
          <Logo size={72} />
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-1">LoanPro</h1>
        <p className="text-gray-500 text-sm mb-8">
          Sign in to manage your clients and loans
        </p>

        <button onClick={signIn} disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-lg py-3 px-4 font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50">
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
          </svg>
          Continue with Google
        </button>

        <p className="text-xs text-gray-400 mt-6">
          Free plan: up to 10 clients. No credit card needed.
        </p>
      </div>
    </div>
  )
}