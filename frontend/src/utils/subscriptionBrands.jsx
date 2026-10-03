/**
 * Merchant / subscription brands — match SMS, description, title → logo badge.
 * More-specific keywords first (amazon prime before amazon, etc.).
 */

export const SUBSCRIPTION_BRANDS = [
  // Streaming / music / subscriptions
  { id: 'netflix', name: 'Netflix', color: '#E50914', letter: 'N', keywords: ['netflix'] },
  { id: 'spotify', name: 'Spotify', color: '#1DB954', letter: '♪', keywords: ['spotify'] },
  { id: 'youtube', name: 'YouTube', color: '#FF0000', letter: '▶', keywords: ['youtube premium', 'youtubepremium', 'yt premium', 'youtube', 'youtu.be'] },
  { id: 'amazonprime', name: 'Amazon Prime', color: '#00A8E1', letter: 'P', keywords: ['amazon prime', 'primevideo', 'prime video', 'amznprime', 'prime video'] },
  { id: 'disney', name: 'Disney+', color: '#113CCF', letter: 'D', keywords: ['disney+', 'disneyplus', 'disney plus', 'hotstar', 'jiohotstar'] },
  { id: 'tataplay', name: 'Tata Play', color: '#E31837', letter: 'T', keywords: ['tata play', 'tataplay', 'tata sky'] },
  { id: 'zee5', name: 'ZEE5', color: '#8230C9', letter: 'Z', keywords: ['zee5', 'zee 5'] },
  { id: 'sony', name: 'SonyLIV', color: '#000000', letter: 'S', keywords: ['sonyliv', 'sony liv'] },
  { id: 'gaana', name: 'Gaana', color: '#E72C30', letter: 'G', keywords: ['gaana'] },
  { id: 'wynk', name: 'Wynk', color: '#E4002B', letter: 'W', keywords: ['wynk'] },
  { id: 'apple', name: 'Apple', color: '#555555', letter: 'A', keywords: ['apple.com/bill', 'itunes', 'apple music', 'icloud+', 'icloud'] },
  { id: 'linkedin', name: 'LinkedIn', color: '#0A66C2', letter: 'in', keywords: ['linkedin'] },
  { id: 'microsoft', name: 'Microsoft', color: '#00A4EF', letter: 'M', keywords: ['microsoft 365', 'xbox', 'office 365'] },
  { id: 'googleone', name: 'Google One', color: '#4285F4', letter: 'G', keywords: ['google one', 'google storage'] },

  // Food / quick commerce
  { id: 'zomato', name: 'Zomato', color: '#E23744', letter: 'Z', keywords: ['zomato gold', 'zomato'] },
  { id: 'swiggy', name: 'Swiggy', color: '#FC8019', letter: 'S', keywords: ['swiggy one', 'swiggy instamart', 'swiggy'] },
  { id: 'blinkit', name: 'Blinkit', color: '#F8C51B', letter: 'B', keywords: ['blinkit', 'grofers'] },
  { id: 'zepto', name: 'Zepto', color: '#FF2E63', letter: 'Z', keywords: ['zepto'] },
  { id: 'bigbasket', name: 'BigBasket', color: '#84C225', letter: 'bb', keywords: ['bigbasket', 'big basket'] },
  { id: 'dunzo', name: 'Dunzo', color: '#00D26A', letter: 'D', keywords: ['dunzo'] },

  // Ride / travel
  { id: 'uber', name: 'Uber', color: '#000000', letter: 'U', keywords: ['uber eats', 'uberindia', 'uber'] },
  { id: 'ola', name: 'Ola', color: '#CDDC39', letter: 'O', keywords: ['ola cabs', 'olacabs', 'ola money', 'ola'] },
  { id: 'rapido', name: 'Rapido', color: '#F9A825', letter: 'R', keywords: ['rapido'] },
  { id: 'irctc', name: 'IRCTC', color: '#213D77', letter: 'I', keywords: ['irctc'] },
  { id: 'makemytrip', name: 'MakeMyTrip', color: '#E31837', letter: 'M', keywords: ['makemytrip', 'make my trip', 'mmt'] },
  { id: 'redbus', name: 'redBus', color: '#D84E55', letter: 'r', keywords: ['redbus', 'red bus'] },

  // Shopping / marketplaces
  { id: 'amazon', name: 'Amazon', color: '#FF9900', letter: 'a', keywords: ['amazon.in', 'amzn', 'amazon pay', 'amazon'] },
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
  { id: 'gpay', name: 'Google Pay', color: '#4285F4', letter: 'G', keywords: ['google pay', 'gpay', 'tez'] },
  { id: 'paytm', name: 'Paytm', color: '#00BAF2', letter: 'P', keywords: ['paytm'] },
  { id: 'cred', name: 'CRED', color: '#1A1A1A', letter: 'C', keywords: ['cred club', 'cred.club', 'cred'] },
]

/** Alias — same list used for txn description logos. */
export const MERCHANT_BRANDS = SUBSCRIPTION_BRANDS

export function detectSubscriptionBrand(...texts) {
  const hay = texts.filter(Boolean).join(' ').toLowerCase()
  if (!hay) return null
  for (const brand of SUBSCRIPTION_BRANDS) {
    if (brand.keywords.some((k) => {
      if (k.includes('.*')) return new RegExp(k, 'i').test(hay)
      return hay.includes(k)
    })) {
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

/** Small colored logo badge for a brand. */
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
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 shadow-sm ${className}`}
      style={{
        width: size,
        height: size,
        background: brand.color,
        fontSize: brand.letter.length > 1 ? size * 0.28 : size * 0.42,
        fontFamily: brand.id === 'apple' ? 'system-ui, sans-serif' : undefined,
        color: brand.id === 'blinkit' || brand.id === 'ola' ? '#1a1a1a' : '#fff',
      }}
      title={brand.name}
      aria-hidden
    >
      {brand.letter}
    </span>
  )
}

export const MerchantLogo = SubscriptionLogo

export function subscriptionLabel(brand, fallback = 'Subscription') {
  return brand ? `Subscription: ${brand.name}` : `Subscription: ${fallback}`
}
