/**
 * Food spend buckets used across Pay / Scan / bill OCR / SMS.
 *
 * Snacks     → coffee, chai, drinks, breakfast, burger, street food, QSR cafes
 * Dining Out → full lunch/dinner, restaurant, hotel thali, Swiggy/Zomato meals
 * Groceries  → supermarket / home cooking ingredients
 */

const GROCERY_RE = /\b(grocery|groceries|supermarket|dmart|big\s*bazaar|bigbasket|zepto|blinkit|instamart|reliance\s*fresh|\bmore\b|vegetables?|kirana)\b/i

const SNACKS_RE = /\b(coffee|cafe|caf[eé]|starbucks|sbux|ccd|coffee\s*day|chai|tea|drink|drinks|juice|shake|smoothie|cold\s*coffee|latte|cappuccino|espresso|snack|snacks|breakfast|nashta|nasta|burger|samosa|chaat|vada\s*pav|pani\s*puri|panipuri|golgappa|street\s*food|biscuit|namkeen|farsan|mcdonald|mcdonal|kfc|domino|pizza\s*hut|subway|wow\s*momo|chaayos|chai\s*point|third\s*wave|blue\s*tokai|costa|barista|filter\s*coffee|tapri|bakery|pastry|donut|doughnut|waffle|ice\s*cream|softy|limbu\s*pani|limbupani|nimbu\s*pani|nimbupani|lemonade|lemon\s*soda|shikanji|soft\s*drink|cold\s*drink|colddrink|lassi|milkshake|soda|pepsi|coca\s*cola|thums\s*up|sprite|fanta|maaza|kachori|pakora|pakoda)\b/i

const DINING_RE = /\b(restaurant|dining|lunch|dinner|thali|hotel|swiggy|zomato|buffet|fine\s*dining|cloud\s*kitchen|biryani|biriyani|meal|dosa|dhosa|dhosha|uttapam|idli|vada|chinese|noodles?|manchurian|hakka|schezwan|chowmein|chow\s*mein|fried\s*rice|saravana|sagar\s*ratna|mainland\s*china|chinese\s*wok)\b/i

/**
 * @returns {'Snacks'|'Dining Out'|'Groceries'|null}
 */
export function suggestFoodCategoryName(text) {
  const s = String(text || '').trim()
  if (!s) return null
  if (GROCERY_RE.test(s)) return 'Groceries'
  // Light eats / drinks before full meals (cafe must not become Dining Out)
  if (SNACKS_RE.test(s)) return 'Snacks'
  if (DINING_RE.test(s)) return 'Dining Out'
  if (/\bfood\b/i.test(s)) return 'Dining Out'
  return null
}

export function findFoodCategoryId(categories, text) {
  const want = suggestFoodCategoryName(text)
  if (!want || !categories?.length) return null
  const hit = categories.find((c) => String(c.name).toLowerCase() === want.toLowerCase())
  return hit?.id != null ? String(hit.id) : null
}
