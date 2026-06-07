'use client'
import { useState, useEffect } from 'react'
import { getDashboardData } from '@/lib/firestore'
import { loanSnapshot, fmtINR } from '@/lib/finance'

export default function Dashboard({ tenantId }: { tenantId: string }) {
  const [data, setData]     = useState<{totalClients:number;totalDisbursed:number;totalPending:number;totalPaid:number;overdueCount:number;topBorrowers:{name:string;pending:number}[]} | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDashboardData(tenantId).then(raw => {
      const { clients, loans, payments } = raw as {
        clients: {id:string;name:string}[];
        loans: {id:string;clientId:string;principal:number;rate:number;months:number;date:string;closed:boolean}[];
        payments: {id:string;loanId:string;amount:number;date:string;mode:string}[]
      }

      let totalDisbursed = 0, totalPending = 0, totalPaid = 0, overdueCount = 0
      const pendingByClient: Record<string, number> = {}

      for (const loan of loans) {
        const loanPayments = payments.filter(p => p.loanId === loan.id)
        const snap = loanSnapshot(loan, loanPayments)
        totalDisbursed += loan.principal
        totalPending   += snap.pending
        totalPaid      += snap.totalPaid
        if (snap.isOverdue) overdueCount++
        if (!snap.isClosed) {
          pendingByClient[loan.clientId] = (pendingByClient[loan.clientId] || 0) + snap.pending
        }
      }

      const topBorrowers = Object.entries(pendingByClient)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cid, pending]) => ({
          name: clients.find(c => c.id === cid)?.name || 'Unknown',
          pending
        }))

      setData({ totalClients: clients.length, totalDisbursed, totalPending, totalPaid, overdueCount, topBorrowers })
      setLoading(false)
    })
  }, [tenantId])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="w-6 h-6 border-2 border-gray-200 border-t-primary-600 rounded-full spinner" />
    </div>
  )
  if (!data) return null

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Overview</div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Clients',    value: String(data.totalClients),          cls: 'text-primary-600' },
          { label: 'Overdue Loans',    value: String(data.overdueCount),           cls: data.overdueCount > 0 ? 'text-red-600' : 'text-green-600' },
          { label: 'Total Disbursed',  value: fmtINR(data.totalDisbursed),         cls: 'text-primary-600' },
          { label: 'Total Pending',    value: fmtINR(data.totalPending),           cls: 'text-red-600' },
          { label: 'Total Collected',  value: fmtINR(data.totalPaid),              cls: 'text-green-600' },
          { label: 'Recovery Rate',
            value: data.totalDisbursed > 0 ? Math.round(data.totalPaid/data.totalDisbursed*100)+'%' : '0%',
            cls: 'text-gray-800' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg elev-1 p-4">
            <div className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</div>
            <div className={`font-mono font-bold text-xl mt-1 ${s.cls}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Top borrowers */}
      {data.topBorrowers.length > 0 && (
        <>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">Top Pending Borrowers</div>
          <div className="bg-white rounded-lg elev-1 overflow-hidden">
            {data.topBorrowers.map((b, i) => (
              <div key={b.name} className="flex items-center gap-4 px-4 py-3 border-b border-gray-100 last:border-0">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-semibold">
                  {i+1}
                </span>
                <span className="flex-1 text-sm font-medium text-gray-800">{b.name}</span>
                <span className="font-mono font-semibold text-sm text-red-600">{fmtINR(b.pending)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}