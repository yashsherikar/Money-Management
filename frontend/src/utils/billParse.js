/**
 * Parse OCR text from Indian bills / receipts into transaction fields.
 */

const PAYMENT_MODES = [
  { id: 'upi', label: 'UPI', re: /\bupi\b|\bgpay\b|\bgoogle pay\b|\bphonepe\b|\bpaytm\b|\bbhim\b/i },
  { id: 'card', label: 'Card', re: /\bcard\b|\bvisa\b|\bmastercard\b|\brupee card\b|\bcredit\b|\bdebit card\b|\bxxxx\b|\b\d{4}\s?\d{4}/i },
  { id: 'cash', label: 'Cash', re: /\bcash\b|\bcash payment\b/i },
  { id: 'netbanking', label: 'Net banking', re: /\bnet\s?banking\b|\bneft\b|\bimps\b|\brtgs\b/i },
  { id: 'wallet', label: 'Wallet', re: /\bwallet\b|\bamazon pay\b|\bmobi[kq]wik\b/i },
]

const CATEGORY_HINTS = [
  // Coffee / chai / juice → Drinks (before Snacks / Dining Out)
  { name: 'Drinks', re: /\bcoffee|\bcafe|\bstarbucks|\bcold\s*coffee|\btea\b|\bchai|\bjuice|\bshake|\bsmoothie|\blassi|\blimbu\s*pani|\bnimbu\s*pani|\blemonade|\bsoft\s*drink|\bcold\s*drink|\bsoda|\bpepsi|\bcoca\s*cola|\bdrink\b|\bdrinks\b/i },
  { name: 'Snacks', re: /\bsnack|\bchaat|\bpani\s*puri|\bvada\s*pav|\bstreet\s*food|\bburger|\bsamosa|\bnasta|\bnashta|\bbreakfast|\bkfc|\bdomino|\bmcdonald|\bpizza\s*hut|\bsubway/i },
  { name: 'Dining Out', re: /\brestaurant\b|\bdining\b|\bswiggy\b|\bzomato\b|\bhotel\b|\blunch\b|\bdinner\b|\bthali\b|\bbuffet\b|\bbiryani\b|\bdosa\b|\bchinese\b/i },
  { name: 'Groceries', re: /\bgrocery\b|\bsupermarket\b|\bdmart\b|\bbig bazaar\b|\breliance fresh\b|\bmore\b|\bvegetables?\b/i },
  { name: 'Fuel', re: /\bpetrol\b|\bdiesel\b|\bfuel\b|\bpump\b|\biocl\b|\bbpcl\b|\bhpcl\b/i },
  { name: 'Travel', re: /\btaxi\b|\buber\b|\bola\b|\brailway\b|\birctc\b|\bflight\b|\bindigo\b|\bcab\b|\bfare\b/i },
  { name: 'Shopping', re: /\bmall\b|\bamazon\b|\bflipkart\b|\bmyntra\b|\breliance digital\b|\bcroma\b/i },
  { name: 'Medical', re: /\bpharmacy\b|\bhospital\b|\bclinic\b|\bmedical\b|\bapollo\b|\bmedplus\b/i },
  { name: 'Utilities', re: /\belectricity\b|\bwater bill\b|\bgas bill\b|\bbroadband\b|\brecharge\b|\bpostpaid\b/i },
  { name: 'Bills', re: /\binvoice\b|\bbill\b|\breceipt\b|\btax invoice\b/i },
]

