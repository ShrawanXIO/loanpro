// src/app/page.tsx — Landing page
import Link from 'next/link'
import { Logo } from '@/lib/logo'
import config from '@/lib/config'

export default function Home() {
  const price    = config.currentPriceINR
  const priceStr = `₹${price.toLocaleString('en-IN')}`

  return (
    <main className="min-h-screen bg-white">

      {/* Hero */}
      <div className="bg-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="flex justify-center mb-6">
            <Logo size={72} />
          </div>
          <h1 className="text-4xl font-bold mb-4">LoanPro</h1>
          <p className="text-xl text-blue-100 mb-8 max-w-xl mx-auto">
            Track loans, collect payments, grow your lending business — from your phone.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/login"
              className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg hover:bg-blue-50 transition-colors">
              Get Started Free
            </Link>
            <Link href="/login"
              className="border border-white text-white font-semibold px-8 py-3 rounded-lg hover:bg-white/10 transition-colors">
              Sign In
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold text-center mb-12 text-gray-800">Everything you need</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '👥', title: 'Client Management',  desc: 'Add clients, search by name or phone, sorted alphabetically.' },
            { icon: '📊', title: 'Loan Tracking',      desc: 'Track principal, interest, overdue — with live progress bars.' },
            { icon: '💸', title: 'Payment History',    desc: 'Record every payment. See exactly what is paid and pending.' },
            { icon: '🏷️', title: 'Your Brand',         desc: 'Your business name, your logo. Looks like your own app.' },
            { icon: '📱', title: 'Works on Mobile',    desc: 'Install as an app — no Play Store needed. Pure PWA.' },
            { icon: '☁️', title: 'Always in Sync',     desc: 'Data lives in the cloud. Access from any device.' },
          ].map(f => (
            <div key={f.title} className="text-center p-6">
              <div className="text-4xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Pricing */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-center mb-12 text-gray-800">Simple Pricing</h2>
          <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-white rounded-xl p-8 shadow-sm">
              <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-2">Free Forever</div>
              <div className="text-3xl font-bold mb-1">₹0</div>
              <div className="text-gray-400 text-sm mb-6">No credit card needed</div>
              <ul className="space-y-3 text-sm text-gray-600 mb-8">
                {[
                  `Up to ${config.freeTierLimit} clients`,
                  'Unlimited loans per client',
                  'Payment history',
                  'Your business branding',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-green-500">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/login"
                className="block text-center bg-gray-100 text-gray-700 font-semibold py-3 rounded-lg hover:bg-gray-200 transition-colors">
                Start Free
              </Link>
            </div>

            <div className="bg-blue-700 text-white rounded-xl p-8 shadow-md">
              <div className="text-sm font-semibold text-blue-200 uppercase tracking-wide mb-2">Pro</div>
              <div className="text-3xl font-bold mb-1">{priceStr}</div>
              <div className="text-blue-200 text-sm mb-6">per year · Pay via UPI</div>
              <ul className="space-y-3 text-sm text-blue-100 mb-8">
                {[
                  `Up to ${config.paidTierLimit} clients`,
                  'Everything in Free',
                  'Analytics Dashboard',
                  'Top borrowers report',
                  'Share & print via WhatsApp',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-white">✓</span>{f}
                  </li>
                ))}
              </ul>
              <Link href="/login"
                className="block text-center bg-white text-blue-700 font-semibold py-3 rounded-lg hover:bg-blue-50 transition-colors">
                Upgrade to Pro
              </Link>
            </div>

          </div>
        </div>
      </div>

      <footer className="text-center py-8 text-gray-400 text-sm">
        © {new Date().getFullYear()} LoanPro · Built for Indian lenders
      </footer>
    </main>
  )
}