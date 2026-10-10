/**
 * Merchant / subscription brands — match SMS, description, title → real logo mark.
 * More-specific keywords first (amazon prime before amazon, etc.).
 */
import { BRAND_LOGO_COMPONENTS, LogoLetter } from './brandLogos.jsx'

/** Food/drink *types*, not companies — never rename a merchant ("Sharma Tea Stall") to these. */
export const GENERIC_BRAND_IDS = new Set([
  'limbupani', 'coffee', 'tea', 'juice', 'softdrink', 'dosa', 'idli', 'chinese',
  'panipuri', 'biryani', 'pizzafood', 'burgerfood', 'icecream', 'samosa',
])

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
  { id: 'tacobell', name: 'Taco Bell', color: '#702082', letter: 'TB', keywords: ['taco bell', 'tacobell'] },
  { id: 'haldiram', name: "Haldiram's", color: '#C8102E', letter: 'H', keywords: ['haldiram', "haldiram's"] },
  { id: 'ccd', name: 'Cafe Coffee Day', color: '#4B2C20', letter: 'CCD', keywords: ['cafe coffee day', 'coffee day', '\\bccd\\b'] },
  { id: 'wowmomo', name: 'Wow! Momo', color: '#E31E24', letter: 'W', keywords: ['wow momo', 'wow! momo', 'wowmomo'] },
  { id: 'baskin', name: 'Baskin Robbins', color: '#D71921', letter: '31', keywords: ['baskin', 'baskin robbins'] },
  { id: 'faasos', name: 'Faasos', color: '#FF6B00', letter: 'F', keywords: ['faasos'] },
  { id: 'behrouz', name: 'Behrouz', color: '#7A1F1F', letter: 'B', keywords: ['behrouz'] },
  { id: 'chaayos', name: 'Chaayos', color: '#6B2D5B', letter: 'Ch', keywords: ['chaayos'] },
  { id: 'chaipoint', name: 'Chai Point', color: '#C45C26', letter: 'CP', keywords: ['chai point', 'chaipoint'] },
  { id: 'bluetokai', name: 'Blue Tokai', color: '#1B4F72', letter: 'BT', keywords: ['blue tokai', 'bluetokai'] },
  { id: 'thirdwave', name: 'Third Wave', color: '#2C1810', letter: 'TW', keywords: ['third wave', 'thirdwave'] },
  { id: 'costa', name: 'Costa Coffee', color: '#6D1F2C', letter: 'Costa', keywords: ['costa coffee', '\\bcosta\\b'] },
  { id: 'barista', name: 'Barista', color: '#5C3317', letter: 'Bar', keywords: ['barista lavazza', '\\bbarista\\b'] },
  { id: 'saravana', name: 'Saravana Bhavan', color: '#E85D04', letter: 'SB', keywords: ['saravana bhavan', 'saravana', 'saravanabhavan'] },
  { id: 'sagarratna', name: 'Sagar Ratna', color: '#0B6E4F', letter: 'SR', keywords: ['sagar ratna', 'sagarratna'] },
  { id: 'chinesewok', name: 'Chinese Wok', color: '#C41E3A', letter: 'CW', keywords: ['chinese wok', 'chinesewok'] },
  { id: 'mainlandchina', name: 'Mainland China', color: '#8B0000', letter: 'MC', keywords: ['mainland china', 'mainlandchina'] },

  // Generic drinks / food types (after named chains so Starbucks/CCD win over "coffee")
  { id: 'limbupani', name: 'Limbu Pani', color: '#F4D03F', letter: '🍋', keywords: ['limbu pani', 'limbupani', 'nimbu pani', 'nimbupani', 'lemonade', 'lemon soda', 'shikanji'] },
  { id: 'coffee', name: 'Coffee', color: '#6F4E37', letter: '☕', keywords: ['filter coffee', 'cold coffee', 'hot coffee', 'espresso', 'cappuccino', 'latte', 'mocha', '\\bcoffee\\b'] },
  { id: 'tea', name: 'Tea / Chai', color: '#2E7D32', letter: '🍵', keywords: ['cutting chai', 'masala chai', 'ginger tea', 'green tea', '\\bchai\\b', '\\btea\\b', 'tapri'] },
  { id: 'juice', name: 'Juice', color: '#FF8C00', letter: '🧃', keywords: ['fresh juice', 'fruit juice', 'sugarcane', 'ganna', 'smoothie', 'milkshake', 'milk shake', '\\bjuice\\b', '\\bshake\\b', '\\blassi\\b'] },
  { id: 'softdrink', name: 'Soft Drink', color: '#E53935', letter: '🥤', keywords: ['soft drink', 'cold drink', 'colddrink', 'thums up', 'thumsup', 'coca cola', 'cocacola', 'pepsi', 'sprite', 'fanta', 'maaza', 'slice juice', '\\bsoda\\b'] },
  { id: 'dosa', name: 'Dosa', color: '#E8A838', letter: '🥞', keywords: ['masala dosa', 'plain dosa', 'rava dosa', 'onion dosa', '\\bdosa\\b', '\\bdhosha\\b', '\\bdhosa\\b', 'uttapam', 'medu vada', 'dahi vada'] },
  { id: 'idli', name: 'Idli', color: '#FDF6E9', letter: '⚪', keywords: ['idli sambhar', '\\bidly\\b', '\\bidli\\b'] },
  { id: 'chinese', name: 'Chinese', color: '#C62828', letter: '🥡', keywords: ['chinese', 'noodles', 'hakka', 'manchurian', 'schezwan', 'szechuan', 'fried rice', 'chowmein', 'chow mein', 'momos', '\\bmomo\\b'] },
  { id: 'panipuri', name: 'Pani Puri', color: '#FF6F00', letter: '🟠', keywords: ['pani puri', 'panipuri', 'golgappa', 'gol gappa', 'bhel puri', 'bhelpuri', 'sev puri', 'chaat'] },
  { id: 'biryani', name: 'Biryani', color: '#8B4513', letter: '🍛', keywords: ['biryani', 'biriyani', 'dum biryani'] },
  { id: 'pizzafood', name: 'Pizza', color: '#D32F2F', letter: '🍕', keywords: ['\\bpizza\\b'] },
  { id: 'burgerfood', name: 'Burger', color: '#F57C00', letter: '🍔', keywords: ['\\bburger\\b', 'vada pav', 'vadapav'] },
  { id: 'icecream', name: 'Ice Cream', color: '#EC407A', letter: '🍨', keywords: ['ice cream', 'icecream', 'softy', 'kulfi', 'gelato'] },
  { id: 'samosa', name: 'Samosa', color: '#D4A017', letter: '🥟', keywords: ['\\bsamosa\\b', 'samosas', 'kachori', 'pakora', 'pakoda'] },

  // Food / quick commerce
  // Bank SMS often shows the company's legal name, not the app: Blink Commerce = Blinkit,
  // KiranaKart = Zepto, Bundl = Swiggy, Eternal (ex-Zomato Ltd) = Zomato, Supermarket Grocery
  // Supplies = BigBasket.
  { id: 'zomato', name: 'Zomato', color: '#E23744', letter: 'Z', keywords: ['zomato gold', 'zomato', 'eternal limited', 'eternal ltd'] },
  { id: 'instamart', name: 'Instamart', color: '#FC8019', letter: 'IM', keywords: ['swiggy instamart', 'instamart'] },
  { id: 'swiggy', name: 'Swiggy', color: '#FC8019', letter: 'S', keywords: ['swiggy one', 'swiggy', 'bundl'] },
  { id: 'blinkit', name: 'Blinkit', color: '#F8C51B', letter: 'B', keywords: ['blinkit', 'grofers', 'blink commerce', 'blinkcommerce'] },
  { id: 'zepto', name: 'Zepto', color: '#FF2E63', letter: 'Z', keywords: ['zepto', 'kiranakart', 'kirana kart'] },
  { id: 'bigbasket', name: 'BigBasket', color: '#84C225', letter: 'bb', keywords: ['bigbasket', 'big basket', 'supermarket grocery'] },
  { id: 'dunzo', name: 'Dunzo', color: '#00D26A', letter: 'D', keywords: ['dunzo'] },
  { id: 'dmart', name: 'DMart', color: '#0078C1', letter: 'DM', keywords: ['dmart', 'd-mart', 'avenue supermarts'] },
  { id: 'reliancefresh', name: 'Reliance Fresh', color: '#E31837', letter: 'RF', keywords: ['reliance fresh', 'reliancefresh'] },
  { id: 'more', name: 'More', color: '#E30613', letter: 'More', keywords: ['more supermarket', 'more megastore', 'more retail'] },

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
  { id: 'goibibo', name: 'Goibibo', color: '#FE5B00', letter: 'go', keywords: ['goibibo', 'goi bibo'] },
  { id: 'redbus', name: 'redBus', color: '#D84E55', letter: 'r', keywords: ['redbus', 'red bus'] },
  { id: 'indigo', name: 'IndiGo', color: '#003366', letter: '6E', keywords: ['indigo', 'goindigo'] },
  { id: 'airindia', name: 'Air India', color: '#DA0C0C', letter: 'AI', keywords: ['air india', 'airindia'] },

  // Shopping / marketplaces
  { id: 'amazon', name: 'Amazon', color: '#232F3E', letter: 'a', keywords: ['amazon.in', 'amzn', 'amazon pay', 'amazon'] },
  { id: 'flipkart', name: 'Flipkart', color: '#2874F0', letter: 'Fk', keywords: ['flipkart', 'fkrt'] },
  { id: 'myntra', name: 'Myntra', color: '#FF3F6C', letter: 'M', keywords: ['myntra'] },
  { id: 'ajio', name: 'AJIO', color: '#2C2C54', letter: 'Aj', keywords: ['ajio'] },
  { id: 'meesho', name: 'Meesho', color: '#F43397', letter: 'Me', keywords: ['meesho'] },
  { id: 'jiomart', name: 'JioMart', color: '#0A2885', letter: 'Jm', keywords: ['jiomart', 'jio mart', 'jio-mart'] },
  { id: 'nykaa', name: 'Nykaa', color: '#FC2779', letter: 'Ny', keywords: ['nykaa'] },
  { id: 'lenskart', name: 'Lenskart', color: '#00BAC6', letter: 'LK', keywords: ['lenskart'] },
  { id: 'croma', name: 'Croma', color: '#00B1A4', letter: 'Cr', keywords: ['croma'] },
  { id: 'decathlon', name: 'Decathlon', color: '#0082C3', letter: 'DEC', keywords: ['decathlon'] },

  // Entertainment / lifestyle
  { id: 'bookmyshow', name: 'BookMyShow', color: '#C4242B', letter: 'BMS', keywords: ['bookmyshow', 'book my show', 'bms'] },
  { id: 'pvr', name: 'PVR', color: '#1B1B1B', letter: 'PVR', keywords: ['pvr inox', 'pvr cinemas', '\\bpvr\\b'] },
  { id: 'cultfit', name: 'Cult.fit', color: '#111111', letter: 'cult', keywords: ['cult.fit', 'cultfit', 'curefit'] },
  { id: 'urbancompany', name: 'Urban Company', color: '#6E3FF3', letter: 'UC', keywords: ['urban company', 'urbanclap'] },

  // Health
  { id: 'pharmeasy', name: 'PharmEasy', color: '#10847E', letter: 'PE', keywords: ['pharmeasy', 'pharm easy'] },
  { id: 'onemg', name: '1mg', color: '#FF6F61', letter: '1mg', keywords: ['1mg', 'onemg', 'tata 1mg'] },
  { id: 'apollo', name: 'Apollo', color: '#0B6E4F', letter: 'A', keywords: ['apollo pharmacy', 'apollo hospital', 'apollopharmacy'] },

  // Investing
  { id: 'groww', name: 'Groww', color: '#00B386', letter: 'G', keywords: ['groww'] },
  { id: 'zerodha', name: 'Zerodha', color: '#387ED1', letter: 'K', keywords: ['zerodha', 'kite.zerodha', 'coin.zerodha'] },

  // Banks (SMS sender / UPI)
  { id: 'hdfc', name: 'HDFC Bank', color: '#004C8F', letter: 'H', keywords: ['hdfc bank', 'hdfcbank', 'hdfc'] },
  { id: 'sbi', name: 'SBI', color: '#22409A', letter: 'SBI', keywords: ['state bank', 'sbi bank', '\\bsbi\\b', 'yono sbi'] },
  { id: 'icici', name: 'ICICI Bank', color: '#F58220', letter: 'I', keywords: ['icici bank', 'icicibank', 'icici'] },
  { id: 'axis', name: 'Axis Bank', color: '#97144D', letter: 'AX', keywords: ['axis bank', 'axisbank', 'axis'] },
  { id: 'kotak', name: 'Kotak', color: '#ED1C24', letter: 'K', keywords: ['kotak bank', 'kotak mahindra', 'kotak'] },

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
  { id: 'bhim', name: 'BHIM', color: '#FF6F00', letter: 'BHIM', keywords: ['bhim upi', '\\bbhim\\b'] },
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

/** Banks appear in every bank SMS as the sender ("…via ICICI Bank") — never the merchant. */
export const BANK_BRAND_IDS = new Set(['hdfc', 'sbi', 'icici', 'axis', 'kotak'])

function findBrand(texts, skipBanks) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase()
  if (!hay) return null
  for (const brand of SUBSCRIPTION_BRANDS) {
    if (skipBanks && BANK_BRAND_IDS.has(brand.id)) continue
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

export function detectSubscriptionBrand(...texts) {
  return findBrand(texts, false)
}

export const detectMerchantBrand = detectSubscriptionBrand

/**
 * Brand of a bank-SMS payment: the parsed merchant name decides first; the rest of the SMS
 * text (sender, "via ICICI Bank", A/c line) may only add a non-bank brand. Without this an
 * ICICI debit to Jar became merchant "ICICI Bank" + autopay.
 */
export function detectSmsMerchantBrand(merchant, ...smsTexts) {
  return findBrand([merchant], false) || findBrand(smsTexts, true)
}

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
