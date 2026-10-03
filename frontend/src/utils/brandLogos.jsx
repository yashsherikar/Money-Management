/**
 * Recognizable brand mark SVGs (local, offline-safe).
 * Used by SubscriptionLogo / MerchantLogo.
 */

function Wrap({ bg, size, children, pad = 0.18, className = '', title }) {
  const p = Math.round(size * pad)
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 shadow-sm overflow-hidden ${className}`}
      style={{ width: size, height: size, background: bg, padding: p }}
      title={title}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width={size - p * 2} height={size - p * 2} className="block">
        {children}
      </svg>
    </span>
  )
}

/** Netflix classic red tile + white N */
export function LogoNetflix({ size = 40, className }) {
  return (
    <Wrap bg="#E50914" size={size} pad={0.14} className={className} title="Netflix">
      <path
        fill="#fff"
        d="M5 2.5h3.4l5.2 13.8V2.5H18.5V21.5h-3.5L9.7 7.4V21.5H5V2.5z"
      />
    </Wrap>
  )
}

export function LogoSpotify({ size = 40, className }) {
  return (
    <Wrap bg="#1DB954" size={size} pad={0.12} className={className} title="Spotify">
      <circle cx="12" cy="12" r="11" fill="#1DB954" />
      <path fill="#fff" d="M16.8 10.3c-2.3-1.4-6.1-1.5-8.3-.8-.4.1-.7-.1-.8-.4-.1-.4.1-.7.4-.8 2.5-.8 6.7-.6 9.4 1 .3.2.4.6.2.9-.2.3-.6.4-.9.1zm-.3 2.2c-.2.3-.5.4-.8.2-1.9-1.2-4.9-1.5-7.1-.8-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 2.6-.8 5.9-.4 8.1 1 .3.1.4.5.2.8zm-.9 2.1c-.1.2-.4.3-.6.2-1.7-1-3.8-1.3-6.3-.7-.2.1-.5-.1-.5-.3-.1-.2.1-.5.3-.5 2.7-.6 5.1-.3 7 .8.3.1.3.4.1.5z" />
    </Wrap>
  )
}

export function LogoYoutube({ size = 40, className }) {
  return (
    <Wrap bg="#FF0000" size={size} pad={0.16} className={className} title="YouTube">
      <path fill="#fff" d="M21.5 7.2c-.2-.9-.9-1.6-1.8-1.8C18 5 12 5 12 5s-6 0-7.7.4c-.9.2-1.6.9-1.8 1.8C2 9 2 12 2 12s0 3 .5 4.8c.2.9.9 1.6 1.8 1.8C6 19 12 19 12 19s6 0 7.7-.4c.9-.2 1.6-.9 1.8-1.8.5-1.8.5-4.8.5-4.8s0-3-.5-4.8z" />
      <path fill="#FF0000" d="M10 15.2V8.8L15.5 12 10 15.2z" />
    </Wrap>
  )
}

export function LogoAmazon({ size = 40, className }) {
  return (
    <Wrap bg="#232F3E" size={size} pad={0.12} className={className} title="Amazon">
      <text x="12" y="11" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="700" fontFamily="Arial,sans-serif">amazon</text>
      <path fill="none" stroke="#FF9900" strokeWidth="1.6" strokeLinecap="round" d="M5.5 14.5c2.2 1.8 5 2.7 7.8 2.7 2.2 0 4.3-.6 6.2-1.7" />
      <path fill="#FF9900" d="M18.8 14.2l1.4 1.8-.2-2.3z" />
    </Wrap>
  )
}

export function LogoPrime({ size = 40, className }) {
  return (
    <Wrap bg="#00A8E1" size={size} pad={0.1} className={className} title="Amazon Prime">
      <text x="12" y="10.5" textAnchor="middle" fill="#fff" fontSize="6.2" fontWeight="800" fontFamily="Arial,sans-serif">prime</text>
      <path fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" d="M5.2 14.2c2 1.6 4.6 2.4 7.2 2.4 2 0 4-.5 5.8-1.5" />
    </Wrap>
  )
}

export function LogoDisney({ size = 40, className }) {
  return (
    <Wrap bg="#113CCF" size={size} pad={0.1} className={className} title="Disney+">
      <text x="12" y="14.5" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Georgia,serif" fontStyle="italic">Disney+</text>
    </Wrap>
  )
}

export function LogoKfc({ size = 40, className }) {
  return (
    <Wrap bg="#E4002B" size={size} pad={0.12} className={className} title="KFC">
      <circle cx="12" cy="12" r="10" fill="#E4002B" />
      <text x="12" y="11" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif">KFC</text>
      <path fill="#F8E71C" d="M7.5 14.2h9c.2 0 .3.2.2.4-.5 1.4-2.2 2.4-4.7 2.4s-4.2-1-4.7-2.4c-.1-.2 0-.4.2-.4z" />
    </Wrap>
  )
}

export function LogoStarbucks({ size = 40, className }) {
  return (
    <Wrap bg="#00704A" size={size} pad={0.08} className={className} title="Starbucks">
      <circle cx="12" cy="12" r="11" fill="#00704A" />
      <circle cx="12" cy="12" r="9.2" fill="none" stroke="#fff" strokeWidth="1.1" />
      {/* Simplified siren mark */}
      <circle cx="12" cy="9.2" r="2.1" fill="#fff" />
      <path fill="#fff" d="M7.2 16.5c.6-3.2 2.4-5 4.8-5s4.2 1.8 4.8 5c-1.4-.9-3-.9-4.8-.9s-3.4 0-4.8.9z" />
      <path fill="#00704A" d="M10.2 9.1c0-1 .8-1.4 1.8-1.4s1.8.4 1.8 1.4" />
      <path fill="#fff" d="M5.5 8.5c1.2-1.6 2.8-2.4 4.2-2.6-.6 1.1-.8 2.2-.6 3.3-1.4.2-2.6.8-3.6 1.8zm13 0c-1.2-1.6-2.8-2.4-4.2-2.6.6 1.1.8 2.2.6 3.3 1.4.2 2.6.8 3.6 1.8z" />
    </Wrap>
  )
}

export function LogoMcdonalds({ size = 40, className }) {
  return (
    <Wrap bg="#DA291C" size={size} pad={0.1} className={className} title="McDonald's">
      {/* Golden arches */}
      <path
        fill="#FFC72C"
        d="M6.2 19c0-5.2 1.4-12.5 2.9-12.5S12 11.2 12 14.8C12 11.2 13.4 6.5 14.9 6.5S17.8 13.8 17.8 19h-2.2c0-4.2-.9-9.2-1.7-9.2-.8 0-1.7 4.4-1.9 7.5h-.1c-.2-3.1-1.1-7.5-1.9-7.5-.8 0-1.7 5-1.7 9.2H6.2z"
      />
    </Wrap>
  )
}

export function LogoBurgerKing({ size = 40, className }) {
  return (
    <Wrap bg="#502314" size={size} pad={0.1} className={className} title="Burger King">
      <ellipse cx="12" cy="8.5" rx="8" ry="3.2" fill="#F5EBDC" />
      <ellipse cx="12" cy="8.8" rx="7.2" ry="2.2" fill="#FF8732" />
      <rect x="4.5" y="10.5" width="15" height="2.2" rx="0.6" fill="#D62300" />
      <ellipse cx="12" cy="15.5" rx="8" ry="3.2" fill="#F5EBDC" />
      <text x="12" y="13.2" textAnchor="middle" fill="#502314" fontSize="4.2" fontWeight="900" fontFamily="Arial,sans-serif">BK</text>
    </Wrap>
  )
}

export function LogoDominos({ size = 40, className }) {
  return (
    <Wrap bg="#006491" size={size} pad={0.14} className={className} title="Domino's">
      <path fill="#E31837" d="M4 12 L12 4 L20 12 L12 20 Z" />
      <circle cx="9.2" cy="12" r="1.3" fill="#fff" />
      <circle cx="14.8" cy="12" r="1.3" fill="#fff" />
    </Wrap>
  )
}

export function LogoPizzaHut({ size = 40, className }) {
  return (
    <Wrap bg="#EE3A24" size={size} pad={0.12} className={className} title="Pizza Hut">
      <path fill="#fff" d="M4 16.5 L12 5.5 L20 16.5 Z" />
      <path fill="#EE3A24" d="M7.2 15 L12 8.2 L16.8 15 Z" />
      <rect x="5" y="16.2" width="14" height="2.2" rx="0.4" fill="#fff" />
    </Wrap>
  )
}

export function LogoSubway({ size = 40, className }) {
  return (
    <Wrap bg="#FFC600" size={size} pad={0.08} className={className} title="Subway">
      <text x="12" y="15" textAnchor="middle" fill="#008C15" fontSize="6.5" fontWeight="900" fontFamily="Arial Black,Arial,sans-serif" fontStyle="italic">SUB</text>
    </Wrap>
  )
}

export function LogoZomato({ size = 40, className }) {
  return (
    <Wrap bg="#E23744" size={size} pad={0.08} className={className} title="Zomato">
      <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="800" fontFamily="Arial,sans-serif">zomato</text>
    </Wrap>
  )
}

export function LogoSwiggy({ size = 40, className }) {
  return (
    <Wrap bg="#FC8019" size={size} pad={0.14} className={className} title="Swiggy">
      <path fill="#fff" d="M12 3.5c-2.8 3.8-5.5 7.2-5.5 10.2 0 3.2 2.4 5.8 5.5 5.8s5.5-2.6 5.5-5.8C17.5 10.7 14.8 7.3 12 3.5zm0 13.2c-1.5 0-2.7-1.3-2.7-3 0-1.7 1.2-3.6 2.7-5.7 1.5 2.1 2.7 4 2.7 5.7 0 1.7-1.2 3-2.7 3z" />
    </Wrap>
  )
}

export function LogoUber({ size = 40, className }) {
  return (
    <Wrap bg="#000" size={size} pad={0.1} className={className} title="Uber">
      <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif">Uber</text>
    </Wrap>
  )
}

export function LogoBlinkit({ size = 40, className }) {
  return (
    <Wrap bg="#F8C51B" size={size} pad={0.08} className={className} title="Blinkit">
      <text x="12" y="15" textAnchor="middle" fill="#1a1a1a" fontSize="5.2" fontWeight="900" fontFamily="Arial,sans-serif">blinkit</text>
    </Wrap>
  )
}

export function LogoZepto({ size = 40, className }) {
  return (
    <Wrap bg="#FF2E63" size={size} pad={0.1} className={className} title="Zepto">
      <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="6.5" fontWeight="800" fontFamily="Arial,sans-serif">zepto</text>
    </Wrap>
  )
}

/** PhonePe app icon: #5F259F + white पे */
export function LogoPhonePe({ size = 40, className }) {
  return (
    <Wrap bg="#5F259F" size={size} pad={0.02} className={className} title="PhonePe">
      <text
        x="12"
        y="16.8"
        textAnchor="middle"
        fill="#fff"
        fontSize="14"
        fontWeight="700"
        fontFamily="'Noto Sans Devanagari', 'Mangal', 'Nirmala UI', 'Arial Unicode MS', sans-serif"
      >
        पे
      </text>
    </Wrap>
  )
}

export function LogoGpay({ size = 40, className }) {
  return (
    <Wrap bg="#fff" size={size} pad={0.14} className={`ring-1 ring-slate-200 ${className || ''}`} title="Google Pay">
      <path fill="#4285F4" d="M12 10.8v2.5h5.5c-.2 1.4-1.7 4-5.5 4-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.6-2.5C17.1 2.8 14.8 1.8 12 1.8 7 1.8 3 5.9 3 10.9S7 20 12 20c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.5H12z" />
    </Wrap>
  )
}

/** Paytm app icon: #00BAF2 + white Paytm wordmark */
export function LogoPaytm({ size = 40, className }) {
  return (
    <Wrap bg="#00BAF2" size={size} pad={0.02} className={className} title="Paytm">
      <text
        x="12"
        y="15.2"
        textAnchor="middle"
        fill="#fff"
        fontSize="7.4"
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
        letterSpacing="-0.55"
      >
        Paytm
      </text>
    </Wrap>
  )
}

export function LogoJio({ size = 40, className }) {
  return (
    <Wrap bg="#0A2885" size={size} pad={0.12} className={className} title="Jio">
      <text x="12" y="15.5" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="700" fontFamily="Arial,sans-serif">Jio</text>
    </Wrap>
  )
}

export function LogoAirtel({ size = 40, className }) {
  return (
    <Wrap bg="#ED1C24" size={size} pad={0.1} className={className} title="Airtel">
      <text x="12" y="15" textAnchor="middle" fill="#fff" fontSize="5.5" fontWeight="800" fontFamily="Arial,sans-serif">airtel</text>
    </Wrap>
  )
}

export function LogoFlipkart({ size = 40, className }) {
  return (
    <Wrap bg="#2874F0" size={size} pad={0.12} className={className} title="Flipkart">
      <path fill="#FFE11B" d="M7 7.5h4.2c2.2 0 3.5 1.1 3.5 2.9 0 1.5-.8 2.5-2.1 2.9L15.5 17h-2.6l-2.5-3.4H9.2V17H7V7.5zm2.2 1.8v2.8h1.7c1 0 1.5-.5 1.5-1.4s-.5-1.4-1.5-1.4H9.2z" />
    </Wrap>
  )
}

export function LogoOla({ size = 40, className }) {
  return (
    <Wrap bg="#CDDC39" size={size} pad={0.1} className={className} title="Ola">
      <text x="12" y="15.5" textAnchor="middle" fill="#1a1a1a" fontSize="9" fontWeight="800" fontFamily="Arial,sans-serif">ola</text>
    </Wrap>
  )
}

export function LogoApple({ size = 40, className }) {
  return (
    <Wrap bg="#111" size={size} pad={0.16} className={className} title="Apple">
      <path fill="#fff" d="M16.2 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.6.8-3.3 2-.1.2-1.4 3.7.9 6.2.6.7 1.2 1.4 2.1 1.4.8 0 1.1-.5 2.1-.5s1.2.5 2.1.5c.9 0 1.4-.7 2-1.4.6-.8.9-1.6.9-1.6s-1.7-.7-1.8-2.8zM14.3 6.3c.5-.6.8-1.4.7-2.3-.7 0-1.6.5-2.1 1.1-.5.5-.9 1.4-.8 2.2.8.1 1.6-.4 2.2-1z" />
    </Wrap>
  )
}

export function LogoLetter({ brand, size = 40, className }) {
  const darkText = brand?.id === 'blinkit' || brand?.id === 'ola' || brand?.id === 'subway'
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-bold shrink-0 shadow-sm ${className || ''}`}
      style={{
        width: size,
        height: size,
        background: brand?.color || '#64748b',
        fontSize: (brand?.letter || '?').length > 1 ? size * 0.28 : size * 0.42,
        color: darkText ? '#1a1a1a' : '#fff',
      }}
      title={brand?.name}
      aria-hidden
    >
      {brand?.letter || '?'}
    </span>
  )
}

export const BRAND_LOGO_COMPONENTS = {
  netflix: LogoNetflix,
  spotify: LogoSpotify,
  youtube: LogoYoutube,
  amazon: LogoAmazon,
  amazonprime: LogoPrime,
  disney: LogoDisney,
  kfc: LogoKfc,
  starbucks: LogoStarbucks,
  mcdonalds: LogoMcdonalds,
  burgerking: LogoBurgerKing,
  dominos: LogoDominos,
  pizzahut: LogoPizzaHut,
  subway: LogoSubway,
  zomato: LogoZomato,
  swiggy: LogoSwiggy,
  uber: LogoUber,
  blinkit: LogoBlinkit,
  zepto: LogoZepto,
  phonepe: LogoPhonePe,
  gpay: LogoGpay,
  paytm: LogoPaytm,
  jio: LogoJio,
  airtel: LogoAirtel,
  flipkart: LogoFlipkart,
  ola: LogoOla,
  apple: LogoApple,
}
