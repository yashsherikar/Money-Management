/**
 * Merchant / subscription brands — match SMS, description, title → real logo mark.
 * More-specific keywords first (amazon prime before amazon, etc.).
 */
import { BRAND_LOGO_COMPONENTS, LogoLetter } from './brandLogos.jsx'

export const SUBSCRIPTION_BRANDS = [
  // Streaming / music / subscriptions
  { id: 'netflix', name: 'Netflix', color: '#E50914', letter: 'N', keywords: ['netflix'] },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', letter: '♪', keywords: ['spotify'] },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', letter: '▶', keywords: ['youtube premium', 'youtubepremium', 'yt premium', 'youtube', 'youtu.be'] },
  { id: 'amazonprime', name: 'Amazon Prime', color: '#00A8E1', letter: 'P', keywords: ['amazon prime', 'primevideo', 'prime video', 'amznprime'] },
  { id: 'disney', name: 'Disney+', color: '#113CCF', letter: 'D', keywords: ['disney+', 'disneyplus', 'disney plus', 'hotstar', 'jiohotstar'] },
  { id: 'tataplay', name: 'Tata Play', color: '#E31837', letter: 'T', keywords: ['tata play', 'tataplay', 'tata sky'] },
  { id: 'zee5', name: 'ZEE5', color: '#8230C9', letter: 'Z', keywords: ['zee5', 'zee 5'] },
  { id: 'sony', name: 'SonyLIV', color: '#000000', letter: 'S', keywords: ['sonyliv', 'sony liv'] },
  { id: 'gaana', name: 'Gaana', color: '#E72C30', letter: 'G', keywords: ['gaana'] },
  { id: 'wynk', name: 'Wynk', color: '#E4002B', letter: 'W', keywords: ['wynk'] },
  { id: 'apple', name: 'Apple', color: '#111111', letter: '', keywords: ['apple.com/bill', 'itunes', 'apple music', 'icloud+', 'icloud'] },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', letter: 'in', keywords: ['linkedin'] },
  { id: 'microsoft', name: 'Microsoft', color: '#00A4EF', letter: 'M', keywords: ['microsoft 365', 'xbox', 'office 365'] },
  { id: 'googleone', name: 'Google One', color: '#4285F4', letter: 'G', keywords: ['google one', 'google storage'] },

  // QSR / cafes / food chains
  { id: 'mcdonalds', name: "McDonald's", color: '#DA291C', letter: 'M', keywords: ['mcdonald', "mcdonald's", 'mcdonalds', 'mcdindia', '\\bmcd\\b'] },
  { id: 'kfc', name: 'KFC', color: '#E4002B', letter: 'K', keywords: ['kfc'] },
  { id: 'starbucks', name: 'Starbucks', color: '#00704A', letter: 'S', keywords: ['starbucks', 'sbux'] },
  { id: 'burgerking', name: 'Burger King', color: '#502314', letter: 'BK', keywords: ['burger king', 'burgerking', 'bk india'] },
  { id: 'dominos', name: "Domino's", color: '#006491', letter: 'D', keywords: ["domino's", 'dominos', 'domino'] },
  { id: 'pizzahut', name: 'Pizza Hut', color: '#EE3A24', letter: 'PH', keywords: ['pizza hut', 'pizzahut'] },
  { id: 'subway', name: 'Subway', color: '#008C15', letter: 'SUB', keywords: ['subway'] },

  // Food / quick commerce
  { id: 'zomato', name: 'Zomato', color: '#E23744', letter: 'Z', keywords: ['zomato gold', 'zomato'] },
  { id: 'swiggy', name: 'Swiggy', color: '#FC8019', letter: 'S', keywords: ['swiggy one', 'swiggy instamart', 'swiggy'] },
  { id: 'blinkit', name: 'Blinkit', color: '#F8C51B', letter: 'B', keywords: ['blinkit', 'grofers'] },
  { id: 'zepto', name: 'Zepto', color: '#FF2E63', letter: 'Z', keywords: ['zepto'] },
  { id: 'bigbasket', name: 'BigBasket', color: '#84C225', letter: 'bb', keywords: ['bigbasket', 'big basket'] },
  { id: 'dunzo', name: 'Dunzo', color: '#00D26A', letter: 'D', keywords: ['dunzo'] },

  // Ride / travel
  {
    id: 'uber',
    name: 'Uber',
    color: '#000000',
    letter: 'U',
    keywords: ['uber eats', 'ubereats', 'uberindia', 'uber trip', 'uber ride', 'uber'],
  },
  { id: 'ola', name: 'Ola', color: '#CDDC39', letter: 'O', keywords: ['ola cabs', 'olacabs', 'ola money', 'ola'] },
  { id: 'rapido', name: 'Rapido', color: '#F9A825', letter: 'R', keywords: ['rapido'] },
  { id: 'irctc', name: 'IRCTC', color: '#213D77', letter: 'I', keywords: ['irctc'] },
  { id: 'makemytrip', name: 'MakeMyTrip', color: '#E31837', letter: 'M', keywords: ['makemytrip', 'make my trip'] },
  { id: 'redbus', name: 'redBus', color: '#D84E55', letter: 'r', keywords: ['redbus', 'red bus'] },

  // Shopping / marketplaces
  { id: 'amazon', name: 'Amazon', color: '#232F3E', letter: 'a', keywords: ['amazon.in', 'amzn', 'amazon pay', 'amazon'] },
  { id: 'flipkart', name: 'Flipkart', color: '#2874F0', letter: 'Fk', keywords: ['flipkart', 'fkrt'] },
  { id: 'myntra', name: 'Myntra', color: '#FF3F6C', letter: 'M', keywords: ['myntra'] },
  { id: 'ajio', name: 'AJIO', color: '#2C2C54', letter: 'Aj', keywords: ['ajio'] },
  { id: 'meesho', name: 'Meesho', color: '#F43397', letter: 'Me', keywords: ['meesho'] },
  { id: 'jiomart', name: 'JioMart', color: '#0A2885', letter: 'Jm', keywords: ['jiomart', 'jio mart', 'jio-mart'] },
  { id: 'nykaa', name: 'Nykaa', color: '#FC2779', letter: 'Ny', keywords: ['nykaa'] },

  // Telecom / payments
  { id: 'jio', name: 'Jio', color: '#0A2885', letter: 'J', keywords: ['jio recharge', 'reliance jio', 'jiocinema', 'jio fiber', 'myjio', 'jio'] },
  { id: 'airtel', name: 'Airtel', color: '#ED1C24', letter: 'A', keywords: ['airtel', 'airtel thanks', 'airtelxstream'] },
  { id: 'vi', name: 'Vi', color: '#EE2737', letter: 'V', keywords: ['vodafone idea', 'vi recharge', 'myvi'] },
  { id: 'phonepe', name: 'PhonePe', color: '#5F259F', letter: 'पे', keywords: ['phonepe'] },
  { id: 'gpay', name: 'Google Pay', color: '#4285F4', letter: 'G', keywords: ['google pay', 'gpay'] },
  {
    id: 'paytm',
    name: 'Paytm',
    color: '#00BAF2',
    letter: 'P',
    // ONE97 = Paytm corporate sender on bank credit SMS
    keywords: ['paytm', 'one97', 'one97 communica', 'paytmbank', 'paytm bank'],
  },
  // CRED app only — NEVER match bank "credit" / "credited" / "CREDIT".
  {
    id: 'cred',
    name: 'CRED',
    color: '#1A1A1A',
    letter: 'C',
    keywords: [
      'cred club',
      'cred.club',
      'cred app',
      'cred mint',
      'cred pay',
      'cred cash',
      'dreamplug',
    ],
  },
]

