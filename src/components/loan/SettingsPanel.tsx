'use client'
import { useState, useRef } from 'react'
import { updateTenant, Tenant, isProActive, isNearExpiry, isExpired, daysUntilExpiry } from '@/lib/firestore'
import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Upload, Check, Mail, Phone, AlertTriangle } from 'lucide-react'
import config from '@/lib/config'

export default function SettingsPanel({ tenant }: { tenant: Tenant }) {
  const [bizName,   setBizName]   = useState(tenant.businessName)
  const [rate,      setRate]      = useState(String(tenant.defaultRate || 1.5))
  const [logoUrl,   setLogoUrl]   = useState(tenant.logoUrl || '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const proActive  = isProActive(tenant)
  const nearExpiry = isNearExpiry(tenant)
  const expired    = isExpired(tenant)
  const daysLeft   = daysUntilExpiry(tenant)
  const price      = config.currentPriceINR
  const priceStr   = `₹${price.toLocaleString('en-IN')}`

  const upgradeUPI = `upi://pay?pa=${encodeURIComponent(config.ownerUpi)}&pn=${encodeURIComponent(config.appName)}&am=${price}&cu=INR&tn=${encodeURIComponent(config.appName + ' Pro - ' + tenant.businessName)}`
  const upgradeWA  = `https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent(`Hi, I want to upgrade/renew ${config.appName} Pro.\nBusiness: ${tenant.businessName}`)}`

  async function handleSave() {
    setSaving(true)
    await updateTenant(tenant.id, {
      businessName: bizName.trim(),
      defaultRate:  parseFloat(rate) || 1.5,
    } as Partial<Tenant>)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { alert('Logo must be under 2MB'); return }
    setUploading(true)
    const sRef = ref(storage, `logos/${tenant.id}/${file.name}`)
    await uploadBytes(sRef, file)
    const url = await getDownloadURL(sRef)
    await updateTenant(tenant.id, { logoUrl: url })
    setLogoUrl(url); setUploading(false)
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-3 pb-10">

      {/* ── PLAN STATUS ── */}
      {proActive && !nearExpiry && !expired ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="font-bold text-yellow-900">⭐ Pro Plan Active</div>
            <div className="text-yellow-700 text-sm mt-0.5">
              {tenant.clientLimit} clients · Dashboard · Share &amp; Print
            </div>
            {tenant.proExpiresAt && (
              <div className="text-yellow-600 text-xs mt-1">
                Valid until{' '}
                {new Date(tenant.proExpiresAt).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </div>
            )}
          </div>
          <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full">PRO</span>
        </div>

      ) : nearExpiry ? (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle size={20} className="text-amber-600 flex-shrink-0 mt-0.5"/>
            <div>
              <div className="font-bold text-amber-900">
                Pro renews in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
              </div>
              <div className="text-amber-700 text-sm mt-0.5">
                Renew before{' '}
                {new Date(tenant.proExpiresAt!).toLocaleDateString('en-IN', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}{' '}
                to keep all Pro features.
              </div>
            </div>
          </div>
          <UpgradeButtons upgradeUPI={upgradeUPI} upgradeWA={upgradeWA} priceStr={priceStr} label="Renew"/>
        </div>

      ) : expired ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="font-bold text-red-800 mb-1">⚠ Pro Plan Expired</div>
          <div className="text-red-600 text-sm mb-4">
            Your Pro licence has expired. Renew to restore all features.
          </div>
          <UpgradeCard upgradeUPI={upgradeUPI} upgradeWA={upgradeWA} priceStr={priceStr} tenant={tenant}/>
        </div>

      ) : (
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-lg">Free Plan</div>
              <div className="text-blue-100 text-sm">{tenant.clientCount}/{tenant.clientLimit} clients used</div>
            </div>
            <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">FREE</span>
          </div>
          <UpgradeCard upgradeUPI={upgradeUPI} upgradeWA={upgradeWA} priceStr={priceStr} tenant={tenant}/>
        </div>
      )}

      {/* ── BRANDING & SETTINGS ── */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="text-sm font-bold text-gray-700 mb-4">Branding &amp; Settings</div>

        {/* Logo */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            Business Logo
          </label>
          <div className="flex items-center gap-4">
            {logoUrl
              ? <img src={logoUrl} alt="logo" className="w-14 h-14 rounded-lg object-contain border border-gray-100"/>
              : <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                  No Logo
                </div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-2 text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 disabled:opacity-50">
              <Upload size={15}/>{uploading ? 'Uploading…' : 'Upload PNG'}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
              className="hidden" onChange={handleLogo}/>
          </div>
          <p className="text-xs text-gray-400 mt-1">PNG, JPG or WebP · max 2MB · shown in your app header</p>
        </div>

        {/* Business name */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Business Name
          </label>
          <input value={bizName} onChange={e => setBizName(e.target.value)}
            className="w-full border-b border-gray-300 focus:border-blue-600 outline-none py-2 text-sm text-gray-800 bg-transparent"/>
          <p className="text-xs text-gray-400 mt-1">Displayed at the top of your app</p>
        </div>

        {/* Default interest rate */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">
            Default Annual Interest Rate
          </label>
          <div className="flex items-center gap-2">
            <input type="number" step="0.1" min="0.1" max="100"
              value={rate} onChange={e => setRate(e.target.value)}
              className="w-24 border-b border-gray-300 focus:border-blue-600 outline-none py-2 text-sm text-gray-800 bg-transparent font-mono"/>
            <span className="text-sm text-gray-400">% per annum</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Pre-filled when creating a new loan. Can be changed per loan.
          </p>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
          {saved ? <><Check size={16}/>Saved</> : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {/* ── CONTACT & SUPPORT ── */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <div className="text-sm font-bold text-gray-700 mb-3">Contact &amp; Support</div>
        <div className="space-y-3">
          <a href={`https://wa.me/${config.ownerWhatsApp}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors">
            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-white flex-shrink-0">
              <Phone size={16}/>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">WhatsApp Support</div>
              <div className="text-xs text-gray-500">Chat with us for help or to upgrade</div>
            </div>
          </a>
          <a href={`mailto:${config.ownerEmail}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
              <Mail size={16}/>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-800">Email Support</div>
              <div className="text-xs text-gray-500">{config.ownerEmail}</div>
            </div>
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">
          {config.appName} v1.0 · Built for Indian lenders
        </p>
      </div>

    </div>
  )
}

function UpgradeButtons({ upgradeUPI, upgradeWA, priceStr, label = 'Upgrade' }: {
  upgradeUPI: string; upgradeWA: string; priceStr: string; label?: string
}) {
  return (
    <div className="space-y-2">
      <a href={upgradeUPI}
        className="block w-full text-center bg-white text-blue-700 font-bold py-2.5 rounded-lg hover:bg-blue-50 transition-colors">
        {label} {priceStr} via UPI
      </a>
      <div className="bg-white/10 rounded-lg px-3 py-2 text-center text-sm">
        <span className="text-blue-200 text-xs">UPI ID: </span>
        <span className="font-mono font-semibold text-white">{config.ownerUpi}</span>
      </div>
      <a href={upgradeWA} target="_blank" rel="noreferrer"
        className="block w-full text-center bg-green-500 text-white font-semibold py-2.5 rounded-lg hover:bg-green-600 transition-colors text-sm">
        📲 WhatsApp us after payment
      </a>
      <p className="text-blue-200 text-xs text-center">We activate Pro within 2 hours of payment.</p>
    </div>
  )
}

function UpgradeCard({ upgradeUPI, upgradeWA, priceStr, tenant }: {
  upgradeUPI: string; upgradeWA: string; priceStr: string; tenant: Tenant
}) {
  return (
    <>
      <div className="bg-white/10 rounded-lg p-3 mb-3 text-sm">
        <div className="font-semibold mb-2">Pro — {priceStr}/year includes:</div>
        <ul className="space-y-1 text-blue-100">
          {[
            `${config.paidTierLimit} clients (vs ${tenant.clientLimit} now)`,
            'Analytics dashboard',
            'Top borrowers report',
            'Share & print loan summaries',
          ].map(f => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-green-300">✓</span>{f}
            </li>
          ))}
        </ul>
      </div>
      <UpgradeButtons upgradeUPI={upgradeUPI} upgradeWA={upgradeWA} priceStr={priceStr}/>
    </>
  )
}