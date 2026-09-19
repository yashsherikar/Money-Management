const ICONS = [
  { keywords: ['petrol', 'fuel', 'gas station', 'transport', 'travel', 'cab', 'taxi', 'auto', 'bus', 'metro', 'flight', 'train'], icon: '⛽' },
  { keywords: ['salary', 'freelance', 'bonus'], icon: '💵' },
  { keywords: ['rent'], icon: '🏠' },
  { keywords: ['grocery', 'groceries', 'vegetable', 'kirana'], icon: '🛒' },
  { keywords: ['utilit', 'electric', 'wifi', 'internet', 'bill'], icon: '💡' },
  { keywords: ['emi', 'loan'], icon: '🏦' },
  { keywords: ['insurance'], icon: '🛡️' },
  { keywords: ['health', 'medical', 'doctor', 'pharmacy', 'hospital'], icon: '💊' },
  { keywords: ['education', 'school', 'college', 'course', 'book'], icon: '📚' },
  { keywords: ['dining', 'restaurant', 'food', 'zomato', 'swiggy'], icon: '🍽️' },
  { keywords: ['movie', 'entertainment', 'netflix', 'game'], icon: '🎬' },
  { keywords: ['shopping', 'clothes', 'amazon', 'flipkart'], icon: '🛍️' },
  { keywords: ['subscription'], icon: '🔁' },
]

export function categoryIcon(categoryName, transactionType) {
  const lower = (categoryName || '').toLowerCase()
  const match = ICONS.find((entry) => entry.keywords.some((k) => lower.includes(k)))
  if (match) return match.icon
  return transactionType === 'INCOME' ? '💰' : '🧾'
}
