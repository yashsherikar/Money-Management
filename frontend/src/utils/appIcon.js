import { useEffect, useState } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'

const AppIcon = registerPlugin('AppIcon')

// v2: matching now finds an app name inside longer text — drop v1's cached misses.
const CACHE_KEY = 'mm_app_icon_v2'
const MISS_RETRY_MS = 7 * 24 * 60 * 60_000
const MAX_ENTRIES = 300

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

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeCache(key, icon) {
  try {
    const cache = readCache()
    cache[key] = { icon, at: Date.now() }
    const keys = Object.keys(cache)
    if (keys.length > MAX_ENTRIES) {
      keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - MAX_ENTRIES)
        .forEach((k) => delete cache[k])
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch { /* storage full — just don't cache */ }
}

const inflight = new Map()

/** Data-URL icon of the installed app matching this merchant name, or '' if none. */
export async function findInstalledAppIcon(name) {
  const key = norm(name)
  if (!key || key.length < 4 || !Capacitor.isNativePlatform()) return ''
  const hit = readCache()[key]
  if (hit && (hit.icon || Date.now() - hit.at < MISS_RETRY_MS)) return hit.icon
  if (inflight.has(key)) return inflight.get(key)

  const packageName = LEGAL_NAME_TO_PACKAGE.find(([needle]) => key.includes(needle))?.[1] || null
  const p = AppIcon.find({ name, packageName })
    .then((r) => r?.icon || '')
    .catch(() => '')
    .then((icon) => {
      writeCache(key, icon)
      inflight.delete(key)
      return icon
    })
  inflight.set(key, p)
  return p
}

export function useInstalledAppIcon(name) {
  const [icon, setIcon] = useState(() => readCache()[norm(name)]?.icon || '')
  useEffect(() => {
    const cached = readCache()[norm(name)]?.icon || ''
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
