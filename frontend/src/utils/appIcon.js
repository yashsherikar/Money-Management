import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

const AppIcon = registerPlugin('AppIcon')

// v5: in-memory cache + smaller icons. v1–v4 could grow to several MB and fill the
// WebView's ~5MB localStorage, breaking every other save in the app.
const CACHE_KEY = 'mm_app_icon_v5'
const OLD_KEYS = ['mm_app_icon_v1', 'mm_app_icon_v2', 'mm_app_icon_v3', 'mm_app_icon_v4']
const MISS_RETRY_MS = 7 * 24 * 60 * 60_000
const MAX_ICONS = 80
const MAX_MISSES = 300

/** Bank SMS shows legal names, not app names — map the known ones to the app's package. */
const LEGAL_NAME_TO_PACKAGE = [
  ['one97', 'net.one97.paytm'],
  ['bundl', 'in.swiggy.android'],
  ['zomato', 'com.application.zomato'],
  ['grofers', 'com.grofers.customerapp'],
  ['blinkit', 'com.grofers.customerapp'],
  ['kiranakart', 'com.zeptoconsumer'],
  ['zepto', 'com.zeptoconsumer'],
  ['anitechnologies', 'com.olacabs.customer'],
  ['ubercab', 'com.ubercab'],
  ['uberindia', 'com.ubercab'],
  ['roppen', 'com.rapido.passenger'],
  ['rapido', 'com.rapido.passenger'],
  ['dreamplug', 'com.dreamplug.androidapp'],
  ['flipkart', 'com.flipkart.android'],
  ['amazonpay', 'in.amazon.mShop.android.shopping'],
  ['amazonseller', 'in.amazon.mShop.android.shopping'],
  ['novidigital', 'in.startv.hotstar'],
  ['hotstar', 'in.startv.hotstar'],
  ['relianceretail', 'com.jio.myjio'],
  ['reliancejio', 'com.jio.myjio'],
  ['bhartiairtel', 'com.myairtelapp'],
  ['makemytrip', 'com.makemytrip'],
  ['irctc', 'cris.org.in.prs.ima'],
  ['bigtree', 'com.bt.bms'],
  ['bookmyshow', 'com.bt.bms'],
]

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Parsed once per app start; rows read from memory, never re-parse localStorage per render.
let memo = null
function cache() {
  if (memo) return memo
  memo = {}
  try {
    OLD_KEYS.forEach((k) => localStorage.removeItem(k))
    memo = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}
  } catch { /* corrupt or blocked — start empty */ }
  return memo
}

let saveTimer = null
function persistSoon() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const c = cache()
    const byAge = (a, b) => c[b].at - c[a].at
    const hits = Object.keys(c).filter((k) => c[k].icon).sort(byAge)
    const misses = Object.keys(c).filter((k) => !c[k].icon).sort(byAge)
    hits.slice(MAX_ICONS).concat(misses.slice(MAX_MISSES)).forEach((k) => delete c[k])
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(c))
    } catch {
      // Storage full — drop our cache rather than starve the rest of the app.
      try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
    }
  }, 1500)
}

const inflight = new Map()

/** Data-URL icon of the installed app matching this merchant name, or '' if none. */
export async function findInstalledAppIcon(name) {
  const key = norm(name)
  if (!key || key.length < 3 || !Capacitor.isNativePlatform()) return ''
  const hit = cache()[key]
  if (hit && (hit.icon || Date.now() - hit.at < MISS_RETRY_MS)) return hit.icon
  if (inflight.has(key)) return inflight.get(key)

  const packageName = LEGAL_NAME_TO_PACKAGE.find(([needle]) => key.includes(needle))?.[1] || null
  const p = AppIcon.find({ name, packageName })
    .then((r) => r?.icon || '')
    .catch(() => '')
    .then((icon) => {
      cache()[key] = { icon, at: Date.now() }
      persistSoon()
      inflight.delete(key)
      return icon
    })
  inflight.set(key, p)
  return p
}

export function useInstalledAppIcon(name) {
  const [icon, setIcon] = useState(() => cache()[norm(name)]?.icon || '')
  useEffect(() => {
    const cached = cache()[norm(name)]?.icon || ''
    setIcon(cached)
    if (!name || cached) return undefined
    let alive = true
    // Debounced: in edit/add forms the name changes per keystroke — look up once typing pauses.
    const timer = setTimeout(() => {
      findInstalledAppIcon(name).then((i) => { if (alive) setIcon(i) })
    }, 400)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [name])
  return icon
}