function parseAmounts(text) {
  const found = []
  const re = /(?:₹|rs\.?\s*|inr\s*)\s*(\d{1,3}(?:,\d{2,3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi
  let m
  while ((m = re.exec(text)) !== null) {
    const n = Number(String(m[1]).replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 1 && n < 10_000_000) found.push(n)
  }
  // Also bare totals near keywords
  const totalLine = text.match(/(?:grand\s*)?total\s*[:\-]?\s*(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (totalLine) {
    const n = Number(String(totalLine[1]).replace(/,/g, ''))
    if (Number.isFinite(n) && n >= 1) found.push(n)
  }
  return found
}

function pickAmount(amounts, text) {
  if (!amounts.length) return null
  const lower = text.toLowerCase()
  // Prefer amount on a "total" line
  const totalM = text.match(/(?:grand\s*)?total\s*[:\-]?\s*(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (totalM) {
    const n = Number(String(totalM[1]).replace(/,/g, ''))
    if (Number.isFinite(n)) return n.toFixed(2)
  }
  // Largest amount is usually the bill total (skip tiny tax-only if another exists)
  const sorted = [...amounts].sort((a, b) => b - a)
  if (sorted.length >= 2 && sorted[0] > sorted[1] * 3) return sorted[0].toFixed(2)
  // If "amount paid" / "net payable"
  const paidM = text.match(/(?:amount\s*paid|net\s*payable|payable\s*amount|you\s*paid)\s*[:\-]?\s*(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i)
  if (paidM) {
    const n = Number(String(paidM[1]).replace(/,/g, ''))
    if (Number.isFinite(n)) return n.toFixed(2)
  }
  if (/\bcgst\b|\bsgst\b|\bigst\b/i.test(lower) && sorted.length >= 2) {
    // Prefer second largest sometimes is subtotal — still take largest for total
    return sorted[0].toFixed(2)
  }
  return sorted[0].toFixed(2)
}

function detectPaymentMode(text) {
  for (const p of PAYMENT_MODES) {
    if (p.re.test(text)) return p
  }
  return { id: 'other', label: 'Other', re: null }
}

function detectCategoryName(text, categories = []) {
  for (const hint of CATEGORY_HINTS) {
    if (hint.re.test(text)) {
      const hit = categories.find((c) => String(c.name).toLowerCase() === hint.name.toLowerCase())
      return { name: hint.name, categoryId: hit?.id || null }
    }
  }
  // Match any category name appearing in text
  for (const c of categories) {
    const n = String(c.name || '')
    if (n.length >= 3 && n.toLowerCase() !== 'other' && text.toLowerCase().includes(n.toLowerCase())) {
      return { name: c.name, categoryId: c.id }
    }
  }
  const other = categories.find((c) => String(c.name).toLowerCase() === 'other')
  return { name: 'Other', categoryId: other?.id || null }
}

function detectMerchant(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length >= 3 && l.length <= 48)
  for (const line of lines.slice(0, 8)) {
    if (/^(tax|gst|invoice|bill|receipt|date|total|qty|particulars|phone|tel|gstin)/i.test(line)) continue
    if (/^\d+$/.test(line)) continue
    if (/(?:₹|rs\.?)/i.test(line)) continue
    return line.replace(/\s+/g, ' ')
  }
  return ''
}

function detectDate(text) {
  const m = text.match(/(\d{1,2}[\/\-.](?:\d{1,2}|[A-Za-z]{3,9})[\/\-.]\d{2,4})/)
  if (!m) return null
  const raw = m[1]
  // Try DD/MM/YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (dmy) {
    let y = Number(dmy[3])
    if (y < 100) y += 2000
    const day = String(dmy[1]).padStart(2, '0')
    const month = String(dmy[2]).padStart(2, '0')
    if (Number(month) >= 1 && Number(month) <= 12) return `${y}-${month}-${day}`
  }
  return null
}

/**
 * @returns {{
 *   amount: string|null,
 *   merchant: string,
 *   paymentMode: {id:string,label:string},
 *   categoryName: string,
 *   categoryId: number|null,
 *   txnDate: string|null,
 *   rawText: string,
 * }}
 */
export function parseBillOcrText(text, { categories = [] } = {}) {
  const cleaned = String(text || '').replace(/\u00a0/g, ' ')
  const amounts = parseAmounts(cleaned)
  const amount = pickAmount(amounts, cleaned)
  const paymentMode = detectPaymentMode(cleaned)
  const cat = detectCategoryName(cleaned, categories)
  const merchant = detectMerchant(cleaned)
  const txnDate = detectDate(cleaned)
  return {
    amount,
    merchant,
    paymentMode,
    categoryName: cat.name,
    categoryId: cat.categoryId,
    txnDate,
    rawText: cleaned.slice(0, 2000),
  }
}
