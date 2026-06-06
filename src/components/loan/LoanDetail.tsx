'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertTriangle, Share2, Printer } from 'lucide-react'
import { getLoans, getClients, getPayments, addPayment, Loan, Payment, Client } from '@/lib/firestore'
import { loanSnapshot, fmtINR, fmtDate, LoanSnapshot } from '@/lib/finance'

interface Props {
  tenantId: string
  loanId: string
  clientId: string
  isPaid?: boolean
}

export default function LoanDetail({ tenantId, loanId, clientId, isPaid = false }: Props) {
  const [loan,     setLoan]     = useState<Loan | null>(null)
  const [client,   setClient]   = useState<Client | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [snap,     setSnap]     = useState<LoanSnapshot | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [payAmt,   setPayAmt]   = useState('')
  const [payMode,  setPayMode]  = useState('Cash')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')
  const printRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [allLoans, allClients, pays] = await Promise.all([
      getLoans(tenantId, clientId),
      getClients(tenantId),
      getPayments(tenantId, loanId),
    ])
    const l = allLoans.find(x => x.id === loanId) || null
    const c = allClients.find(x => x.id === clientId) || null
    setLoan(l); setClient(c); setPayments(pays)
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

  // Share via WhatsApp (paid feature)
  function handleShare() {
    if (!loan || !snap || !client) return
    const text = [
      `📋 *Loan Summary — ${client.name}*`,
      `📞 ${client.phone}`,
      ``,
      `💰 Principal: ${fmtINR(loan.principal)}`,
      `📈 Interest (SI): ${fmtINR(snap.originalSI)}`,
      snap.overdueSI > 0 ? `⚠ Overdue Interest: ${fmtINR(snap.overdueSI)}` : '',
      `🧾 Total Due: ${fmtINR(snap.totalDue)}`,
      `✅ Total Paid: ${fmtINR(snap.totalPaid)}`,
      `🔴 Pending: ${fmtINR(snap.pending)}`,
      ``,
      `📅 Loan Date: ${fmtDate(loan.date)}`,
      `📅 Due Date: ${fmtDate(snap.dueDate)}`,
      snap.isOverdue ? `⚠ Overdue by ${snap.overdueDays} days` : `⏳ ${loan.days - snap.elapsed} days remaining`,
    ].filter(Boolean).join('\n')

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  // Print loan summary (paid feature)
  function handlePrint() {
    if (!loan || !snap || !client) return
    const printContent = `
      <html><head><title>Loan Summary</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; color: #212121; }
        h1 { color: #1565C0; margin-bottom: 4px; }
        .sub { color: #757575; margin-bottom: 24px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        td { padding: 10px 12px; border-bottom: 1px solid #E0E0E0; }
        td:first-child { color: #757575; }
        td:last-child { font-weight: 600; text-align: right; font-family: monospace; }
        .total td { background: #E3F2FD; font-weight: 700; font-size: 1.1em; }
        .overdue td { background: #FFEBEE; color: #C62828; }
        h2 { margin-top: 24px; margin-bottom: 8px; color: #424242; font-size: 14px; }
        .pay-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
        .footer { margin-top: 32px; color: #9E9E9E; font-size: 12px; text-align: center; }
      </style></head><body>
      <h1>${client.name}</h1>
      <div class="sub">📞 ${client.phone} &nbsp;·&nbsp; Loan Date: ${fmtDate(loan.date)}</div>
      <table>
        <tr><td>Principal</td><td>${fmtINR(loan.principal)}</td></tr>
        <tr><td>Annual Rate</td><td>${loan.rate}% p.a.</td></tr>
        <tr><td>Loan Period</td><td>${loan.days} days</td></tr>
        <tr><td>Due Date</td><td>${fmtDate(snap.dueDate)}</td></tr>
        <tr><td>Original Interest (SI)</td><td>${fmtINR(snap.originalSI)}</td></tr>
        ${snap.overdueSI > 0 ? `<tr class="overdue"><td>Overdue Interest (${snap.overdueDays} days)</td><td>${fmtINR(snap.overdueSI)}</td></tr>` : ''}
        <tr class="total"><td>Total Due</td><td>${fmtINR(snap.totalDue)}</td></tr>
        <tr><td>Total Paid</td><td>${fmtINR(snap.totalPaid)}</td></tr>
        <tr><td>Pending</td><td>${fmtINR(snap.pending)}</td></tr>
      </table>
      <h2>Payment History</h2>
      ${payments.length === 0 ? '<p style="color:#9E9E9E">No payments recorded</p>' :
        payments.map(p => `<div class="pay-row"><span>${fmtDate(p.date)} — ${p.mode}</span><span>${fmtINR(p.amount)}</span></div>`).join('')
      }
      <div class="footer">Generated by LoanPro · ${new Date().toLocaleDateString('en-IN')}</div>
      </body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(printContent); w.document.close(); w.print() }
  }

  if (loading || !loan || !snap) return (
    <div className="flex items-center justify-center h-full min-h-64">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-600 rounded-full spinner"/>
    </div>
  )

  const chipCls   = snap.isClosed ? 'bg-gray-100 text-gray-500' : snap.isOverdue ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
  const chipLabel = snap.isClosed ? 'Closed' : snap.isOverdue ? 'Overdue' : 'Active'
  const amtBarCls = snap.amountPaidPct >= 75 ? 'bg-green-500' : snap.amountPaidPct >= 40 ? 'bg-amber-500' : 'bg-blue-600'
  const dayBarCls = snap.isOverdue ? 'bg-red-500' : snap.daysPct >= 70 ? 'bg-amber-500' : 'bg-green-500'

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3 pb-10" ref={printRef}>

      {/* Overdue banner */}
      {snap.isOverdue && (
        <div className="bg-red-50 border-l-4 border-red-600 rounded-r-lg p-4 flex gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
          <div>
            <div className="font-semibold text-red-700">Overdue by {snap.overdueDays} day{snap.overdueDays > 1 ? 's' : ''}</div>
            <div className="text-red-600 text-sm mt-0.5">
              Extra interest: {fmtINR(snap.overdueSI)} on outstanding {fmtINR(snap.outstandingPrincipal)}
            </div>
          </div>
        </div>
      )}

      {/* Share / Print (paid feature) */}
      {isPaid && (
        <div className="flex gap-2">
          <button onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors">
            <Share2 size={16}/> Share via WhatsApp
          </button>
          <button onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors">
            <Printer size={16}/> Print Summary
          </button>
        </div>
      )}

      {/* Financials — READ ONLY */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="text-sm font-semibold text-gray-700">Loan Detail</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${chipCls}`}>{chipLabel}</span>
          <span className="flex-1"/>
          <span className="text-xs text-gray-400">{fmtDate(loan.date)}</span>
        </div>
        {[
          { label: 'Principal',             value: fmtINR(loan.principal),  cls: '' },
          { label: 'Original Interest (SI)', value: fmtINR(snap.originalSI), cls: '' },
          ...(snap.overdueSI > 0 ? [{ label: `Overdue Interest (${snap.overdueDays}d)`, value: fmtINR(snap.overdueSI), cls: 'text-amber-600' }] : []),
          { label: 'Rate · Period',         value: `${loan.rate}% p.a. · ${loan.days} days`, cls: 'text-sm' },
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
      <div className="bg-white rounded-lg shadow-sm p-4 space-y-4">
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-400">Amount Repaid</span>
            <span className="text-xs font-mono font-semibold text-blue-600">{snap.amountPaidPct}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${amtBarCls}`} style={{width:`${snap.amountPaidPct}%`}}/>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{fmtINR(snap.totalPaid)} paid</span>
            <span className="text-xs text-gray-400">{fmtINR(snap.pending)} pending</span>
          </div>
        </div>
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-gray-400">Days Elapsed</span>
            <span className="text-xs font-mono font-semibold text-blue-600">{snap.daysPct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${dayBarCls}`} style={{width:`${Math.min(100,snap.daysPct)}%`}}/>
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-gray-400">{snap.elapsed} days elapsed</span>
            <span className="text-xs text-gray-400">{loan.days} days term</span>
          </div>
        </div>
        <div className={`text-xs text-right font-medium ${snap.isClosed ? 'text-green-600' : snap.isOverdue ? 'text-red-600' : 'text-gray-400'}`}>
          {snap.isClosed
            ? '✓ Fully repaid'
            : snap.isOverdue
              ? `⚠ Overdue by ${snap.overdueDays} days · Due ${fmtDate(snap.dueDate)}`
              : `${loan.days - snap.elapsed} days remaining · Due ${fmtDate(snap.dueDate)}`}
        </div>
      </div>

      {/* Payment history */}
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Payment History</div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {payments.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No payments yet</div>
        ) : (
          [...payments].sort((a,b) => a.date < b.date ? 1 : -1).map(p => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0"/>
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
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="text-sm font-semibold text-gray-700 mb-3">Record Payment</div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gray-400 font-semibold">₹</span>
            <input type="number" value={payAmt} onChange={e => setPayAmt(e.target.value)}
              placeholder="Amount" min="1"
              className="flex-1 border-b border-gray-300 focus:border-blue-600 outline-none py-1.5 text-sm text-gray-800 bg-transparent"/>
          </div>
          <select value={payMode} onChange={e => setPayMode(e.target.value)}
            className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-1.5 text-sm text-gray-700 bg-transparent mb-4">
            {['Cash','UPI','Bank Transfer','Cheque','Other'].map(m => <option key={m}>{m}</option>)}
          </select>
          {err && <p className="text-red-600 text-xs mb-3">{err}</p>}
          <button onClick={handlePayment} disabled={saving}
            className="w-full py-2.5 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      )}

      {/* Upgrade prompt for share/print on free plan */}
      {!isPaid && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 text-center">
          <div className="text-sm font-semibold text-gray-700 mb-1">📲 Share & Print</div>
          <p className="text-xs text-gray-500 mb-3">Share loan summaries via WhatsApp or print them — available in Pro plan.</p>
          <a href={`upi://pay?pa=yourname@upi&pn=LoanPro&am=5000&cu=INR`}
            className="inline-block bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
            Upgrade to Pro — ₹5,000/year
          </a>
        </div>
      )}
    </div>
  )
}