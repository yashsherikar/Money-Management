// Ordered most-specific-first: a narrow keyword (e.g. "chinese") should win over
// a broad one (e.g. "food") when both would match the same text.
const ICONS = [
  // Food — specific cuisines/items before the generic fallback
  { keywords: ['drinks', 'drink'], icon: '🥤' },
  { keywords: ['limbu pani', 'limbupani', 'nimbu pani', 'nimbupani', 'lemonade', 'lemon soda', 'shikanji'], icon: '🍋' },
  { keywords: ['dosa', 'dhosa', 'dhosha', 'uttapam', 'idli', 'vada'], icon: '🥞' },
  { keywords: ['chinese', 'noodle', 'noodles', 'manchurian', 'momo', 'momos', 'hakka', 'schezwan', 'chowmein', 'fried rice'], icon: '🥡' },
  { keywords: ['pizza'], icon: '🍕' },
  { keywords: ['burger', 'vada pav'], icon: '🍔' },
  { keywords: ['biryani', 'biriyani', 'curry', 'thali'], icon: '🍛' },
  { keywords: ['sushi', 'japanese'], icon: '🍣' },
  { keywords: ['samosa', 'kachori', 'pakora', 'pakoda'], icon: '🥟' },
  { keywords: ['coffee', 'cafe', 'starbucks', 'ccd', 'latte', 'cappuccino', 'espresso', 'filter coffee'], icon: '☕' },
  { keywords: ['tea', 'chai', 'tapri'], icon: '🍵' },
  { keywords: ['ice cream', 'icecream', 'softy', 'kulfi', 'dessert', 'sweet', 'mithai'], icon: '🍨' },
  { keywords: ['cake', 'bakery', 'pastry'], icon: '🎂' },
  { keywords: ['pani puri', 'panipuri', 'golgappa', 'bhel', 'chaat', 'street food', 'vada pav'], icon: '🟠' },
  { keywords: ['soft drink', 'cold drink', 'soda', 'pepsi', 'coca cola', 'thums up', 'sprite', 'fanta', 'maaza'], icon: '🥤' },
  { keywords: ['snack', 'snacks', 'chai nashta', 'nashta', 'farsan', 'biscuit', 'namkeen'], icon: '🍿' },
  { keywords: ['juice', 'smoothie', 'milkshake', 'lassi', 'shake', 'sugarcane', 'ganna'], icon: '🧃' },
  { keywords: ['blinkit', 'zepto', 'instamart', 'jiomart'], icon: '⚡' },
  { keywords: ['grocery', 'groceries', 'vegetable', 'kirana', 'supermarket', 'bigbasket', 'dmart'], icon: '🛒' },
  { keywords: ['dining', 'restaurant', 'food', 'zomato', 'swiggy', 'lunch', 'dinner', 'breakfast', 'meal', 'hotel food'], icon: '🍽️' },

  // Transport
  { keywords: ['petrol', 'diesel', 'fuel', 'gas station'], icon: '⛽' },
  { keywords: ['rapido'], icon: '🏍️' },
  { keywords: ['uber', 'ola', 'taxi', 'cab'], icon: '🚕' },
  { keywords: ['auto', 'rickshaw'], icon: '🛺' },
  { keywords: ['bus'], icon: '🚌' },
  { keywords: ['metro', 'train', 'railway', 'irctc'], icon: '🚆' },
  { keywords: ['flight', 'airfare', 'airline', 'airport'], icon: '✈️' },
  { keywords: ['bike', 'scooter', 'motorcycle'], icon: '🏍️' },
  { keywords: ['parking'], icon: '🅿️' },
  { keywords: ['toll', 'fastag'], icon: '🛣️' },
  { keywords: ['transport', 'travel', 'commute'], icon: '🚗' },

  // Phone / connectivity
  { keywords: ['recharge', 'mobile recharge', 'phone recharge', 'prepaid', 'postpaid'], icon: '📱' },
  { keywords: ['wifi', 'internet', 'broadband'], icon: '🌐' },
  { keywords: ['dth', 'cable tv', 'set top box'], icon: '📺' },
  { keywords: ['phone', 'mobile'], icon: '📱' },

  // Utilities
  { keywords: ['electricity', 'electric', 'power bill'], icon: '💡' },
  { keywords: ['water bill'], icon: '🚰' },
  { keywords: ['gas cylinder', 'lpg'], icon: '🔥' },
  { keywords: ['utility', 'utilities', 'bill'], icon: '💡' },

  // Shopping
  { keywords: ['clothes', 'clothing', 'fashion', 'apparel', 'shirt', 'jeans', 'dress'], icon: '👕' },
  { keywords: ['shoes', 'footwear', 'sneaker'], icon: '👟' },
  { keywords: ['electronics', 'gadget', 'laptop', 'mobile phone purchase'], icon: '🔌' },
  { keywords: ['jewelry', 'jewellery', 'gold'], icon: '💍' },
  { keywords: ['furniture', 'decor', 'sofa'], icon: '🛋️' },
  { keywords: ['amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'shopping'], icon: '🛍️' },

  // Entertainment
  { keywords: ['movie', 'cinema', 'pvr', 'inox'], icon: '🎬' },
  { keywords: ['netflix', 'prime video', 'hotstar', 'tata play', 'tataplay', 'zee5', 'streaming'], icon: '📺' },
  { keywords: ['youtube'], icon: '▶️' },
  { keywords: ['game', 'gaming', 'playstation', 'xbox', 'steam'], icon: '🎮' },
  { keywords: ['music', 'spotify', 'concert'], icon: '🎵' },
  { keywords: ['party', 'club', 'pub', 'bar'], icon: '🎉' },
  { keywords: ['subscription'], icon: '🔁' },
  { keywords: ['entertainment'], icon: '🎭' },

  // Health & fitness
  { keywords: ['medicine', 'pharmacy', 'medical store', 'chemist'], icon: '💊' },
  { keywords: ['doctor', 'hospital', 'clinic', 'health', 'checkup'], icon: '🏥' },
  { keywords: ['gym', 'fitness', 'workout'], icon: '🏋️' },
  { keywords: ['yoga'], icon: '🧘' },
  { keywords: ['dentist', 'dental'], icon: '🦷' },

  // Education
  { keywords: ['school', 'college', 'tuition', 'course', 'book', 'exam fee'], icon: '📚' },
  { keywords: ['education'], icon: '🎓' },

  // Home
  { keywords: ['rent'], icon: '🏠' },
  { keywords: ['maintenance', 'society'], icon: '🏢' },
  { keywords: ['repair', 'plumber', 'electrician'], icon: '🔧' },

  // Personal / family
  { keywords: ['parents', 'family', 'send money', 'ghar'], icon: '👪' },
  { keywords: ['gift', 'present'], icon: '🎁' },
  { keywords: ['salon', 'haircut', 'spa', 'parlour'], icon: '💇' },
  { keywords: ['pet', 'dog', 'cat', 'vet'], icon: '🐾' },
  { keywords: ['baby', 'diaper', 'kids'], icon: '🍼' },

  // Finance
  { keywords: ['emi', 'loan'], icon: '🏦' },
  { keywords: ['insurance'], icon: '🛡️' },
  { keywords: ['sip', 'mutual fund', 'stock', 'investment', 'shares', 'trading'], icon: '📈' },
  { keywords: ['salary', 'freelance', 'bonus', 'income'], icon: '💵' },
  { keywords: ['udhar', 'lend', 'borrow'], icon: '🤝' },
  { keywords: ['rd', 'fd', 'fixed deposit', 'recurring deposit', 'savings'], icon: '🏦' },

  // Travel / stay
  { keywords: ['hotel', 'stay', 'lodging', 'airbnb', 'oyo'], icon: '🏨' },
  { keywords: ['vacation', 'trip', 'holiday'], icon: '🧳' },

  // Misc common
  { keywords: ['donation', 'charity', 'temple'], icon: '🙏' },
  { keywords: ['tax', 'gst'], icon: '🧾' },
  { keywords: ['office', 'work'], icon: '💼' },
]

// Whole words only (plural s/es allowed): substring matching put "auto" 🛺 on "Autopay",
// "bus" on "business", "rd" 🏦 on "card", "tea" on "steam".
const MATCHERS = ICONS.map((entry) => ({
  icon: entry.icon,
  re: new RegExp(
    `(?:^|[^a-z0-9])(?:${entry.keywords
      .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|')})(?:s|es)?(?:[^a-z0-9]|$)`,
    'i',
  ),
}))

export function categoryIcon(text, transactionType) {
  const match = MATCHERS.find((m) => m.re.test(text || ''))
  if (match) return match.icon
  return transactionType === 'INCOME' ? '💰' : '🧾'
}
