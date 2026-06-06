'use client'
import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle } from 'lucide-react'
import { getLoans, getPayments, addPayment, Loan, Payment } from '@/lib/firestore'
import { loanSnapshot, fmtINR, fmtDate, LoanSnapshot } from '@/lib/finance'

interface Props { tenantId: string; loanId: string; clientId: string }

export default function LoanDetail({ tenantId, loanId, clientId }: Props) {
  const [loan,     setLoan]     = useState<Loan | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [snap,     setSnap]     = useState<LoanSnapshot | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [payAmt,   setPayAmt]   = useState('')
  const [payMode,  setPayMode]  = useState('Cash')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [allLoans, pays] = await Promise.all([
      getLoans(tenantId, clientId),
      getPayments(tenantId, loanId),
    ])
    const l = allLoans.find(x => x.id === loanId) || null
    setLoan(l)
    setPayments(pays)
    if (l) setSnap(loanSnapshot(l, pays))
    setLoading(false)
  }, [tenantId, loanId, clientId])

  useEffect(() => { load() }, [load])

  async function handlePayment() {
    const amt = parseFloat(payAmt)
    if (!amt || amt <= 0) { setErr('Enter a valid amount'); return }
    setSaving(true); setErr('')
    try {
      await addPayment(tenantId, loanId, amt, payMode)
      setPayAmt('')
      await load()
    } catch { setErr('Failed to record payment. Try again.') }
    setSaving(false)
  }

  if (loading || !loan || !snap) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full spinner" />
    </div>
  )

  const chipCls   = snap.isClosed ? 'bg-gray-100 text-gray-500' : snap.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  const chipLabel = snap.isClosed ? 'Closed' : snap.isOverdue ? 'Overdue' : 'Active'
  const amtBarCls = snap.amountPaidPct >= 75 ? 'bg-green-500' : snap.amountPaidPct >= 40 ? 'bg-amber-500' : 'bg-primary-600'
  const dayBarCls = snap.isOverdue ? 'bg-red-500' : snap.daysPct >= 70 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">

      {/* Overdue banner */}
      {snap.isOverdue && (
        <div className="bg-red-50 border-l-4 border-red-600 rounded-r-lg p-4 flex gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-red-700">Overdue by {snap.overdueDays} day{snap.overdueDays > 1 ? 's' : ''}</div>
            <div className="text-red-600 text-sm mt-0.5">
              Extra interest: {fmtINR(snap.overdueSI)} on outstanding {fmtINR(snap.outstandingPrincipal)}
            </div>
          </div>
        </div>
      )}

      {/* Financials — READ ONLY */}
      <div className="bg-white rounded-lg elev-1 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Loan</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${chipCls}`}>{chipLabel}</span>
          <span className="flex-1" />
          <span className="text-xs text-gray-400">{fmtDate(loan.date)}</span>
        </div>

        {[
          { label: 'Principal',            value: fmtINR(loan.principal), cls: '' },
          { label: 'Original Interest (SI)', value: fmtINR(snap.originalSI), cls: '' },
          ...(snap.overdueSI > 0 ? [{ label: 'Overdue Interest', value: fmtINR(snap.overdueSI), cls: 'text-amber-600' }] : []),
          { label: 'Rate · Period',        value: `${loan.rate}% p.a. · ${loan.days} days`, cls: 'text-sm' },
        ].map(row => (
          <div key={row.label} className="flex justify-between items-center px-4 py-3 border-b border-gray-100">
            <span className="text-sm text-gray-500">{row.label}</span>
            <span className={`font-mono font-semibold text-sm text-gray-800 ${row.cls}`}>{row.value}</span>
          </div>
        ))}

        <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-blue-50">
          <span className="text-sm font-semibold text-gray-700">Total Due</span>
          <span className="font-mono font-bold text-lg text-red-700">{fmtINR(snap.totalDue)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-gray-500">Total Paid</span>
          <span className="font-mono font-semibold text-green-600">{fmtINR(snap.totalPaid)}</span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-white rounded-lg elev-1 p-4 space-y-4">
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-400">Amount Repaid</span>
            <span className="text-xs font-mono font-semibold text-primary-600">{snap.amountPaidPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${amtBarCls}`} style={{width:`${snap.amountPaidPct}%`}} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{fmtINR(snap.totalPaid)} paid</span>
            <span className="text-xs text-gray-400">{fmtINR(snap.pending)} pending</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-400">Days Elapsed</span>
            <span className="text-xs font-mono font-semibold text-primary-600">{snap.daysPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dayBarCls}`} style={{width:`${Math.min(100,snap.daysPct)}%`}} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{snap.elapsed} days elapsed</span>
            <span className="text-xs text-gray-400">{loan.days} days term</span>
          </div>
        </div>
        <div className={`text-xs text-right font-medium ${snap.isClosed ? 'text-green-600' : snap.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
          {snap.isClosed ? '✓ Fully repaid'
            : snap.isOverdue ? `⚠ Overdue by ${snap.overdueDays} days · Due ${fmtDate(snap.dueDate)}`
            : `${loan.days - snap.elapsed} days remaining · Due ${fmtDate(snap.dueDate)}`}
        </div>
      </div>

      {/* Payment history */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Payment History</div>
      <div className="bg-white rounded-lg elev-1 overflow-hidden">
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No payments yet</div>
        ) : (
          [...payments].sort((a,b)=>a.date<b.date?1:-1).map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm text-gray-700">{p.mode}</div>
                <div className="text-xs text-gray-400">{fmtDate(p.date)}</div>
              </div>
              <span className="font-mono font-semibold text-sm text-green-600">+{fmtINR(p.amount)}</span>
            </div>
          ))
        )}
      </div>

      {/* Record payment */}
      {!snap.isClosed && (
        <div className="bg-white rounded-lg elev-1 p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Record Payment</div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400 font-semibold">₹</span>
            <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
              placeholder="Amount" min="1"
              className="flex-1 border-b border-gray-300 focus:border-primary-600 outline-none py-1.5 text-sm text-gray-800 bg-transparent" />
          </div>
          <select value={payMode} onChange={e => setPayMode(e.target.value)}
            className="w-full border-b border-gray-300 focus:border-primary-600 outline-none py-1.5 text-sm text-gray-700 bg-transparent mb-4">
            {['Cash','UPI','Bank Transfer','Cheque','Other'].map(m => <option key={m}>{m}</option>)}
          </select>
          {err && <p className="text-red-600 text-xs mb-3">{err}</p>}
          <button onClick={handlePayment} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      )}
    </div>
  )
}
