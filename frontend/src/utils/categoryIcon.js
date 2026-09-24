// Ordered most-specific-first: a narrow keyword (e.g. "chinese") should win over
// a broad one (e.g. "food") when both would match the same text.
const ICONS = [
  // Food — specific cuisines/items before the generic fallback
  { keywords: ['chinese', 'noodle', 'manchurian', 'momo'], icon: '🥡' },
  { keywords: ['pizza'], icon: '🍕' },
  { keywords: ['burger'], icon: '🍔' },
  { keywords: ['biryani', 'curry', 'thali'], icon: '🍛' },
  { keywords: ['sushi', 'japanese'], icon: '🍣' },
  { keywords: ['coffee', 'cafe', 'starbucks', 'ccd'], icon: '☕' },
  { keywords: ['tea', 'chai'], icon: '🍵' },
  { keywords: ['ice cream', 'dessert', 'sweet', 'mithai'], icon: '🍨' },
  { keywords: ['cake', 'bakery', 'pastry'], icon: '🎂' },
  { keywords: ['pani puri', 'chaat', 'street food', 'vada pav'], icon: '🌮' },
  { keywords: ['juice', 'smoothie'], icon: '🥤' },
  { keywords: ['grocery', 'groceries', 'vegetable', 'kirana', 'supermarket', 'bigbasket', 'dmart'], icon: '🛒' },
  { keywords: ['dining', 'restaurant', 'food', 'zomato', 'swiggy', 'lunch', 'dinner', 'breakfast', 'meal', 'hotel food'], icon: '🍽️' },

  // Transport
  { keywords: ['petrol', 'diesel', 'fuel', 'gas station'], icon: '⛽' },
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
  { keywords: ['utilit', 'bill'], icon: '💡' },

  // Shopping
  { keywords: ['clothes', 'clothing', 'fashion', 'apparel', 'shirt', 'jeans', 'dress'], icon: '👕' },
  { keywords: ['shoes', 'footwear', 'sneaker'], icon: '👟' },
  { keywords: ['electronics', 'gadget', 'laptop', 'mobile phone purchase'], icon: '🔌' },
  { keywords: ['jewelry', 'jewellery', 'gold'], icon: '💍' },
  { keywords: ['furniture', 'decor', 'sofa'], icon: '🛋️' },
  { keywords: ['amazon', 'flipkart', 'myntra', 'shopping'], icon: '🛍️' },

  // Entertainment
  { keywords: ['movie', 'cinema', 'pvr', 'inox'], icon: '🎬' },
  { keywords: ['netflix', 'prime video', 'hotstar', 'streaming'], icon: '📺' },
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

export function categoryIcon(text, transactionType) {
  const lower = (text || '').toLowerCase()
  const match = ICONS.find((entry) => entry.keywords.some((k) => lower.includes(k)))
  if (match) return match.icon
  return transactionType === 'INCOME' ? '💰' : '🧾'
}
