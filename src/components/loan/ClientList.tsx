'use client'
import { useState, useEffect } from 'react'
import { Search, X, UserPlus, AlertCircle } from 'lucide-react'
import { getClients, addClientFS, Client, Tenant } from '@/lib/firestore'
import config from '@/lib/config'

interface Props {
  tenant:           Tenant
  isPaid:           boolean
  selectedClientId?: string
  onSelectClient:   (id: string) => void
}

function avatarColor(name: string) {
  const cols = ['#1565C0','#283593','#00695C','#558B2F','#4527A0','#AD1457','#BF360C','#6A1B9A']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return cols[h % cols.length]
}
function initials(name: string) {
  return name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
}

export default function ClientList({ tenant, isPaid, selectedClientId, onSelectClient }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone,setNewPhone]= useState('')
  const [saving,  setSaving]  = useState(false)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    getClients(tenant.id).then(c => { setClients(c); setLoading(false) })
  }, [tenant.id])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  async function handleAdd() {
    if (!/^[A-Za-z\s]{2,50}$/.test(newName.trim())) { setErr('Name: letters and spaces only (2–50 chars)'); return }
    if (!/^\d{10}$/.test(newPhone.trim()))           { setErr('Phone: 10 digits only'); return }
    if (clients.find(c => c.phone === newPhone.trim())) { setErr('Phone number already registered'); return }
    setSaving(true); setErr('')
    try {
      // Pass full tenant object — addClientFS reads clientLimit from it
      const c = await addClientFS(tenant.id, newName, newPhone, tenant)
      setClients(prev => [...prev, c].sort((a,b) => a.name.localeCompare(b.name)))
      setShowAdd(false); setNewName(''); setNewPhone('')
    } catch (e: unknown) {
      setErr(e instanceof Error && e.message === 'FREE_LIMIT'
        ? `Free plan limit (${tenant.clientLimit} clients) reached. Upgrade to Pro for ₹${config.currentPriceINR.toLocaleString('en-IN')}/year.`
        : e instanceof Error && e.message === 'PAID_LIMIT'
        ? `Pro plan limit (${tenant.clientLimit} clients) reached. Contact us to increase.`
        : 'Something went wrong. Try again.')
    }
    setSaving(false)
  }

  // Use tenant.clientLimit — set in Firestore, no hardcoded values
  const atLimit    = tenant.clientCount >= tenant.clientLimit
  const upgradeUPI = `upi://pay?pa=${encodeURIComponent(config.ownerUpi)}&pn=${encodeURIComponent(config.appName)}&am=${config.currentPriceINR}&cu=INR&tn=${encodeURIComponent(config.appName + ' Pro - ' + tenant.businessName)}`
  const upgradeWA  = `https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent(`Hi, I want to upgrade ${config.appName} Pro.\nBusiness: ${tenant.businessName}`)}`

  return (
    <div className="p-3 pb-6">

      {/* Upgrade banner — free users only */}
      {!isPaid && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl p-4 mb-3">
          <div className="font-bold text-sm mb-0.5">Upgrade to Pro — ₹{config.currentPriceINR.toLocaleString('en-IN')}/year</div>
          <div className="text-blue-100 text-xs mb-3">
            {tenant.clientCount}/{tenant.clientLimit} clients used · Unlock {config.paidTierLimit} clients + Dashboard + Share reports
          </div>
          <div className="flex gap-2">
            <a href={upgradeUPI}
              className="flex-1 text-center bg-white text-blue-700 font-bold text-xs py-2 rounded-lg hover:bg-blue-50 transition-colors">
              Pay via UPI
            </a>
            <a href={upgradeWA} target="_blank" rel="noreferrer"
              className="flex-1 text-center bg-green-500 text-white font-bold text-xs py-2 rounded-lg hover:bg-green-600 transition-colors">
              📲 WhatsApp Us
            </a>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-lg flex items-center px-3 h-10 gap-2 mb-3 shadow-sm">
        <Search size={16} className="text-gray-400 flex-shrink-0"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent"/>
        {search && <button onClick={() => setSearch('')}><X size={14} className="text-gray-400"/></button>}
      </div>

      {/* Client list */}
      <div className="bg-white rounded-lg overflow-hidden mb-3 shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-gray-400 text-sm">
            <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-600 rounded-full spinner"/>Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-8 text-gray-400 text-sm">
            <UserPlus size={32} className="mx-auto mb-2 opacity-30"/>
            {search ? 'No clients match' : 'No clients yet — add your first client below'}
          </div>
        ) : (
          filtered.map(c => (
            <button key={c.id} onClick={() => onSelectClient(c.id)}
              className={`w-full flex items-center gap-3 px-3 py-3.5 border-b border-gray-100 last:border-0 text-left transition-colors ${
                selectedClientId === c.id ? 'bg-blue-50 border-l-2 border-l-blue-600' : 'hover:bg-gray-50'
              }`}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                style={{background: avatarColor(c.name)}}>
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                <div className="text-xs text-gray-400">{c.phone}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          ))
        )}
      </div>

      {/* Add client */}
      {!showAdd ? (
        <button onClick={() => !atLimit && setShowAdd(true)}
          className={`w-full py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
            atLimit ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
          <UserPlus size={16}/> Add Client
        </button>
      ) : (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="font-semibold text-gray-800 text-sm mb-3">New Client</div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Full Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Ramesh Kumar"
              className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-1.5 text-sm bg-transparent"/>
          </div>
          <div className="mb-3">
            <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Phone Number</label>
            <input value={newPhone} onChange={e => setNewPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
              placeholder="10-digit number" maxLength={10}
              className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-1.5 text-sm bg-transparent"/>
          </div>
          {err && (
            <div className="flex items-start gap-1 text-red-600 text-xs mb-3">
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5"/><span>{err}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => { setShowAdd(false); setErr('') }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {atLimit && !showAdd && (
        <p className="text-center text-xs text-gray-400 mt-2">
          {isPaid ? `Pro limit (${tenant.clientLimit} clients) reached. ` : 'Free limit reached. '}
          {!isPaid && <a href={upgradeWA} target="_blank" rel="noreferrer" className="text-blue-600 underline">WhatsApp us to upgrade →</a>}
        </p>
      )}
    </div>
  )
}