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

/**
 * Real brand SVG (sourced from Wikimedia Commons official logo files) whose native
 * artwork is a wide icon+wordmark lockup. "xMinYMid slice" scales to fill the circle
 * by height and anchors left, so the leading icon mark fills the badge and the
 * trailing wordmark is cropped off — no manual coordinate cropping needed.
 */
function WrapCrop({ viewBox, children, bg = '#fff', size, className = '', title, align = 'xMinYMid' }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 shadow-sm overflow-hidden ${className}`}
      style={{ width: size, height: size, background: bg }}
      title={title}
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio={`${align} slice`}>
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

/** PhonePe: real mark (Wikimedia Commons File:PhonePe_Logo.svg), cropped to the icon. */
export function LogoPhonePe({ size = 40, className }) {
  return (
    <WrapCrop viewBox="0 0 230 69.746292" size={size} className={className} title="PhonePe">
      <circle transform="rotate(-76.714)" fill="#5f259f" cx="-25.925503" cy="41.954033" r="29.873146" />
      <path
        fill="#ffffff"
        d="m48.431347,27.0768 c 0,-1.168224 -1.001334,-2.169558 -2.169557,-2.169558 h -4.005338 l -9.1789,-10.514013 c -0.834446,-1.001335 -2.169559,-1.335113 -3.504671,-1.001335 l -3.170893,1.001335 c -0.500667,0.166889 -0.667556,0.834445 -0.333778,1.168223 l 10.013345,9.512679 H 20.894648 c -0.500667,0 -0.834445,0.333778 -0.834445,0.834445 v 1.668891 c 0,1.168224 1.001334,2.169558 2.169558,2.169558 h 2.336448 v 8.010676 c 0,6.008008 3.170892,9.512678 8.511343,9.512678 1.668891,0 3.004003,-0.166889 4.672894,-0.834445 v 5.340451 c 0,1.502002 1.168224,2.670225 2.670225,2.670225 h 2.336448 c 0.500667,0 1.001335,-0.500667 1.001335,-1.001334 v -23.86514 h 3.838448 c 0.500667,0 0.834445,-0.333778 0.834445,-0.834445 z M 37.750446,41.429261 c -1.001334,0.500668 -2.336447,0.667557 -3.337781,0.667557 -2.670226,0 -4.005339,-1.335114 -4.005339,-4.339117 v -8.010676 h 7.34312 z"
      />
    </WrapCrop>
  )
}

/** Google Pay: real mark (Wikimedia Commons File:Google_Pay_2018_icon.svg), full self-contained badge. */
export function LogoGpay({ size = 40, className }) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 shadow-sm overflow-hidden ring-1 ring-slate-200 ${className || ''}`}
      style={{ width: size, height: size }}
      title="Google Pay"
      aria-hidden
    >
      <svg width="100%" height="100%" viewBox="0 0 512 512">
        <circle fill="#ffffff" cx="256" cy="256" r="256" />
        <g id="g15324">
          <path fill="#EA4335" d="m 109.14316,218.19895 c 8.95768,-0.17374 17.56748,3.21414 24.0031,9.38179 l 17.82839,-17.80802 c -11.30581,-10.68484 -26.26426,-16.50503 -41.83149,-16.33129 -23.655241,0 -45.310215,13.37775 -55.920284,34.48678 l 20.785297,16.15755 c 4.957163,-14.85452 18.785034,-25.88681 35.134987,-25.88681 z" />
          <path fill="#FBBC04" d="m 53.222876,227.92821 c -8.957681,17.63431 -8.957681,38.48274 0,56.11705 l 20.785297,-16.15755 c -2.609033,-7.7313 -2.609033,-16.15754 0,-23.97568 z" />
          <path fill="#34A853" d="m 130.45026,287.7806 c -5.6529,3.82221 -12.87123,5.99392 -21.3071,5.99392 -16.349953,0 -30.177824,-11.0323 -35.134987,-25.79994 l -20.785297,16.07068 c 10.610069,21.19589 32.265043,34.48678 55.920284,34.48678 16.87174,0 31.13446,-5.5596 41.48362,-15.11512 z" />
          <path fill="#4285F4" d="m 168.19427,244.69382 h -59.05111 v 24.06258 h 33.83046 c -1.39148,7.7313 -5.91381,14.68077 -12.52336,19.0242 l 20.17652,15.63632 c 11.82762,-10.85856 18.6111,-27.0161 18.6111,-46.0403 0,-4.25655 -0.34787,-8.5131 -1.04361,-12.6828 z" />
          <path
            fill="#ffffff"
            d="m 424.8422,300.49182 -30.88012,-69.77571 h 17.70853 l 20.95245,50.37749 h 0.72892 l 20.29336,-50.37749 h 17.55582 l -45.79455,105.09785 h -16.85725 z M 358.8434,229.35648 c -6.2912,0 -12.09747,1.25739 -17.4208,3.77342 -5.22653,2.51601 -9.43621,6.04812 -12.63017,10.59631 l 0.4429,0.33955 c -0.007,0.009 -0.0132,0.0168 -0.0192,0.0256 l 10.59328,8.16825 c 2.00424,-2.86602 4.67673,-5.11126 8.01715,-6.73533 3.34039,-1.71962 6.87108,-2.57969 10.59326,-2.57969 5.4401,0 9.87897,1.48029 13.31485,4.44183 3.43586,2.86602 5.15435,6.63909 5.15435,11.32026 v 3.63461 c -2.10321,-1.01633 -4.86384,-1.90159 -8.3167,-2.64802 -3.48435,-0.87093 -7.40607,-1.30692 -11.7615,-1.30692 -5.71047,0 -10.98334,0.91499 -15.62914,2.94716 -4.64582,1.9354 -8.39232,4.89162 -11.10238,8.66565 -2.71005,3.67727 -3.90142,8.08134 -3.90142,13.21016 0,4.83849 1.16254,9.14355 3.48544,12.9176 2.32291,3.77404 5.56487,6.72697 9.7267,8.8559 4.16188,2.03217 8.90517,3.04735 14.22847,3.04735 5.03295,0 9.53273,-1.06364 13.50101,-3.19257 3.96831,-2.2257 6.92913,-4.98484 9.05844,-8.27504 h 0.62264 v 9.14419 h 15.58143 v -46.3039 c 0,-9.48348 -2.79541,-16.78558 -8.69943,-22.01115 -5.80726,-5.32236 -14.19249,-8.03524 -24.83912,-8.03524 z m 0.7724,41.04846 c 3.2276,0 6.3132,0.37897 9.256,1.13608 2.94281,0.75709 5.55271,1.79718 7.83102,3.12208 0,3.59622 -0.75342,6.80513 -2.55709,9.92814 -1.70872,3.12302 -4.27875,5.782 -7.41141,7.67474 -3.13266,1.79811 -6.59498,2.69712 -10.39214,2.69712 -4.27181,0 -7.69214,-1.09066 -10.2552,-3.2673 -2.56311,-2.17666 -3.84275,-4.96634 -3.84275,-8.37327 0,-3.88012 1.37653,-7.00463 4.12946,-9.37054 2.8479,-2.36595 7.26156,-3.54705 13.24211,-3.54705 z M 253.04096,202.27869 h 35.69302 q 9.28598,0 16.97595,4.04871 7.83504,4.04872 12.33294,11.27857 4.643,7.22985 4.643,16.33946 0,9.1096 -4.643,16.33946 -4.4979,7.22985 -12.33294,11.27856 -7.68997,4.04873 -16.97595,4.04873 h -19.73274 v 40.19796 h -15.96028 z m 36.1283,48.29539 q 7.98015,0 12.76823,-4.9163 4.93319,-5.06088 4.93319,-11.71235 0,-6.65147 -4.93319,-11.56775 -4.78808,-5.06091 -12.76823,-5.06091 h -20.16802 v 33.25731 z"
          />
        </g>
      </svg>
    </span>
  )
}

