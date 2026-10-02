import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { listenForNotificationTaps } from './nativePush.js'
import { startSmsPayWatcher } from './utils/smsPayWatch.js'
import { startPendingPayReminderWatcher } from './utils/pendingPayReminders.js'
import BiometricGate from './components/BiometricGate.jsx'
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
import PaymentCategoryPrompt from './components/PaymentCategoryPrompt.jsx'

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
    listenForNotificationTaps(navigate)
  }, [navigate])

  useEffect(() => {
    return startSmsPayWatcher()
  }, [])

  useEffect(() => {
    return startPendingPayReminderWatcher()
  }, [])

  useEffect(() => {
    const onTap = (e) => {
      const url = e?.detail?.url
      if (url) navigate(url)
    }
    window.addEventListener('mm-notification-tap', onTap)
    return () => window.removeEventListener('mm-notification-tap', onTap)
  }, [navigate])

  return (
    <BiometricGate>
    <LoadingBar />
    <DueReminders />
    <PendingPayConfirm />
    <PaymentCategoryPrompt />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
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
