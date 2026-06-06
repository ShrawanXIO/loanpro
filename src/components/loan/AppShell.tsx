'use client'
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

export default function AppShell() {
  const { user, tenant, loading, signOut } = useAuth()
  const router = useRouter()

  const [screen,   setScreen]   = useState<Screen>('clients')
  const [clientId, setClientId] = useState<string | undefined>()
  const [loanId,   setLoanId]   = useState<string | undefined>()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  if (loading || !user || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full spinner" />
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      </div>
    )
  }

  function goTo(s: Screen, cid?: string, lid?: string) {
    setScreen(s); setClientId(cid); setLoanId(lid); setMenuOpen(false)
  }
  function goBack() {
    if (screen === 'loan-detail')        goTo('client-detail', clientId)
    else if (screen === 'client-detail') goTo('clients')
    else                                 goTo('clients')
  }

  const canGoBack = screen === 'client-detail' || screen === 'loan-detail'
  const isPaid    = tenant.tier === 'paid'
  const upiId     = (tenant as unknown as Record<string,string>).upiId || 'yourname@upi'

  // Panels
  const panelClients = (
    <ClientList tenant={tenant} isPaid={isPaid}
      selectedClientId={clientId}
      onSelectClient={id => goTo('client-detail', id)} />
  )
  const panelClientDetail = clientId
    ? <ClientDetail tenantId={tenant.id} clientId={clientId}
        selectedLoanId={loanId}
        onSelectLoan={lid => goTo('loan-detail', clientId, lid)} />
    : <EmptyPanel icon="👆" message="Select a client to view details" />

  const panelLoanDetail = loanId && clientId
    ? <LoanDetail tenantId={tenant.id} loanId={loanId} clientId={clientId} />
    : <EmptyPanel icon="📋" message="Select a loan to view details" />

  const navItems = [
    { s: 'clients'   as Screen, icon: <Users size={16}/>,           label: 'Clients'   },
    { s: 'dashboard' as Screen, icon: <LayoutDashboard size={16}/>, label: 'Dashboard', proOnly: true },
    { s: 'settings'  as Screen, icon: <Settings size={16}/>,        label: 'Settings'  },
  ]

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">

      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT
      ═══════════════════════════════════════════ */}
      <div className="hidden lg:flex flex-col h-screen">

        {/* ── DESKTOP HEADER: Vendor banner ── */}
        <header className="bg-blue-700 text-white flex-shrink-0"
          style={{boxShadow:'0 2px 6px rgba(0,0,0,.25)'}}>

          {/* Top row: vendor branding */}
          <div className="flex items-center gap-3 px-6 py-3 border-b border-blue-600/50">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt="logo"
                  className="h-10 w-10 rounded-lg object-contain bg-white/10 p-0.5"/>
              : <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center text-base font-bold">
                  {tenant.businessName.slice(0,2).toUpperCase()}
                </div>
            }
            <div>
              <div className="font-bold text-lg leading-tight">{tenant.businessName}</div>
              <div className="text-blue-200 text-xs">{user.email}</div>
            </div>
            <div className="flex-1"/>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${isPaid ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'}`}>
              {isPaid ? '⭐ Pro' : `Free · ${tenant.clientCount}/10`}
            </span>
          </div>

          {/* Bottom row: nav tabs */}
          <div className="flex items-center px-4">
            {navItems.filter(i => !i.proOnly || isPaid).map(item => (
              <button key={item.s} onClick={() => goTo(item.s)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  screen === item.s
                    ? 'border-white text-white'
                    : 'border-transparent text-blue-200 hover:text-white hover:border-blue-300'
                }`}>
                {item.icon}{item.label}
              </button>
            ))}
            <div className="flex-1"/>
            <button onClick={signOut}
              className="flex items-center gap-2 text-xs text-blue-200 hover:text-white px-3 py-2">
              <LogOut size={14}/> Sign Out
            </button>
          </div>
        </header>

        {/* ── DESKTOP CONTENT: 3 panels ── */}
        <div className="flex flex-1 overflow-hidden">
          {screen === 'settings' ? (
            <div className="flex-1 overflow-y-auto"><SettingsPanel tenant={tenant}/></div>
          ) : screen === 'dashboard' ? (
            <div className="flex-1 overflow-y-auto">
              {isPaid ? <Dashboard tenantId={tenant.id}/> : <UpgradePrompt upiId={upiId}/>}
            </div>
          ) : (
            <>
              <div className="w-64 border-r border-gray-200 bg-gray-50 overflow-y-auto flex-shrink-0">
                {panelClients}
              </div>
              <div className="w-80 border-r border-gray-200 bg-white overflow-y-auto flex-shrink-0">
                {panelClientDetail}
              </div>
              <div className="flex-1 bg-gray-50 overflow-y-auto">
                {panelLoanDetail}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          MOBILE LAYOUT
      ═══════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col h-screen">

        {/* ── MOBILE APP BAR ── */}
        <header className="bg-blue-700 text-white h-14 flex items-center px-4 gap-3 flex-shrink-0"
          style={{boxShadow:'0 2px 6px rgba(0,0,0,.2)'}}>
          {canGoBack
            ? <button onClick={goBack} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
                <ChevronLeft size={22}/>
              </button>
            : <button onClick={() => setMenuOpen(o => !o)} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
                {menuOpen ? <X size={20}/> : <Menu size={20}/>}
              </button>
          }
          {/* Vendor branding in mobile bar */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {tenant.logoUrl
              ? <img src={tenant.logoUrl} alt="" className="h-7 w-7 rounded object-contain bg-white/10"/>
              : <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center text-xs font-bold">
                  {tenant.businessName.slice(0,2).toUpperCase()}
                </div>
            }
            <span className="font-semibold text-sm truncate">{tenant.businessName}</span>
          </div>
          <button onClick={() => goTo('settings')} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10">
            <Settings size={18}/>
          </button>
        </header>

        {/* ── MOBILE DRAWER ── */}
        {menuOpen && (
          <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)}>
            <div className="absolute inset-0 bg-black/30"/>
            <nav className="absolute top-0 left-0 h-full w-64 bg-white shadow-xl flex flex-col"
              onClick={e => e.stopPropagation()}>
              {/* Vendor header in drawer */}
              <div className="bg-blue-700 text-white p-5 pt-6">
                {tenant.logoUrl
                  ? <img src={tenant.logoUrl} alt="" className="h-12 w-12 rounded-lg mb-3 object-contain bg-white/20"/>
                  : <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center text-xl font-bold mb-3">
                      {tenant.businessName.slice(0,2).toUpperCase()}
                    </div>
                }
                <div className="font-bold text-base truncate">{tenant.businessName}</div>
                <div className="text-blue-200 text-xs mt-0.5">{user.email}</div>
                <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-medium ${isPaid ? 'bg-yellow-400 text-yellow-900' : 'bg-white/20 text-white'}`}>
                  {isPaid ? '⭐ Pro' : `Free · ${tenant.clientCount}/10`}
                </span>
              </div>
              <div className="flex-1 py-2">
                {navItems.map(item => (
                  <button key={item.s} onClick={() => goTo(item.s)}
                    className={`w-full flex items-center gap-4 px-5 py-3 text-sm font-medium transition-colors ${screen === item.s ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                    {item.icon}{item.label}
                    {item.proOnly && !isPaid && <span className="ml-auto text-xs text-gray-400">Pro</span>}
                  </button>
                ))}
              </div>
              <button onClick={signOut}
                className="flex items-center gap-4 px-5 py-4 text-sm text-gray-500 hover:bg-gray-50 border-t border-gray-100">
                <LogOut size={16}/> Sign Out
              </button>
            </nav>
          </div>
        )}

        {/* ── MOBILE CONTENT ── */}
        <div className="flex-1 overflow-y-auto">
          {screen === 'clients'       && panelClients}
          {screen === 'client-detail' && panelClientDetail}
          {screen === 'loan-detail'   && panelLoanDetail}
          {screen === 'dashboard'     && (isPaid ? <Dashboard tenantId={tenant.id}/> : <UpgradePrompt upiId={upiId}/>)}
          {screen === 'settings'      && <SettingsPanel tenant={tenant}/>}
        </div>
      </div>

    </div>
  )
}

function EmptyPanel({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-64 text-gray-400 gap-3 p-8">
      <span className="text-5xl opacity-20">{icon}</span>
      <span className="text-sm text-center">{message}</span>
    </div>
  )
}

function UpgradePrompt({ upiId }: { upiId: string }) {
  const upiLink = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=LoanPro&am=5000&cu=INR&tn=LoanPro+Pro+Upgrade`
  return (
    <div className="flex items-center justify-center min-h-full p-8">
      <div className="bg-white rounded-xl p-8 max-w-sm text-center" style={{boxShadow:'0 2px 8px rgba(0,0,0,.1)'}}>
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-xl font-bold mb-2 text-gray-800">Dashboard is a Pro feature</h2>
        <p className="text-gray-500 text-sm mb-2">Upgrade to Pro (₹5,000/year) to unlock:</p>
        <ul className="text-sm text-gray-500 mb-6 text-left space-y-1 mx-auto w-fit">
          {['Up to 100 clients','Analytics dashboard','Top borrowers report','Overdue summary'].map(f => (
            <li key={f} className="flex items-center gap-2"><span className="text-green-500">✓</span>{f}</li>
          ))}
        </ul>
        {/* UPI deep link — works on Android/iPhone */}
        <a href={upiLink}
          className="block bg-blue-600 text-white font-semibold py-3 rounded-lg mb-3 hover:bg-blue-700 transition-colors">
          Pay ₹5,000 via UPI
        </a>
        {/* Fallback: show UPI ID as text for desktop users */}
        <p className="text-xs text-gray-400 mb-1">Or send ₹5,000 to UPI ID:</p>
        <p className="text-sm font-mono font-semibold text-gray-700 bg-gray-100 rounded px-3 py-1 inline-block mb-3">{upiId}</p>
        <p className="text-xs text-gray-400">After payment, WhatsApp your transaction ID to activate Pro.</p>
      </div>
    </div>
  )
}