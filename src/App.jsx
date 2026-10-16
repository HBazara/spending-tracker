import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

function Shell() {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ padding: 24 }}>Loading...</p>
  if (!session) return <Login />
  return <Dashboard session={session} />
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}