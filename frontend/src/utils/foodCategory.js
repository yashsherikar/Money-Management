/**
 * Food spend buckets used across Pay / Scan / bill OCR / SMS.
 *
 * Drinks     → coffee, chai, tea, juice, limbu pani, soft drinks, cafes
 * Snacks     → breakfast, burger, street food, QSR food (KFC, Domino’s…)
 * Dining Out → full lunch/dinner, restaurant, hotel thali, Swiggy/Zomato meals
 * Groceries  → supermarket / home cooking ingredients
 */

const GROCERY_RE = /\b(grocery|groceries|supermarket|dmart|big\s*bazaar|bigbasket|zepto|blinkit|instamart|reliance\s*fresh|\bmore\b|vegetables?|kirana)\b/i

const DRINKS_RE = /\b(coffee|cafe|caf[eé]|starbucks|sbux|ccd|coffee\s*day|chai|tea|drink|drinks|juice|shake|smoothie|cold\s*coffee|latte|cappuccino|espresso|filter\s*coffee|tapri|chaayos|chai\s*point|third\s*wave|blue\s*tokai|costa|barista|limbu\s*pani|limbupani|nimbu\s*pani|nimbupani|lemonade|lemon\s*soda|shikanji|soft\s*drink|cold\s*drink|colddrink|lassi|milkshake|milk\s*shake|soda|pepsi|coca\s*cola|cocacola|thums\s*up|thumsup|sprite|fanta|maaza|sugarcane|ganna)\b/i

const SNACKS_RE = /\b(snack|snacks|breakfast|nashta|nasta|burger|samosa|chaat|vada\s*pav|pani\s*puri|panipuri|golgappa|street\s*food|biscuit|namkeen|farsan|mcdonald|mcdonal|kfc|domino|pizza\s*hut|subway|wow\s*momo|bakery|pastry|donut|doughnut|waffle|ice\s*cream|softy|kachori|pakora|pakoda|taco\s*bell|haldiram)\b/i

const DINING_RE = /\b(restaurant|dining|lunch|dinner|thali|hotel|swiggy|zomato|buffet|fine\s*dining|cloud\s*kitchen|biryani|biriyani|meal|dosa|dhosa|dhosha|uttapam|idli|vada|chinese|noodles?|manchurian|hakka|schezwan|chowmein|chow\s*mein|fried\s*rice|saravana|sagar\s*ratna|mainland\s*china|chinese\s*wok)\b/i

/**
 * @returns {'Drinks'|'Snacks'|'Dining Out'|'Groceries'|null}
 */
export function suggestFoodCategoryName(text) {
  const s = String(text || '').trim()
  if (!s) return null
  if (GROCERY_RE.test(s)) return 'Groceries'
  // Drinks before snacks so "chai nashta" / cafe coffee land on Drinks
  if (DRINKS_RE.test(s)) return 'Drinks'
  if (SNACKS_RE.test(s)) return 'Snacks'
  if (DINING_RE.test(s)) return 'Dining Out'
  if (/\bfood\b/i.test(s)) return 'Dining Out'
  return null
}

export function findFoodCategoryId(categories, text) {
  const want = suggestFoodCategoryName(text)
  if (!want || !categories?.length) return null
  const byName = (name) =>
    categories.find((c) => String(c.name).toLowerCase() === name.toLowerCase())
  let hit = byName(want)
  // Until backend migration ships, map Drinks → Snacks so Pay still works
  if (!hit && want === 'Drinks') hit = byName('Snacks')
  return hit?.id != null ? String(hit.id) : null
}
