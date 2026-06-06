'use client'
import { useState, useEffect, useCallback } from 'react'
import { Plus } from 'lucide-react'
import { getClients, getLoans, addLoan, Loan, Client } from '@/lib/firestore'
import { loanSnapshot, fmtINR, fmtDate, toDays, calcSI } from '@/lib/finance'

interface Props {
  tenantId: string
  clientId: string
  onSelectLoan: (loanId: string) => void
}

export default function ClientDetail({ tenantId, clientId, onSelectLoan }: Props) {
  const [client,  setClient]  = useState<Client | null>(null)
  const [loans,   setLoans]   = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ principal: '', rate: '1.5', periodVal: '', periodUnit: 'days' as 'days'|'months'|'years' })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [allClients, allLoans] = await Promise.all([
      getClients(tenantId),
      getLoans(tenantId, clientId),
    ])
    setClient(allClients.find(c => c.id === clientId) || null)
    setLoans(allLoans)
    setLoading(false)
  }, [tenantId, clientId])

  useEffect(() => { load() }, [load])

  // Stats
  const stats = loans.reduce((acc, loan) => {
    const snap = loanSnapshot(loan, [])
    acc.totalBorrowed += loan.principal
    acc.totalDue      += snap.totalDue
    if (!snap.isClosed) acc.active++
    return acc
  }, { totalBorrowed: 0, totalDue: 0, active: 0 })

  async function handleAddLoan() {
    const p = parseFloat(form.principal)
    const n = parseFloat(form.periodVal)
    if (!p || p <= 0) { setErr('Enter a valid principal amount'); return }
    if (!n || n <= 0) { setErr('Enter a valid period'); return }
    setSaving(true); setErr('')
    try {
      const days = toDays(n, form.periodUnit)
      await addLoan(tenantId, clientId, p, parseFloat(form.rate)||1.5, days)
      setShowAdd(false)
      setForm({ principal:'', rate:'1.5', periodVal:'', periodUnit:'days' })
      await load()
    } catch { setErr('Failed to add loan. Try again.') }
    setSaving(false)
  }

  const previewDays = toDays(parseFloat(form.periodVal)||0, form.periodUnit)
  const previewSI   = calcSI(parseFloat(form.principal)||0, parseFloat(form.rate)||0, previewDays)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full spinner" />
    </div>
  )

  return (
    <div className="max-w-lg mx-auto p-4">
      {/* Client info */}
      {client && (
        <div className="bg-white rounded-lg elev-1 overflow-hidden mb-3">
          <div className="bg-gray-800 text-white p-4 flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-primary-600 flex items-center justify-center font-bold text-base">
              {client.name.split(' ').slice(0,2).map((w:string)=>w[0]).join('').toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-base">{client.name}</div>
              <div className="text-gray-400 text-sm">📞 {client.phone}</div>
            </div>
          </div>
          <div className="grid grid-cols-2">
            {[
              { label: 'Total Borrowed', value: fmtINR(stats.totalBorrowed), cls: 'text-primary-600' },
              { label: 'Total Pending',  value: fmtINR(Math.max(0, stats.totalDue)), cls: 'text-red-700' },
              { label: 'Active Loans',   value: String(stats.active), cls: 'text-gray-800' },
              { label: 'Total Loans',    value: String(loans.length), cls: 'text-gray-800' },
            ].map((s, i) => (
              <div key={s.label} className={`p-4 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b' : ''} border-gray-100`}>
                <div className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</div>
                <div className={`font-mono font-semibold text-lg mt-1 ${s.cls}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loans */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">Loans</div>
      <div className="bg-white rounded-lg elev-1 overflow-hidden mb-3">
        {loans.length === 0 ? (
          <div className="text-center p-8 text-gray-400 text-sm">No loans yet</div>
        ) : (
          loans.map((loan, i) => {
            const snap = loanSnapshot(loan, [])
            const chipCls = snap.isClosed ? 'bg-gray-100 text-gray-400' : snap.isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-50 text-primary-600'
            const chipLabel = snap.isClosed ? 'Closed' : snap.isOverdue ? 'Overdue' : 'Active'
            return (
              <button key={loan.id} onClick={() => onSelectLoan(loan.id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors text-left">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${chipCls}`}>L-{String(loans.length - i).padStart(2,'0')}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold text-sm text-gray-800">{fmtINR(loan.principal)}</div>
                  <div className="text-xs text-gray-400">{fmtDate(loan.date)} · {loan.rate}% · {loan.days}d</div>
                </div>
                <div className="text-right">
                  {snap.isClosed
                    ? <span className="text-xs text-green-600 font-medium">Paid ✓</span>
                    : <span className="text-sm font-mono font-semibold text-red-700">{fmtINR(snap.pending)}</span>
                  }
                  <div className="text-xs text-gray-400">pending</div>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BDBDBD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            )
          })
        )}
      </div>

      {/* Add loan */}
      {!showAdd ? (
        <button onClick={() => setShowAdd(true)}
          className="w-full py-3 rounded-lg bg-primary-600 text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors">
          <Plus size={18}/> New Loan
        </button>
      ) : (
        <div className="bg-white rounded-lg elev-1 p-5">
          <div className="font-semibold text-gray-800 mb-4">New Loan</div>
          {[
            { label: 'Principal Amount (₹)', key: 'principal', type: 'number', placeholder: 'e.g. 10000' },
            { label: 'Annual Rate (%)',       key: 'rate',      type: 'number', placeholder: '1.5' },
          ].map(f => (
            <div key={f.key} className="mb-4">
              <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">{f.label}</label>
              <input type={f.type} value={form[f.key as keyof typeof form]} placeholder={f.placeholder}
                onChange={e => setForm(prev => ({...prev, [f.key]: e.target.value}))}
                className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-2 text-sm text-gray-800 bg-transparent" />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Period</label>
              <input type="number" value={form.periodVal} placeholder="e.g. 3"
                onChange={e => setForm(prev => ({...prev, periodVal: e.target.value}))}
                className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-2 text-sm text-gray-800 bg-transparent" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">Unit</label>
              <select value={form.periodUnit} onChange={e => setForm(prev => ({...prev, periodUnit: e.target.value as 'days'|'months'|'years'}))}
                className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-2 text-sm text-gray-800 bg-transparent">
                <option value="days">Days</option>
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>

          {form.principal && form.periodVal && (
            <div className="bg-blue-50 rounded-lg p-3 mb-4 flex justify-between items-center">
              <div><div className="text-xs text-gray-400">Interest</div><div className="font-mono font-semibold text-primary-600">{fmtINR(previewSI)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Total Repayable</div><div className="font-mono font-semibold text-gray-800">{fmtINR((parseFloat(form.principal)||0)+previewSI)}</div></div>
              <div className="text-right"><div className="text-xs text-gray-400">Days</div><div className="font-semibold text-gray-600">{previewDays}</div></div>
            </div>
          )}

          {err && <p className="text-red-600 text-xs mb-3">{err}</p>}
          <div className="flex gap-3">
            <button onClick={() => { setShowAdd(false); setErr('') }}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleAddLoan} disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-50">
              {saving ? 'Saving…' : 'Confirm Loan'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