/** Paytm: real wordmark (Wikimedia Commons File:Paytm_Logo_(standalone).svg), cropped to the "P". */
export function LogoPaytm({ size = 40, className }) {
  return (
    <WrapCrop viewBox="0 0 16.837998 5.2849998" size={size} className={className} title="Paytm">
      <g transform="matrix(0.35277777,0,0,-0.35277777,1.7417071,2.2279886)">
        <path
          fill="#233266"
          d="m 0,0 v -0.992 -0.32 c 0,-0.275 -0.223,-0.499 -0.498,-0.499 l -1.349,-0.001 v 2.629 h 1.349 C -0.223,0.817 0,0.595 0,0.319 Z M 0.187,3.896 H -4.46 c -0.255,0 -0.461,-0.207 -0.461,-0.461 V 1.352 c 0,-0.004 0.001,-0.008 0.001,-0.012 0,-0.01 -0.001,-0.02 -0.001,-0.029 V -5.37 -8.117 c 0,-0.256 0.192,-0.465 0.43,-0.471 h 0.04 2.126 c 0.259,0 0.47,0.21 0.47,0.47 l 0.008,3.231 h 2.034 c 1.702,0 2.888,1.181 2.888,2.89 v 2.999 c 0,1.709 -1.186,2.894 -2.888,2.894"
        />
      </g>
      <g transform="matrix(0.35277777,0,0,-0.35277777,4.8535941,3.9887686)">
        <path
          fill="#233266"
          d="M 0,0 V -0.332 C 0,-0.359 -0.004,-0.385 -0.008,-0.41 -0.013,-0.434 -0.02,-0.457 -0.028,-0.479 -0.094,-0.665 -0.28,-0.8 -0.501,-0.8 h -0.885 c -0.276,0 -0.501,0.21 -0.501,0.468 v 0.401 c 0,0.005 -0.001,0.01 -0.001,0.015 l 0.001,1.067 v 0.002 0.118 0.214 l 0.001,0.003 c 0.001,0.257 0.224,0.465 0.5,0.465 h 0.885 C -0.224,1.953 0,1.744 0,1.485 Z m -0.338,8.875 h -2.95 C -3.549,8.875 -3.76,8.677 -3.76,8.434 V 7.607 c 0,-0.005 0.001,-0.011 0.001,-0.016 0,-0.006 -0.001,-0.012 -0.001,-0.018 V 6.44 c 0,-0.257 0.224,-0.467 0.5,-0.467 h 2.809 c 0.222,-0.035 0.398,-0.197 0.423,-0.45 V 5.249 C -0.053,5.008 -0.227,4.832 -0.439,4.812 H -1.83 c -1.85,0 -3.168,-1.229 -3.168,-2.955 v -2.409 -0.063 c 0,-1.716 1.133,-2.937 2.97,-2.937 h 3.855 c 0.692,0 1.253,0.524 1.253,1.169 v 8.067 c 0,1.956 -1.008,3.191 -3.418,3.191"
        />
      </g>
      <g transform="matrix(0.35277777,0,0,-0.35277777,9.0012361,0.85374862)">
        <path
          fill="#233266"
          d="M 0,0 H -2.126 C -2.385,0 -2.595,-0.211 -2.595,-0.47 V -4.866 C -2.6,-5.138 -2.82,-5.356 -3.093,-5.356 h -0.89 c -0.276,0 -0.499,0.222 -0.499,0.498 L -4.49,-0.47 C -4.49,-0.211 -4.701,0 -4.96,0 h -2.126 c -0.26,0 -0.47,-0.211 -0.47,-0.47 v -4.818 c 0,-1.83 1.305,-3.135 3.136,-3.135 0,0 1.374,0 1.416,-0.008 0.248,-0.028 0.441,-0.236 0.441,-0.492 0,-0.253 -0.189,-0.46 -0.434,-0.491 -0.012,-0.002 -0.023,-0.005 -0.036,-0.007 l -3.109,-0.011 c -0.26,0 -0.47,-0.211 -0.47,-0.47 v -2.125 c 0,-0.26 0.21,-0.47 0.47,-0.47 h 3.476 c 1.832,0 3.136,1.304 3.136,3.135 V -0.47 C 0.47,-0.211 0.26,0 0,0"
        />
      </g>
      <g transform="matrix(0.35277777,0,0,-0.35277777,11.699676,0.85374862)">
        <path
          fill="#54c1f0"
          d="m 0,0 h -1.216 v 1.97 0 c 0,0.002 0,0.004 0,0.006 0,0.237 -0.192,0.429 -0.429,0.429 C -1.673,2.405 -1.7,2.401 -1.726,2.396 -3.074,2.026 -2.804,0.159 -5.265,0 H -5.32 -5.504 c -0.036,0 -0.07,-0.005 -0.103,-0.012 h -0.002 l 0.002,-0.001 C -5.817,-0.06 -5.975,-0.246 -5.975,-0.47 v -2.126 c 0,-0.259 0.211,-0.47 0.471,-0.47 h 1.283 l -0.002,-9.015 c 0,-0.257 0.208,-0.465 0.465,-0.465 h 2.102 c 0.256,0 0.464,0.208 0.464,0.465 l 0.001,9.015 H 0 c 0.259,0 0.47,0.211 0.47,0.47 V -0.47 C 0.47,-0.211 0.259,0 0,0"
        />
      </g>
      <g transform="matrix(0.35277777,0,0,-0.35277777,16.777056,1.5610286)">
        <path
          fill="#54c1f0"
          d="M 0,0 C -0.433,1.238 -1.613,2.127 -2.999,2.127 H -3.028 C -3.929,2.127 -4.741,1.752 -5.319,1.15 -5.898,1.752 -6.71,2.127 -7.61,2.127 h -0.029 c -0.792,0 -1.516,-0.29 -2.072,-0.77 V 1.601 C -9.73,1.844 -9.93,2.035 -10.177,2.035 h -2.126 c -0.26,0 -0.47,-0.21 -0.47,-0.471 V -9.981 c 0,-0.261 0.21,-0.471 0.47,-0.471 h 2.126 c 0.237,0 0.432,0.177 0.463,0.406 l -0.001,8.288 c 0,0.029 0.001,0.056 0.004,0.083 0.034,0.37 0.305,0.674 0.733,0.712 h 0.079 0.223 0.09 c 0.179,-0.016 0.33,-0.079 0.449,-0.174 0.185,-0.147 0.288,-0.373 0.288,-0.621 l 0.008,-8.247 c 0,-0.261 0.211,-0.472 0.47,-0.472 h 2.126 c 0.251,0 0.455,0.2 0.467,0.449 l -0.001,8.281 c -0.001,0.272 0.125,0.518 0.346,0.664 0.109,0.07 0.24,0.117 0.391,0.131 h 0.079 0.223 0.09 c 0.46,-0.04 0.738,-0.389 0.737,-0.795 l 0.008,-8.236 c 0,-0.261 0.211,-0.471 0.47,-0.471 h 2.126 c 0.259,0 0.47,0.21 0.47,0.471 v 8.858 C 0.161,-0.521 0.093,-0.264 0,0"
        />
      </g>
    </WrapCrop>
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

function LogoText({
  bg, title, text, size = 40, color = '#fff', fontSize = 6, className = '', pad = 0.08, ring = false,
}) {
  return (
    <Wrap
      bg={bg}
      size={size}
      pad={pad}
      className={`${ring ? 'ring-1 ring-slate-200 ' : ''}${className}`}
      title={title}
    >
      <text
        x="12"
        y="15"
        textAnchor="middle"
        fill={color}
        fontSize={fontSize}
        fontWeight="800"
        fontFamily="Arial, Helvetica, sans-serif"
      >
        {text}
      </text>
    </Wrap>
  )
}

export function LogoBigBasket({ size = 40, className }) {
  return <LogoText bg="#84C225" title="BigBasket" text="bb" size={size} fontSize={9} className={className} />
}

export function LogoDunzo({ size = 40, className }) {
  return <LogoText bg="#00D26A" title="Dunzo" text="dunzo" size={size} color="#0a0a0a" fontSize={5} className={className} />
}

export function LogoRapido({ size = 40, className }) {
  return (
    <Wrap bg="#F9A825" size={size} pad={0.12} className={className} title="Rapido">
      <path fill="#1a1a1a" d="M6 16.5c1.2-4 3-8.5 6-11.5 3 3 4.8 7.5 6 11.5-1.8-.8-3.8-1.2-6-1.2s-4.2.4-6 1.2z" />
      <circle cx="12" cy="9" r="1.6" fill="#fff" />
    </Wrap>
  )
}

export function LogoIrctc({ size = 40, className }) {
  return <LogoText bg="#213D77" title="IRCTC" text="IRCTC" size={size} fontSize={5.2} className={className} />
}

export function LogoMakeMyTrip({ size = 40, className }) {
  return <LogoText bg="#E31837" title="MakeMyTrip" text="MMT" size={size} fontSize={7} className={className} />
}

export function LogoRedbus({ size = 40, className }) {
  return <LogoText bg="#D84E55" title="redBus" text="redBus" size={size} fontSize={5} className={className} />
}

export function LogoMyntra({ size = 40, className }) {
  return <LogoText bg="#FF3F6C" title="Myntra" text="Myntra" size={size} fontSize={5} className={className} />
}

export function LogoAjio({ size = 40, className }) {
  return <LogoText bg="#2C2C54" title="AJIO" text="AJIO" size={size} fontSize={7} className={className} />
}

export function LogoMeesho({ size = 40, className }) {
  return <LogoText bg="#F43397" title="Meesho" text="Meesho" size={size} fontSize={5} className={className} />
}

export function LogoJioMart({ size = 40, className }) {
  return <LogoText bg="#0A2885" title="JioMart" text="JioMart" size={size} fontSize={4.5} className={className} />
}

export function LogoNykaa({ size = 40, className }) {
  return <LogoText bg="#FC2779" title="Nykaa" text="Nykaa" size={size} fontSize={5.5} className={className} />
}

export function LogoVi({ size = 40, className }) {
  return <LogoText bg="#EE2737" title="Vi" text="Vi" size={size} fontSize={10} className={className} />
}

export function LogoCred({ size = 40, className }) {
  return <LogoText bg="#1A1A1A" title="CRED" text="CRED" size={size} fontSize={6.5} className={className} />
}

export function LogoTataPlay({ size = 40, className }) {
  return <LogoText bg="#E31837" title="Tata Play" text="Tata" size={size} fontSize={6.5} className={className} />
}

export function LogoZee5({ size = 40, className }) {
  return <LogoText bg="#8230C9" title="ZEE5" text="ZEE5" size={size} fontSize={7} className={className} />
}

export function LogoSonyLiv({ size = 40, className }) {
  return <LogoText bg="#000" title="SonyLIV" text="LIV" size={size} fontSize={8} className={className} />
}

export function LogoGaana({ size = 40, className }) {
  return <LogoText bg="#E72C30" title="Gaana" text="gaana" size={size} fontSize={5.5} className={className} />
}

export function LogoWynk({ size = 40, className }) {
  return <LogoText bg="#E4002B" title="Wynk" text="Wynk" size={size} fontSize={6.5} className={className} />
}

export function LogoLinkedIn({ size = 40, className }) {
  return <LogoText bg="#0A66C2" title="LinkedIn" text="in" size={size} fontSize={10} className={className} />
}

export function LogoMicrosoft({ size = 40, className }) {
  return (
    <Wrap bg="#fff" size={size} pad={0.18} className={`ring-1 ring-slate-200 ${className || ''}`} title="Microsoft">
      <rect x="2" y="2" width="9" height="9" fill="#F25022" />
      <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
      <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
      <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
    </Wrap>
  )
}

export function LogoGoogleOne({ size = 40, className }) {
  return <LogoText bg="#4285F4" title="Google One" text="One" size={size} fontSize={7.5} className={className} />
}

export function LogoDmart({ size = 40, className }) {
  return <LogoText bg="#0078C1" title="DMart" text="DMart" size={size} fontSize={5.5} className={className} />
}

export function LogoBookMyShow({ size = 40, className }) {
  return <LogoText bg="#C4242B" title="BookMyShow" text="BMS" size={size} fontSize={7} className={className} />
}

export function LogoPvr({ size = 40, className }) {
  return <LogoText bg="#1B1B1B" title="PVR" text="PVR" size={size} fontSize={8} className={className} />
}

export function LogoCultfit({ size = 40, className }) {
  return <LogoText bg="#111" title="Cult.fit" text="cult" size={size} fontSize={6.5} className={className} />
}

export function LogoUrbanCompany({ size = 40, className }) {
  return <LogoText bg="#6E3FF3" title="Urban Company" text="UC" size={size} fontSize={9} className={className} />
}

export function LogoPharmeasy({ size = 40, className }) {
  return <LogoText bg="#10847E" title="PharmEasy" text="PE" size={size} fontSize={9} className={className} />
}

export function Logo1mg({ size = 40, className }) {
  return <LogoText bg="#FF6F61" title="1mg" text="1mg" size={size} fontSize={7.5} className={className} />
}

export function LogoLenskart({ size = 40, className }) {
  return <LogoText bg="#00BAC6" title="Lenskart" text="LK" size={size} fontSize={9} className={className} />
}

export function LogoCroma({ size = 40, className }) {
  return <LogoText bg="#00B1A4" title="Croma" text="croma" size={size} fontSize={5.5} className={className} />
}

export function LogoDecathlon({ size = 40, className }) {
  return <LogoText bg="#0082C3" title="Decathlon" text="DEC" size={size} fontSize={7} className={className} />
}

export function LogoIndigo({ size = 40, className }) {
  return <LogoText bg="#003366" title="IndiGo" text="6E" size={size} fontSize={9} className={className} />
}

export function LogoAirIndia({ size = 40, className }) {
  return <LogoText bg="#DA0C0C" title="Air India" text="AI" size={size} fontSize={9} className={className} />
}

export function LogoGoibibo({ size = 40, className }) {
  return <LogoText bg="#FE5B00" title="Goibibo" text="go" size={size} fontSize={9} className={className} />
}

export function LogoGroww({ size = 40, className }) {
  return <LogoText bg="#00B386" title="Groww" text="Groww" size={size} fontSize={5.5} className={className} />
}

export function LogoZerodha({ size = 40, className }) {
  return <LogoText bg="#387ED1" title="Zerodha" text="Kite" size={size} fontSize={6.5} className={className} />
}

export function LogoHdfc({ size = 40, className }) {
  return <LogoText bg="#004C8F" title="HDFC Bank" text="HDFC" size={size} fontSize={5.5} className={className} />
}

export function LogoSbi({ size = 40, className }) {
  return (
    <Wrap bg="#22409A" size={size} pad={0.14} className={className} title="SBI">
      <circle cx="12" cy="12" r="8" fill="none" stroke="#F7A81B" strokeWidth="2.2" />
      <circle cx="12" cy="12" r="3.2" fill="#F7A81B" />
    </Wrap>
  )
}

export function LogoIcici({ size = 40, className }) {
  return <LogoText bg="#F58220" title="ICICI Bank" text="ICICI" size={size} fontSize={5} className={className} />
}

export function LogoAxis({ size = 40, className }) {
  return <LogoText bg="#97144D" title="Axis Bank" text="AXIS" size={size} fontSize={6} className={className} />
}

export function LogoKotak({ size = 40, className }) {
  return <LogoText bg="#ED1C24" title="Kotak" text="Kotak" size={size} fontSize={5.5} className={className} />
}

export function LogoHaldiram({ size = 40, className }) {
  return <LogoText bg="#C8102E" title="Haldiram's" text="Haldi" size={size} fontSize={5.5} className={className} />
}

export function LogoCcd({ size = 40, className }) {
  return <LogoText bg="#4B2C20" title="Cafe Coffee Day" text="CCD" size={size} fontSize={7} className={className} />
}

export function LogoWowMomo({ size = 40, className }) {
  return <LogoText bg="#E31E24" title="Wow! Momo" text="WOW" size={size} fontSize={6.5} className={className} />
}

export function LogoBaskin({ size = 40, className }) {
  return <LogoText bg="#D71921" title="Baskin Robbins" text="31" size={size} fontSize={10} className={className} />
}

export function LogoTacoBell({ size = 40, className }) {
  return <LogoText bg="#702082" title="Taco Bell" text="TB" size={size} fontSize={9} className={className} />
}

export function LogoFaasos({ size = 40, className }) {
  return <LogoText bg="#FF6B00" title="Faasos" text="Faasos" size={size} fontSize={5} className={className} />
}

export function LogoBehrouz({ size = 40, className }) {
  return <LogoText bg="#7A1F1F" title="Behrouz" text="Beh" size={size} fontSize={7} className={className} />
}

export function LogoInstamart({ size = 40, className }) {
  return <LogoText bg="#FC8019" title="Instamart" text="IM" size={size} fontSize={9} className={className} />
}

export function LogoRelianceFresh({ size = 40, className }) {
  return <LogoText bg="#E31837" title="Reliance Fresh" text="Fresh" size={size} fontSize={5.5} className={className} />
}

export function LogoMore({ size = 40, className }) {
  return <LogoText bg="#E30613" title="More" text="More" size={size} fontSize={6.5} className={className} />
}

export function LogoApollo({ size = 40, className }) {
  return <LogoText bg="#0B6E4F" title="Apollo" text="Apollo" size={size} fontSize={5} className={className} />
}

/** BHIM: real tricolor accent mark (Wikimedia Commons File:BHIM_logo.svg), right edge of the lockup. */
export function LogoBhim({ size = 40, className }) {
  return (
    <WrapCrop viewBox="0 0 32.169999 7.9569997" size={size} className={className} title="BHIM" align="xMaxYMid">
      <path fill="#008c44" d="m0 0 4.466-8.881-9.388-8.88z" transform="matrix(.35277777 0 0 -.35277777 30.587739 .009974)" />
      <path fill="#f47920" d="m0 0 4.462-8.881-9.392-8.88z" transform="matrix(.35277777 0 0 -.35277777 29.48358 .009974)" />
    </WrapCrop>
  )
}

export function LogoChaayos({ size = 40, className }) {
  return <LogoText bg="#6B2D5B" title="Chaayos" text="Chai" size={size} fontSize={6.5} className={className} />
}

export function LogoChaiPoint({ size = 40, className }) {
  return <LogoText bg="#C45C26" title="Chai Point" text="CP" size={size} fontSize={9} className={className} />
}

export function LogoBlueTokai({ size = 40, className }) {
  return <LogoText bg="#1B4F72" title="Blue Tokai" text="BT" size={size} fontSize={9} className={className} />
}

export function LogoThirdWave({ size = 40, className }) {
  return <LogoText bg="#2C1810" title="Third Wave" text="TW" size={size} fontSize={9} className={className} />
}

export function LogoCosta({ size = 40, className }) {
  return <LogoText bg="#6D1F2C" title="Costa Coffee" text="Costa" size={size} fontSize={5.5} className={className} />
}

export function LogoBarista({ size = 40, className }) {
  return <LogoText bg="#5C3317" title="Barista" text="Bar" size={size} fontSize={8} className={className} />
}

export function LogoSaravana({ size = 40, className }) {
  return <LogoText bg="#E85D04" title="Saravana Bhavan" text="SB" size={size} fontSize={9} className={className} />
}

export function LogoSagarRatna({ size = 40, className }) {
  return <LogoText bg="#0B6E4F" title="Sagar Ratna" text="SR" size={size} fontSize={9} className={className} />
}

export function LogoChineseWok({ size = 40, className }) {
  return <LogoText bg="#C41E3A" title="Chinese Wok" text="CW" size={size} fontSize={9} className={className} />
}

export function LogoMainlandChina({ size = 40, className }) {
  return <LogoText bg="#8B0000" title="Mainland China" text="MC" size={size} fontSize={9} className={className} />
}

/** Generic drink / food marks when merchant name is the food itself */
export function LogoCoffee({ size = 40, className }) {
  return (
    <Wrap bg="#6F4E37" size={size} pad={0.14} className={className} title="Coffee">
      <path fill="#fff" d="M7 8h8.5c.8 0 1.5.7 1.5 1.5v.5h.8c1.2 0 2.2 1 2.2 2.2S19 14.4 17.8 14.4H17v.3c0 2.4-2 4.3-4.5 4.3H9.5C7 19 5 17.1 5 14.7V9.5C5 8.7 5.7 8 6.5 8H7zm10 4.4h.8c.5 0 .9-.4.9-.9s-.4-.9-.9-.9H17v1.8z" />
      <path fill="none" stroke="#D7CCC8" strokeWidth="1.1" strokeLinecap="round" d="M9.5 5.2c.4-1 1.2-1.5 1.8-1.5M12.2 5c.5-1.1 1.4-1.6 2.1-1.5" />
    </Wrap>
  )
}

export function LogoTea({ size = 40, className }) {
  return (
    <Wrap bg="#2E7D32" size={size} pad={0.14} className={className} title="Tea / Chai">
      <path fill="#fff" d="M6.5 9h9c.8 0 1.5.7 1.5 1.5v4.2c0 2.3-1.9 4.2-4.2 4.2H9.2C6.9 18.9 5 17 5 14.7v-4.2C5 9.7 5.7 9 6.5 9zm11 2.2h1c1.1 0 2 .9 2 2s-.9 2-2 2h-1v-4z" />
      <path fill="none" stroke="#A5D6A7" strokeWidth="1.2" strokeLinecap="round" d="M9 5.5c.5-1.2 1.4-1.8 2.2-1.8M12.5 5.2c.6-1.3 1.6-1.9 2.4-1.7" />
      <ellipse cx="11.2" cy="13.2" rx="3.2" ry="1.1" fill="#81C784" opacity="0.85" />
    </Wrap>
  )
}

export function LogoLimbuPani({ size = 40, className }) {
  return (
    <Wrap bg="#F4D03F" size={size} pad={0.12} className={className} title="Limbu Pani">
      <path fill="#F9A825" d="M8 7.5h8v1.2c0 .4-.3.7-.7.7H8.7c-.4 0-.7-.3-.7-.7V7.5z" />
      <path fill="#FFF8E1" d="M8.2 9.2h7.6v8.2c0 1.4-1.2 2.5-2.6 2.5h-2.4c-1.4 0-2.6-1.1-2.6-2.5V9.2z" />
      <path fill="#C6FF00" d="M9 11.5h6v4.5c0 .8-.7 1.4-1.5 1.4h-3c-.8 0-1.5-.6-1.5-1.4v-4.5z" opacity="0.9" />
      <circle cx="16.8" cy="6.8" r="2.4" fill="#FFEB3B" stroke="#F9A825" strokeWidth="0.8" />
      <path fill="#F9A825" d="M16.8 4.2v1.2M15.2 5.5l.9.7M18.4 5.5l-.9.7" stroke="#F9A825" strokeWidth="0.7" />
    </Wrap>
  )
}

export function LogoJuice({ size = 40, className }) {
  return (
    <Wrap bg="#FF8C00" size={size} pad={0.14} className={className} title="Juice">
      <path fill="#fff" d="M9 5.5h6l.8 2.2H8.2L9 5.5z" />
      <path fill="#FFE0B2" d="M8.5 8h7v10.2c0 1.2-1 2.2-2.2 2.2h-2.6c-1.2 0-2.2-1-2.2-2.2V8z" />
      <path fill="#FF6D00" d="M9.2 11h5.6v5.8c0 .7-.6 1.3-1.3 1.3h-3c-.7 0-1.3-.6-1.3-1.3V11z" />
      <circle cx="12" cy="7.2" r="0.7" fill="#FFCC80" />
    </Wrap>
  )
}

export function LogoSoftDrink({ size = 40, className }) {
  return (
    <Wrap bg="#E53935" size={size} pad={0.14} className={className} title="Soft Drink">
      <path fill="#fff" d="M9.2 4.5h5.6l.6 1.8H8.6l.6-1.8z" />
      <path fill="#FFCDD2" d="M8.8 6.5h6.4v12.2c0 1-.8 1.8-1.8 1.8h-2.8c-1 0-1.8-.8-1.8-1.8V6.5z" />
      <path fill="#fff" d="M10 9.5c1.2 1.6 2.8 1.6 4 0 1.2 1.6 2 3.2 0 5.2-1.5-1.4-2.5-1.4-4 0-1.8-2-.8-3.6 0-5.2z" opacity="0.95" />
    </Wrap>
  )
}

export function LogoDosa({ size = 40, className }) {
  return (
    <Wrap bg="#E8A838" size={size} pad={0.12} className={className} title="Dosa">
      <ellipse cx="12" cy="13" rx="9" ry="6.5" fill="#FFF3E0" />
      <ellipse cx="12" cy="12.2" rx="7.5" ry="5" fill="#FFCC80" />
      <path fill="#FFA726" d="M5.5 12.5c2-3.5 5-5.2 8.5-5.2 2.2 0 4.2.7 5.8 1.8-1.8 1-4.2 1.6-6.8 1.6-2.8 0-5.4-.7-7.5-1.8z" opacity="0.85" />
      <ellipse cx="11" cy="13.5" rx="2.2" ry="1.4" fill="#8D6E63" />
    </Wrap>
  )
}

export function LogoChinese({ size = 40, className }) {
  return (
    <Wrap bg="#C62828" size={size} pad={0.12} className={className} title="Chinese">
      <ellipse cx="12" cy="16.5" rx="8" ry="2.2" fill="#B71C1C" />
      <path fill="#FFECB3" d="M5.5 15.5c0-4.5 2.9-8.5 6.5-8.5s6.5 4 6.5 8.5H5.5z" />
      <path fill="none" stroke="#5D4037" strokeWidth="1.1" strokeLinecap="round" d="M8 10.5c1.2 1.5 2.5 2.2 4 2.2s2.8-.7 4-2.2M7.5 13c1.4 1.2 2.8 1.8 4.5 1.8s3.1-.6 4.5-1.8" />
      <path fill="#FFECB3" d="M16.5 6.5l4-3.2.6.8-4 3.2zM18.2 8.2l3.8-1.2.4.9-3.8 1.2z" />
    </Wrap>
  )
}

export function LogoPaniPuri({ size = 40, className }) {
  return (
    <Wrap bg="#FF6F00" size={size} pad={0.14} className={className} title="Pani Puri">
      <circle cx="12" cy="13" r="7.5" fill="#FFE0B2" />
      <circle cx="12" cy="12.2" r="5.8" fill="#FFB74D" />
      <ellipse cx="12" cy="10.5" rx="3.2" ry="1.6" fill="#8D6E63" />
      <circle cx="12" cy="9.2" r="1.4" fill="#FFF8E1" />
      <path fill="#4CAF50" d="M10.5 14.5h3l-.5 2.5h-2z" opacity="0.8" />
    </Wrap>
  )
}

export function LogoBiryani({ size = 40, className }) {
  return (
    <Wrap bg="#8B4513" size={size} pad={0.12} className={className} title="Biryani">
      <ellipse cx="12" cy="16.8" rx="8.5" ry="2.4" fill="#5D4037" />
      <path fill="#FFCC80" d="M5 15.5c0-4.8 3.1-9 7-9s7 4.2 7 9H5z" />
      <path fill="#E65100" d="M7 12.5c1.5.8 3.2 1.2 5 1.2s3.5-.4 5-1.2c-.5 1.8-2.4 3.2-5 3.2s-4.5-1.4-5-3.2z" opacity="0.85" />
      <ellipse cx="12" cy="6.8" rx="3.5" ry="1.2" fill="#6D4C41" />
      <rect x="10.8" y="4.2" width="2.4" height="2.8" rx="0.6" fill="#6D4C41" />
    </Wrap>
  )
}

export function LogoPizzaFood({ size = 40, className }) {
  return (
    <Wrap bg="#D32F2F" size={size} pad={0.12} className={className} title="Pizza">
      <path fill="#FFCC80" d="M12 4.5L20.5 19H3.5L12 4.5z" />
      <path fill="#E53935" d="M12 7.2L17.8 17.2H6.2L12 7.2z" />
      <circle cx="10.5" cy="12.5" r="1.1" fill="#FFEB3B" />
      <circle cx="13.5" cy="14.2" r="1" fill="#FFEB3B" />
      <circle cx="12" cy="11" r="0.9" fill="#8BC34A" />
    </Wrap>
  )
}

export function LogoBurgerFood({ size = 40, className }) {
  return (
    <Wrap bg="#F57C00" size={size} pad={0.12} className={className} title="Burger">
      <ellipse cx="12" cy="8" rx="8" ry="3" fill="#FFCC80" />
      <rect x="4.5" y="10" width="15" height="2" rx="0.5" fill="#8BC34A" />
      <rect x="4.5" y="12.2" width="15" height="2.4" rx="0.6" fill="#6D4C41" />
      <ellipse cx="12" cy="16.5" rx="8" ry="2.8" fill="#FFCC80" />
    </Wrap>
  )
}

export function LogoIceCream({ size = 40, className }) {
  return (
    <Wrap bg="#EC407A" size={size} pad={0.14} className={className} title="Ice Cream">
      <circle cx="12" cy="9" r="5.5" fill="#F8BBD0" />
      <circle cx="9.5" cy="8.2" r="2.2" fill="#fff" opacity="0.85" />
      <circle cx="14.2" cy="8.5" r="2" fill="#F48FB1" />
      <path fill="#FFCC80" d="M9.2 13.5h5.6L13.2 21h-2.4L9.2 13.5z" />
    </Wrap>
  )
}

export function LogoSamosa({ size = 40, className }) {
  return (
    <Wrap bg="#D4A017" size={size} pad={0.14} className={className} title="Samosa">
      <path fill="#FFE082" d="M4.5 18.5L12 4.5l7.5 14H4.5z" />
      <path fill="#FFB300" d="M7.2 17L12 8.2 16.8 17H7.2z" />
      <path fill="#8D6E63" d="M10.5 14.5h3l-1.5 2.5z" opacity="0.7" />
    </Wrap>
  )
}

export function LogoLetter({ brand, size = 40, className }) {
  const darkText = ['blinkit', 'ola', 'subway', 'rapido', 'dunzo'].includes(brand?.id)
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
  tataplay: LogoTataPlay,
  zee5: LogoZee5,
  sony: LogoSonyLiv,
  gaana: LogoGaana,
  wynk: LogoWynk,
  apple: LogoApple,
  linkedin: LogoLinkedIn,
  microsoft: LogoMicrosoft,
  googleone: LogoGoogleOne,
  kfc: LogoKfc,
  starbucks: LogoStarbucks,
  mcdonalds: LogoMcdonalds,
  burgerking: LogoBurgerKing,
  dominos: LogoDominos,
  pizzahut: LogoPizzaHut,
  subway: LogoSubway,
  haldiram: LogoHaldiram,
  ccd: LogoCcd,
  wowmomo: LogoWowMomo,
  baskin: LogoBaskin,
  tacobell: LogoTacoBell,
  faasos: LogoFaasos,
  behrouz: LogoBehrouz,
  chaayos: LogoChaayos,
  chaipoint: LogoChaiPoint,
  bluetokai: LogoBlueTokai,
  thirdwave: LogoThirdWave,
  costa: LogoCosta,
  barista: LogoBarista,
  saravana: LogoSaravana,
  sagarratna: LogoSagarRatna,
  chinesewok: LogoChineseWok,
  mainlandchina: LogoMainlandChina,
  limbupani: LogoLimbuPani,
  coffee: LogoCoffee,
  tea: LogoTea,
  juice: LogoJuice,
  softdrink: LogoSoftDrink,
  dosa: LogoDosa,
  chinese: LogoChinese,
  panipuri: LogoPaniPuri,
  biryani: LogoBiryani,
  pizzafood: LogoPizzaFood,
  burgerfood: LogoBurgerFood,
  icecream: LogoIceCream,
  samosa: LogoSamosa,
  zomato: LogoZomato,
  swiggy: LogoSwiggy,
  instamart: LogoInstamart,
  blinkit: LogoBlinkit,
  zepto: LogoZepto,
  bigbasket: LogoBigBasket,
  dunzo: LogoDunzo,
  dmart: LogoDmart,
  reliancefresh: LogoRelianceFresh,
  more: LogoMore,
  uber: LogoUber,
  ola: LogoOla,
  rapido: LogoRapido,
  irctc: LogoIrctc,
  makemytrip: LogoMakeMyTrip,
  redbus: LogoRedbus,
  goibibo: LogoGoibibo,
  indigo: LogoIndigo,
  airindia: LogoAirIndia,
  flipkart: LogoFlipkart,
  myntra: LogoMyntra,
  ajio: LogoAjio,
  meesho: LogoMeesho,
  jiomart: LogoJioMart,
  nykaa: LogoNykaa,
  lenskart: LogoLenskart,
  croma: LogoCroma,
  decathlon: LogoDecathlon,
  jio: LogoJio,
  airtel: LogoAirtel,
  vi: LogoVi,
  phonepe: LogoPhonePe,
  gpay: LogoGpay,
  paytm: LogoPaytm,
  bhim: LogoBhim,
  cred: LogoCred,
  bookmyshow: LogoBookMyShow,
  pvr: LogoPvr,
  cultfit: LogoCultfit,
  urbancompany: LogoUrbanCompany,
  pharmeasy: LogoPharmeasy,
  onemg: Logo1mg,
  apollo: LogoApollo,
  groww: LogoGroww,
  zerodha: LogoZerodha,
  hdfc: LogoHdfc,
  sbi: LogoSbi,
  icici: LogoIcici,
  axis: LogoAxis,
  kotak: LogoKotak,
}
