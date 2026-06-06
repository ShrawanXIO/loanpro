// src/lib/config.ts
// ─────────────────────────────────────────────────────────────
// Edit ONCE here. Used everywhere automatically.
// ─────────────────────────────────────────────────────────────

const config = {
  // ── App owner contact (you — the person selling LoanPro) ──
  ownerWhatsApp: '919999999999',        // 91 + your 10-digit number
  ownerEmail:    'support@loanpro.in',  // your support email
  ownerUpi:      'yourname@upi',        // YOUR UPI ID — lenders pay you here

  // ── App info ──────────────────────────────────────────────
  appName: 'LoanPro',

  // ── Pricing (change here, updates everywhere) ─────────────
  // Current asking price shown to users on all upgrade buttons
  currentPriceINR: 5000,

  // ── Tier limits (fallback if not set on tenant) ───────────
  freeTierLimit: 10,
  paidTierLimit: 100,

  // ── Renewal reminder window (days before expiry) ──────────
  renewalReminderDays: 15,
}

export default config