'use client'
import { useState, useEffect } from 'react'
import { Search, X, UserPlus, AlertCircle } from 'lucide-react'
import { getClients, addClientFS, Client, Tenant } from '@/lib/firestore'
import { fmtINR } from '@/lib/finance'

interface Props {
  tenant: Tenant
  isPaid: boolean
  onSelectClient: (id: string) => void
}

function avatarColor(name: string) {
  const cols = ['#1565C0','#283593','#00695C','#558B2F','#4527A0','#AD1457','#BF360C','#6A1B9A']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return cols[h % cols.length]
}
function initials(name: string) { return name.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase() }

export default function ClientList({ tenant, isPaid, onSelectClient }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  useEffect(() => {
    getClients(tenant.id).then(c => { setClients(c); setLoading(false) })
  }, [tenant.id])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search)
  )

  async function handleAdd() {
    if (!/^[A-Za-z\s]{2,50}$/.test(newName.trim())) { setErr('Name: letters and spaces only (2–50 chars)'); return }
    if (!/^\d{10}$/.test(newPhone.trim())) { setErr('Phone: 10 digits only'); return }
    if (clients.find(c => c.phone === newPhone.trim())) { setErr('Phone number already registered'); return }
    setSaving(true); setErr('')
    try {
      const c = await addClientFS(tenant.id, newName, newPhone, tenant.tier, tenant.clientCount)
      setClients(prev => [...prev, c].sort((a,b) => a.name.localeCompare(b.name)))
      setShowAdd(false); setNewName(''); setNewPhone('')
    } catch (e: unknown) {
      if (e instanceof Error && e.message === 'FREE_LIMIT') setErr('Free plan limit (10 clients) reached. Upgrade to Pro.')
      else setErr('Something went wrong. Try again.')
    }
    setSaving(false)
  }

  const limit = isPaid ? 100 : 10
  const atLimit = tenant.clientCount >= limit

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Search */}
      <div className="bg-white rounded-lg elev-1 flex items-center px-3 h-12 gap-2 mb-3">
        <Search size={18} className="text-gray-400 flex-shrink-0" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name or phone…"
          className="flex-1 outline-none text-sm text-gray-700 placeholder-gray-400 bg-transparent" />
        {search && <button onClick={() => setSearch('')}><X size={16} className="text-gray-400" /></button>}
      </div>

      {/* Client list card */}
      <div className="bg-white rounded-lg elev-1 overflow-hidden mb-4">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-gray-400 text-sm">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-primary-600 rounded-full spinner" />
            Loading clients…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-10 text-gray-400 text-sm">
            <UserPlus size={40} className="mx-auto mb-3 opacity-30" />
            {search ? 'No clients found' : 'No clients yet. Add your first client.'}
          </div>
        ) : (
          filtered.map(c => (
            <button key={c.id} onClick={() => onSelectClient(c.id)}
              className="w-full flex items-center gap-4 px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0"
                style={{ background: avatarColor(c.name) }}>
                {initials(c.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                <div className="text-xs text-gray-400">{c.phone}</div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))
        )}
      </div>

      {/* Add client */}
      {!showAdd ? (
        <button onClick={() => { if (!atLimit) setShowAdd(true) }}
          className={`w-full py-3 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${atLimit ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}>
          <UserPlus size={18} /> Add Client
        </button>
      ) : (
        <div className="bg-white rounded-lg elev-1 p-5">
          <div className="font-semibold text-gray-800 mb-4">New Client</div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Full Name</label>
            <input value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="e.g. Ramesh Kumar"
              className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-2 text-sm text-gray-800 bg-transparent" />
          </div>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Phone</label>
            <input value={newPhone} onChange={e => setNewPhone(e.target.value.replace(/\D/g,'').slice(0,10))}
              placeholder="10-digit number" maxLength={10}
              className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-2 text-sm text-gray-800 bg-transparent" />
          </div>
          {err && <div className="flex items-center gap-1 text-red-600 text-xs mb-3"><AlertCircle size={14}/>{err}</div>}
          <div className="flex gap-3">
            <button onClick={() => { setShowAdd(false); setErr('') }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleAdd} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {atLimit && !showAdd && (
        <p className="text-center text-xs text-gray-400 mt-2">
          {isPaid ? 'Pro limit (100 clients) reached.' : 'Free limit (10 clients) reached. '}
          {!isPaid && <a href="upi://pay?pa=8801080101@upi&pn=LoanPro&am=5000&cu=INR" className="text-primary-600 underline">Upgrade to Pro</a>}
        </p>
      )}
    </div>
  )
}
