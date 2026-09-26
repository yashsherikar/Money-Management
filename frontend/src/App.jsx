import { useEffect } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import { listenForNativeNotificationTaps, listenForNativeForegroundPush } from './nativePush.js'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import DueReminders from './components/DueReminders.jsx'
import LoadingBar from './components/LoadingBar.jsx'
import InstallPrompt from './components/InstallPrompt.jsx'
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
import Profile from './pages/Profile.jsx'
import Settings from './pages/Settings.jsx'

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
    listenForNativeNotificationTaps(navigate)
    listenForNativeForegroundPush()
  }, [navigate])

  return (
    <>
    <LoadingBar />
    <DueReminders />
    <InstallPrompt />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/recurring" element={<Protected><Recurring /></Protected>} />
      <Route path="/obligations" element={<Protected><Obligations /></Protected>} />
      <Route path="/investments" element={<Protected><Investments /></Protected>} />
      <Route path="/udhar" element={<Protected><Udhar /></Protected>} />
      <Route path="/split-bills" element={<Protected><SplitBills /></Protected>} />
      <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
      <Route path="/requests" element={<Protected><Requests /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
    </Routes>
    </>
  )
}
