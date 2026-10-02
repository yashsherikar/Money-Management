/**
 * Best-effort parse of GPay / PhonePe payment notifications.
 * Formats vary by app version and language — tune after a real ₹1 sample.
 */
export function parseUpiPaymentNotification({ title = '', text = '', packageName = '' } = {}) {
  const blob = `${title}\n${text}`.replace(/\s+/g, ' ').trim()
  if (!blob) return null

  const pkg = String(packageName || '')
  const fromGpay = /paisa|google/i.test(pkg) || /google pay|gpay/i.test(blob)
  const fromPhonepe = /phonepe/i.test(pkg) || /phonepe/i.test(blob)
  if (!fromGpay && !fromPhonepe && !/paid|sent|payment|upi/i.test(blob)) return null

  // Skip receive / cashback / offers
  if (/\breceived\b|\bcredited\b|\bcashback\b|\breward\b|\boffer\b/i.test(blob)
      && !/\byou (paid|sent)\b/i.test(blob)) {
    return null
  }

  const amount =
    matchAmount(blob, /(?:₹|rs\.?\s*|inr\s*)(\d[\d,]*(?:\.\d{1,2})?)/i)
    || matchAmount(blob, /(?:paid|sent)\s+(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (!amount || Number(amount) < 1) return null

  let payeeName =
    capture(blob, /(?:paid|sent)\s+(?:₹|rs\.?\s*)?[\d,.]+\s+(?:to|successfully to)\s+([^.,\n]+)/i)
    || capture(blob, /to\s+([A-Za-z0-9 ._'&-]{2,40})\s+(?:using|via|on|successfully)/i)
    || capture(blob, /(?:payment to|paid to)\s+([^.,\n]+)/i)

  if (payeeName) {
    payeeName = payeeName.replace(/\s+using\b.*/i, '').replace(/\s+via\b.*/i, '').trim()
  }

  const vpa = capture(blob, /([a-zA-Z0-9._-]{2,256}@[a-zA-Z]{2,64})/)

  return {
    amount,
    payeeName: payeeName || '',
    pa: vpa || '',
    source: fromPhonepe ? 'phonepe' : fromGpay ? 'gpay' : 'upi',
    raw: blob.slice(0, 400),
  }
}

function matchAmount(text, re) {
  const m = text.match(re)
  if (!m) return null
  const n = Number(String(m[1]).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 1) return null
  return n.toFixed(2)
}

function capture(text, re) {
  const m = text.match(re)
  return m ? String(m[1]).trim() : ''
}
