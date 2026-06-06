'use client'
// AppShell — handles auth gate, tenant loading, navigation, responsive layout
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { Menu, X, Settings, Users, LayoutDashboard, LogOut, ChevronLeft } from 'lucide-react'
import ClientList from './ClientList'
import ClientDetail from './ClientDetail'
import LoanDetail from './LoanDetail'
import Dashboard from './Dashboard'
import SettingsPanel from './SettingsPanel'

export type Screen = 'clients' | 'client-detail' | 'loan-detail' | 'dashboard' | 'settings'

export interface NavState {
  screen: Screen
  clientId?: string
  loanId?: string
  direction: 'forward' | 'back'
}

export default function AppShell() {
  const { user, tenant, loading, signOut } = useAuth()
  const router = useRouter()
  const [nav, setNav] = useState<NavState>({ screen: 'clients', direction: 'forward' })
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full spinner" />
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  function navigate(next: Partial<NavState> & { screen: Screen }) {
    setNav({ direction: 'forward', ...next })
    setMenuOpen(false)
  }
  function goBack() {
    if (nav.screen === 'loan-detail')    setNav({ screen: 'client-detail', clientId: nav.clientId, direction: 'back' })
    else if (nav.screen === 'client-detail') setNav({ screen: 'clients', direction: 'back' })
    else setNav({ screen: 'clients', direction: 'back' })
  }

  const canGoBack = nav.screen === 'client-detail' || nav.screen === 'loan-detail'
  const isPaid    = tenant.tier === 'paid'

  // Title for app bar
  const titles: Record<Screen, string> = {
    clients: tenant.businessName,
    'client-detail': 'Client',
    'loan-detail': 'Loan Detail',
    dashboard: 'Dashboard',
    settings: 'Settings',
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ── APP BAR ── */}
      <header className="bg-primary-600 text-white h-14 flex items-center px-4 gap-3 elev-2 sticky top-0 z-40">
        {canGoBack ? (
          <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            <ChevronLeft size={22} />
          </button>
        ) : (
          <button onClick={() => setMenuOpen(!menuOpen)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        )}

        {/* Vendor logo / name */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {tenant.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.logoUrl} alt="logo" className="h-7 w-7 rounded object-contain bg-white/10" />
          ) : (
            <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
              {tenant.businessName.slice(0,2).toUpperCase()}
            </div>
          )}
          <span className="font-medium text-base truncate">{titles[nav.screen]}</span>
        </div>

        <button onClick={() => navigate({ screen: 'settings' })} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors">
          <Settings size={18} />
        </button>
      </header>

      {/* ── DRAWER MENU ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
          <nav className="absolute top-0 left-0 h-full w-72 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Tenant header */}
            <div className="bg-primary-600 text-white p-6 pt-16">
              {tenant.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={tenant.logoUrl} alt="logo" className="h-12 w-12 rounded-lg object-contain mb-3 bg-white/20" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center text-xl font-bold mb-3">
                  {tenant.businessName.slice(0,2).toUpperCase()}
                </div>
              )}
              <div className="font-semibold text-lg truncate">{tenant.businessName}</div>
              <div className="text-blue-200 text-xs mt-1">{user.email}</div>
              <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isPaid ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'}`}>
                {isPaid ? '⭐ Pro' : 'Free · ' + tenant.clientCount + '/10 clients'}
              </span>
            </div>

            <div className="flex-1 py-2">
              {[
                { screen: 'clients' as Screen, icon: <Users size={20}/>, label: 'Clients' },
                ...(isPaid ? [{ screen: 'dashboard' as Screen, icon: <LayoutDashboard size={20}/>, label: 'Dashboard' }] : []),
                { screen: 'settings' as Screen, icon: <Settings size={20}/>, label: 'Settings' },
              ].map(item => (
                <button key={item.screen}
                  onClick={() => navigate({ screen: item.screen })}
                  className={`w-full flex items-center gap-4 px-6 py-3 text-sm font-medium transition-colors ${nav.screen === item.screen ? 'bg-primary-50 text-primary-600' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {item.icon}{item.label}
                </button>
              ))}
            </div>

            <button onClick={signOut} className="flex items-center gap-4 px-6 py-4 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100">
              <LogOut size={18}/> Sign Out
            </button>
          </nav>
        </div>
      )}

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-hidden">
        {/* Desktop: sidebar + content */}
        <div className="hidden lg:flex h-[calc(100vh-56px)]">
          {/* Sidebar nav */}
          <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Account</div>
              <div className="font-medium text-gray-800 truncate">{tenant.businessName}</div>
              <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isPaid ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-50 text-primary-600'}`}>
                {isPaid ? '⭐ Pro' : 'Free · ' + tenant.clientCount + '/10'}
              </span>
            </div>
            <nav className="flex-1 py-2">
              {[
                { screen: 'clients' as Screen, icon: <Users size={18}/>, label: 'Clients' },
                ...(isPaid ? [{ screen: 'dashboard' as Screen, icon: <LayoutDashboard size={18}/>, label: 'Dashboard' }] : []),
                { screen: 'settings' as Screen, icon: <Settings size={18}/>, label: 'Settings' },
              ].map(item => (
                <button key={item.screen}
                  onClick={() => navigate({ screen: item.screen })}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${nav.screen === item.screen ? 'bg-primary-50 text-primary-600 border-r-2 border-primary-600' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {item.icon}{item.label}
                </button>
              ))}
            </nav>
            <button onClick={signOut} className="flex items-center gap-3 px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 border-t border-gray-100">
              <LogOut size={16}/> Sign Out
            </button>
          </aside>

          {/* Content area */}
          <div className="flex-1 overflow-auto bg-gray-100">
            <ScreenRenderer nav={nav} tenant={tenant} navigate={navigate} isPaid={isPaid} />
          </div>
        </div>

        {/* Mobile: full screen */}
        <div className="lg:hidden h-[calc(100vh-56px)] overflow-auto">
          <ScreenRenderer nav={nav} tenant={tenant} navigate={navigate} isPaid={isPaid} />
        </div>
      </main>
    </div>
  )
}

function ScreenRenderer({ nav, tenant, navigate, isPaid }: {
  nav: NavState
  tenant: import('@/lib/firestore').Tenant
  navigate: (n: Partial<NavState> & { screen: Screen }) => void
  isPaid: boolean
}) {
  const cls = nav.direction === 'forward' ? 'page-enter' : 'page-back'

  return (
    <div className={`${cls} h-full`}>
      {nav.screen === 'clients' && (
        <ClientList tenant={tenant} isPaid={isPaid}
          onSelectClient={clientId => navigate({ screen: 'client-detail', clientId })} />
      )}
      {nav.screen === 'client-detail' && nav.clientId && (
        <ClientDetail tenantId={tenant.id} clientId={nav.clientId}
          onSelectLoan={loanId => navigate({ screen: 'loan-detail', clientId: nav.clientId, loanId })} />
      )}
      {nav.screen === 'loan-detail' && nav.loanId && (
        <LoanDetail tenantId={tenant.id} loanId={nav.loanId} clientId={nav.clientId!} />
      )}
      {nav.screen === 'dashboard' && isPaid && (
        <Dashboard tenantId={tenant.id} />
      )}
      {nav.screen === 'settings' && (
        <SettingsPanel tenant={tenant} />
      )}
      {nav.screen === 'dashboard' && !isPaid && (
        <UpgradePrompt />
      )}
    </div>
  )
}

function UpgradePrompt() {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="bg-white rounded-xl p-8 max-w-sm text-center elev-1">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold mb-2 text-gray-800">Dashboard is a Pro feature</h2>
        <p className="text-gray-500 text-sm mb-6">Upgrade to Pro (₹5,000/year) to unlock analytics, top borrowers, overdue summary, and up to 100 clients.</p>
        <a href="upi://pay?pa=8801080101@upi&pn=LoanPro&am=5000&cu=INR&tn=LoanPro+Pro+Upgrade"
          className="block bg-primary-600 text-white font-semibold py-3 rounded-lg mb-3 hover:bg-primary-700 transition-colors">
          Pay ₹5,000 via UPI
        </a>
        <p className="text-xs text-gray-400">After payment, contact us with your UPI transaction ID to activate Pro.</p>
      </div>
    </div>
  )
}
