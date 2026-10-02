import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import './index.css'

// Service workers break Capacitor WebView routing (login/home reload loops).
// Keep SW for browser/PWA only.
if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
  navigator.serviceWorker.register('/sw.js').then((reg) => reg.update()).catch(() => {})
} else if ('serviceWorker' in navigator && Capacitor.isNativePlatform()) {
  navigator.serviceWorker.getRegistrations?.().then((regs) => {
    regs.forEach((reg) => reg.unregister())
  }).catch(() => {})
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