/** Alias — same list used for txn description logos. */
export const MERCHANT_BRANDS = SUBSCRIPTION_BRANDS

/** Match keyword as a whole token so "ola" ≠ "cola", etc. */
function keywordMatches(hay, keyword) {
  const k = String(keyword || '').toLowerCase()
  if (!k || !hay) return false
  if (k.includes('.*') || k.startsWith('\\b')) {
    try {
      return new RegExp(k, 'i').test(hay)
    } catch {
      return false
    }
  }
  const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Exact token: "uber" in "paid via uber today"
  if (new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, 'i').test(hay)) return true
  // Merchant codes / VPAs: "uber" in "uberindia", "ubereats", "uber@ybl"
  // Only for longer keywords so short ones ("ola", "jio", "vi") stay exact.
  if (k.length >= 4 && !k.includes(' ') && !k.includes('@')) {
    return new RegExp(`(?:^|[^a-z0-9])${escaped}[a-z0-9]{0,24}(?:[^a-z0-9]|$)`, 'i').test(hay)
  }
  return false
}

/**
 * True only for the CRED fintech app — never bank CREDIT / credited / credit card.
 * Algorithm: remove every "credit*" bank word, then require a remaining whole-token "cred"
 * or an explicit CRED-app phrase (cred club, cred.club, …).
 */
