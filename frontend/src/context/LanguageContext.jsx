import { createContext, useContext, useEffect, useState } from 'react'
import { mr } from '../i18n/mr.js'

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')

  useEffect(() => {
    localStorage.setItem('lang', lang)
  }, [lang])

  function t(text) {
    if (lang === 'mr') return mr[text] || text
    return text
  }

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
