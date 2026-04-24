import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Navbar from './components/Navbar'
import Login from './pages/Login'
import PlayerHome from './pages/PlayerHome'
import CharacterSheet from './pages/CharacterSheet'
import Campaigns from './pages/Campaigns'
import CampaignView from './pages/CampaignView'
import Admin from './pages/Admin'

function Layout({ children }) {
  return (
    <div className="flex flex-col min-h-full">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout><Navigate to="/characters" replace /></Layout></ProtectedRoute>} />
          <Route path="/characters" element={<ProtectedRoute playersOnly><Layout><PlayerHome /></Layout></ProtectedRoute>} />
          <Route path="/characters/new" element={<ProtectedRoute playersOnly><Layout><CharacterSheet /></Layout></ProtectedRoute>} />
          <Route path="/characters/:id" element={<ProtectedRoute playersOnly><Layout><CharacterSheet /></Layout></ProtectedRoute>} />
          <Route path="/campaigns" element={<ProtectedRoute playersOnly><Layout><PlayerHome /></Layout></ProtectedRoute>} />
          <Route path="/campaigns/:id" element={<ProtectedRoute><Layout><CampaignView /></Layout></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><Layout><Admin /></Layout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