export function isCredAppText(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase()
  if (!hay) return false

  // Remove bank language that starts with "credit" so it can never leave a false "cred"
  const stripped = hay
    .replace(/\bcredit\s*cards?\b/g, ' ')
    .replace(/\bcredit(?:ed|s|ing|or)?\b/g, ' ')
    .replace(/\ba\/c\s*credit\b/g, ' ')
    .replace(/\binward\s*credit\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!stripped) return false

  if (/\bcred\s*club\b/.test(stripped)) return true
  if (/\bcred\.club\b/.test(stripped)) return true
  if (/\bcred\s*app\b/.test(stripped)) return true
  if (/\bcred\s*mint\b/.test(stripped)) return true
  if (/\bcred\s*pay\b/.test(stripped)) return true
  if (/\bcred\s*cash\b/.test(stripped)) return true
  if (/\bdreamplug\b/.test(stripped)) return true

  // Whole token "cred" only (after credit* removed) — "credit" alone becomes empty → false
  return /(?:^|[^a-z0-9])cred(?:[^a-z0-9]|$)/.test(stripped)
}

export function detectSubscriptionBrand(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase()
  if (!hay) return null
  for (const brand of SUBSCRIPTION_BRANDS) {
    if (brand.id === 'cred') {
      if (isCredAppText(...texts)) return brand
      continue
    }
    if (brand.keywords.some((k) => keywordMatches(hay, k))) {
      return brand
    }
  }
  return null
}

export const detectMerchantBrand = detectSubscriptionBrand

export function brandFromRecurringDescription(description) {
  return detectSubscriptionBrand(description)
}

export function brandFromTxnText(...texts) {
  return detectSubscriptionBrand(...texts)
}

export function isSubscriptionRecurring(item) {
  if (!item) return false
  const d = String(item.description || '')
  if (/^subscription:/i.test(d) || /^autopay:/i.test(d)) return true
  return !!brandFromRecurringDescription(d)
}

/** Real brand mark when available; letter badge otherwise. */
export function SubscriptionLogo({ brand, size = 40, className = '' }) {
  if (!brand) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full bg-slate-200 text-slate-600 font-bold ${className}`}
        style={{ width: size, height: size, fontSize: size * 0.35 }}
        aria-hidden
      >
        ↻
      </span>
    )
  }
  const Icon = BRAND_LOGO_COMPONENTS[brand.id]
  if (Icon) return <Icon size={size} className={className} />
  return <LogoLetter brand={brand} size={size} className={className} />
}

export const MerchantLogo = SubscriptionLogo

export function subscriptionLabel(brand, fallback = 'Subscription') {
  return brand ? `Subscription: ${brand.name}` : `Subscription: ${fallback}`
}
