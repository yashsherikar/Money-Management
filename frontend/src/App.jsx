import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { listenForNotificationTaps } from './nativePush.js'
import { bootstrapNotifications } from './utils/notificationBootstrap.js'
import { startSmsPayWatcher } from './utils/smsPayWatch.js'
import { startPendingPayReminderWatcher } from './utils/pendingPayReminders.js'
import { syncUnloggedConfirmedPays } from './utils/paymentNotify.js'
import { syncAllSubscriptionReminders } from './utils/subscriptionReminders.js'
import { syncAllEmergencyFundReminders } from './utils/emergencyFundReminders.js'
import client from './api/client'
import { startBackendWakeWatcher, wakeBackend } from './utils/wakeBackend.js'
import BiometricGate from './components/BiometricGate.jsx'
import ConnectingScreen from './components/ConnectingScreen.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import DueReminders from './components/DueReminders.jsx'
import PendingPayConfirm from './components/PendingPayConfirm.jsx'
import LoadingBar from './components/LoadingBar.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Transactions from './pages/Transactions.jsx'
import Recurring from './pages/Recurring.jsx'
import Obligations from './pages/Obligations.jsx'
import Investments from './pages/Investments.jsx'
import Udhar from './pages/Udhar.jsx'
import SplitBills from './pages/SplitBills.jsx'
import Wishlist from './pages/Wishlist.jsx'
import Requests from './pages/Requests.jsx'
import Notifications from './pages/Notifications.jsx'
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Pay from './pages/Pay.jsx'
import PendingPays from './pages/PendingPays.jsx'
import History from './pages/History.jsx'
import PaymentCategoryPrompt from './components/PaymentCategoryPrompt.jsx'
import SmsMoneyReviewPrompt from './components/SmsMoneyReviewPrompt.jsx'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  const navigate = useNavigate()

  useEffect(() => {
    const stop = listenForNotificationTaps(navigate)
    return typeof stop === 'function' ? stop : undefined
  }, [navigate])

  // Ping Render early (and again after long background) so login/API aren't the cold wake
  useEffect(() => {
    const stop = startBackendWakeWatcher()
    return typeof stop === 'function' ? stop : undefined
  }, [])

  // Permissions, Android channels, FCM token → backend (cold start with saved session)
  useEffect(() => {
    if (!localStorage.getItem('token')) return
    bootstrapNotifications({ refreshPush: true }).catch(() => {})
  }, [])

  useEffect(() => {
    return startSmsPayWatcher()
  }, [])

  useEffect(() => {
    return startPendingPayReminderWatcher()
  }, [])

  // Retry any Paid (SMS/manual) pays that never reached Transactions + reschedule subscription alerts
  useEffect(() => {
    const run = async () => {
      if (!localStorage.getItem('token')) return
      await wakeBackend().catch(() => {})
      syncUnloggedConfirmedPays().catch(() => {})
      client.get('/recurring-transactions')
        .then((res) => syncAllSubscriptionReminders(res.data || []))
        .catch(() => {})
      client.get('/emergency-fund')
        .then((res) => syncAllEmergencyFundReminders(res.data || []))
        .catch(() => {})
    }
    run()
    const onAuth = () => run()
    const onFocus = () => run()
    const onVis = () => {
      if (document.visibilityState === 'visible') run()
    }
    window.addEventListener('mm-p2p-sms-confirmed', onAuth)
    window.addEventListener('mm-auth-login', onAuth)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    const t = setInterval(run, 90_000)
    return () => {
      window.removeEventListener('mm-p2p-sms-confirmed', onAuth)
      window.removeEventListener('mm-auth-login', onAuth)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(t)
    }
  }, [])

  return (
    <BiometricGate>
    <ConnectingScreen />
    <LoadingBar />
    <DueReminders />
    <PendingPayConfirm />
    <PaymentCategoryPrompt />
    <SmsMoneyReviewPrompt />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/history" element={<Protected><History /></Protected>} />
      <Route path="/recurring" element={<Protected><Recurring /></Protected>} />
      <Route path="/obligations" element={<Protected><Obligations /></Protected>} />
      <Route path="/investments" element={<Protected><Investments /></Protected>} />
      <Route path="/udhar" element={<Protected><Udhar /></Protected>} />
      <Route path="/split-bills" element={<Protected><SplitBills /></Protected>} />
      <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
      <Route path="/requests" element={<Protected><Requests /></Protected>} />
      <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
      <Route path="/pay" element={<Protected><Pay /></Protected>} />
      <Route path="/scan-pay" element={<Protected><Pay /></Protected>} />
      <Route path="/pending-pays" element={<Protected><PendingPays /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
    </Routes>
    </BiometricGate>
  )
}
