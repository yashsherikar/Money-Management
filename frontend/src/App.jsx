import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Layout from './components/Layout.jsx'
import DueReminders from './components/DueReminders.jsx'
import LoadingBar from './components/LoadingBar.jsx'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Accounts from './pages/Accounts.jsx'
import Transactions from './pages/Transactions.jsx'
import Obligations from './pages/Obligations.jsx'
import Udhar from './pages/Udhar.jsx'
import SplitBills from './pages/SplitBills.jsx'
import Investments from './pages/Investments.jsx'
import Recurring from './pages/Recurring.jsx'
import Wishlist from './pages/Wishlist.jsx'
import Groups from './pages/Groups.jsx'
import Requests from './pages/Requests.jsx'
import Profile from './pages/Profile.jsx'

function Protected({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <>
    <LoadingBar />
    <DueReminders />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/accounts" element={<Protected><Accounts /></Protected>} />
      <Route path="/transactions" element={<Protected><Transactions /></Protected>} />
      <Route path="/obligations" element={<Protected><Obligations /></Protected>} />
      <Route path="/udhar" element={<Protected><Udhar /></Protected>} />
      <Route path="/split-bills" element={<Protected><SplitBills /></Protected>} />
      <Route path="/investments" element={<Protected><Investments /></Protected>} />
      <Route path="/recurring" element={<Protected><Recurring /></Protected>} />
      <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
      <Route path="/groups" element={<Protected><Groups /></Protected>} />
      <Route path="/requests" element={<Protected><Requests /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
    </Routes>
    </>
  )
}
