import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LoanPro',
  description: 'Simple loan management for lenders',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'LoanPro' },
}

export const viewport: Viewport = {
  themeColor: '#1565C0',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="font-sans bg-gray-100 min-h-screen">{children}</body>
    </html>
  )
}
