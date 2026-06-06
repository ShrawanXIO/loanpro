'use client'
import { useState, useRef } from 'react'
import { updateTenant, Tenant } from '@/lib/firestore'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Upload, Check } from 'lucide-react'

export default function SettingsPanel({ tenant }: { tenant: Tenant }) {
  const [bizName,    setBizName]    = useState(tenant.businessName)
  const [upiId,      setUpiId]      = useState(tenant.upiId || '')
  const [rate,       setRate]       = useState(String((tenant as unknown as Record<string,unknown>).defaultRate || '1.5'))
  const [logoUrl,    setLogoUrl]    = useState(tenant.logoUrl || '')
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSave() {
    setSaving(true)
    await updateTenant(tenant.id, {
      businessName: bizName.trim(),
      upiId: upiId.trim(),
      // store defaultRate on the tenant doc
      ...({ defaultRate: parseFloat(rate) || 1.5 } as unknown as Partial<Tenant>)
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return }
    setUploading(true)
    const storageRef = ref(storage, `logos/${tenant.id}/${file.name}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateTenant(tenant.id, { logoUrl: url })
    setLogoUrl(url)
    setUploading(false)
  }

  const isPaid = tenant.tier === 'paid'

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3">

      {/* Tier badge */}
      <div className={`rounded-lg p-4 ${isPaid ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-100'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-gray-800">{isPaid ? '⭐ Pro Plan' : 'Free Plan'}</div>
            <div className="text-sm text-gray-500 mt-0.5">
              {isPaid ? 'Up to 100 clients · Dashboard access' : `${tenant.clientCount}/10 clients used`}
            </div>
          </div>
          {!isPaid && (
            <a href="upi://pay?pa=YOUR_UPI_ID&pn=LoanPro&am=5000&cu=INR&tn=LoanPro+Pro"
              className="bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Upgrade ₹5k
            </a>
          )}
        </div>
        {!isPaid && (
          <p className="text-xs text-gray-400 mt-2">After UPI payment, WhatsApp your transaction ID to activate Pro.</p>
        )}
      </div>

      {/* Settings form */}
      <div className="bg-white rounded-lg p-5" style={{boxShadow:'0 1px 3px rgba(0,0,0,.1)'}}>
        <div className="text-sm font-semibold text-gray-700 mb-4">Your Branding</div>

        {/* Logo */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Business Logo</label>
          <div className="flex items-center gap-4">
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-14 h-14 rounded-lg object-contain border border-gray-100"/>
              : <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No Logo</div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 disabled:opacity-50">
              <Upload size={15}/>{uploading ? 'Uploading…' : 'Upload PNG'}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogo}/>
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG or WebP · max 2MB</p>
        </div>

        {/* Business name */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Business Name</label>
          <input value={bizName} onChange={e => setBizName(e.target.value)}
            className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-2 text-sm text-gray-800 bg-transparent"/>
        </div>

        {/* ── DEFAULT INTEREST RATE ── */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Default Annual Interest Rate (%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" step="0.1" min="0.1" max="100"
              value={rate} onChange={e => setRate(e.target.value)}
              className="w-28 border-b border-gray-300 focus:border-blue-600 outline-none py-2 text-sm text-gray-800 bg-transparent font-mono"
            />
            <span className="text-sm text-gray-400">% per annum</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Pre-filled when creating a new loan. Can be changed per loan.</p>
        </div>

        {/* UPI ID */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Your UPI ID</label>
          <input value={upiId} onChange={e => setUpiId(e.target.value)} placeholder="e.g. yourname@upi"
            className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-2 text-sm text-gray-800 bg-transparent"/>
          <p className="text-xs text-gray-400 mt-1">Used for Pro upgrade payment button</p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          {saved ? <><Check size={16}/>Saved</> : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}