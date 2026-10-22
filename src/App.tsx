import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import AppLayout from './components/AppLayout'
import { RequireAuth, RequireRole } from './components/guards'

import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import EventsPage from './pages/EventsPage'
import EventDetailPage from './pages/EventDetailPage'
import MePage from './pages/MePage'
import OrganizerPage from './pages/OrganizerPage'
import ClubsPage from './pages/ClubsPage'
import ExplorePage from './pages/ExplorePage'
import PrivacyPage from './pages/PrivacyPage'
import SurveyPage from './pages/SurveyPage'
import AdminPage from './pages/AdminPage'

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Open to everyone */}
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/survey" element={<SurveyPage />} />

            {/* Signed-in members with a complete profile */}
            <Route path="/events" element={<RequireAuth><EventsPage /></RequireAuth>} />
            <Route path="/events/:id" element={<RequireAuth><EventDetailPage /></RequireAuth>} />
            <Route path="/clubs" element={<RequireAuth><ClubsPage /></RequireAuth>} />
            <Route path="/explore" element={<RequireAuth><ExplorePage /></RequireAuth>} />
            <Route path="/me" element={<RequireAuth><MePage /></RequireAuth>} />

            {/* Roles */}
            <Route
              path="/organizer"
              element={<RequireAuth><RequireRole role="organizer"><OrganizerPage /></RequireRole></RequireAuth>}
            />
            <Route
              path="/admin"
              element={<RequireAuth><RequireRole role="admin"><AdminPage /></RequireRole></RequireAuth>}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

function SetupNeeded() {
  return (
    <div className="mx-auto max-w-xl p-8 font-sans">
      <h1 className="text-2xl font-bold">Almost there: connect Supabase</h1>
      <p className="mt-3 text-slate-600">
        The app can't find its database settings. Add these two values to a
        file called <code>.env.local</code> in the project folder (for local
        development) and to Vercel → Settings → Environment Variables (for
        the live site), then restart / redeploy:
      </p>
      <pre className="mt-4 rounded-xl bg-slate-900 p-4 text-sm text-white">
        VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=your-anon-key
      </pre>
      <p className="mt-3 text-sm text-slate-500">See SETUP.md for the full steps.</p>
    </div>
  )
}
