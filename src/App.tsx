import { lazy } from 'react'
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'

import { AuthProvider } from './context/AuthContext'
import { LanguageProvider } from './context/LanguageContext'
import { supabaseConfigured } from './lib/supabase'
import AppLayout from './components/AppLayout'
import { RequireAuth, RequireRole } from './components/guards'

import HomePage from './pages/HomePage'

// The shareable design preview is a plain static site, so it uses #/ links
// that work on any host without server setup.
const Router = import.meta.env.MODE === 'demo' ? HashRouter : BrowserRouter

// Each page is downloaded only when it is opened (smaller first load).
const LoginPage = lazy(() => import('./pages/LoginPage'))
const EventsPage = lazy(() => import('./pages/EventsPage'))
const EventDetailPage = lazy(() => import('./pages/EventDetailPage'))
const MePage = lazy(() => import('./pages/MePage'))
const OrganizerPage = lazy(() => import('./pages/OrganizerPage'))
const CheckInPage = lazy(() => import('./pages/CheckInPage'))
const ClubsPage = lazy(() => import('./pages/ClubsPage'))
const ExplorePage = lazy(() => import('./pages/ExplorePage'))
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'))
const SurveyPage = lazy(() => import('./pages/SurveyPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const AskPage = lazy(() => import('./pages/AskPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const PpmkPage = lazy(() => import('./pages/PpmkPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))
const ClubPage = lazy(() => import('./pages/ClubPage'))
const ClubApplyPage = lazy(() => import('./pages/ClubApplyPage'))
const DiscussPage = lazy(() => import('./pages/DiscussPage'))
const DiscussNewPage = lazy(() => import('./pages/DiscussNewPage'))
const DiscussPostPage = lazy(() => import('./pages/DiscussPostPage'))

export default function App() {
  if (!supabaseConfigured) return <SetupNeeded />

  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route element={<AppLayout />}>
              {/* Open to everyone */}
              <Route path="/" element={<HomePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/survey" element={<SurveyPage />} />
              <Route path="/ppmk" element={<PpmkPage />} />
              <Route path="/about" element={<AboutPage />} />

              {/* Signed-in members with a complete profile */}
              <Route path="/events" element={<RequireAuth><EventsPage /></RequireAuth>} />
              <Route path="/events/:id" element={<RequireAuth><EventDetailPage /></RequireAuth>} />
              <Route path="/clubs" element={<RequireAuth><ClubsPage /></RequireAuth>} />
              <Route path="/clubs/apply" element={<RequireAuth><ClubApplyPage /></RequireAuth>} />
              <Route path="/clubs/:id" element={<RequireAuth><ClubPage /></RequireAuth>} />
              {/* Explore Korea topics are readable signed out; visitors may post there */}
              <Route path="/discuss" element={<RequireAuth allow="guest"><DiscussPage /></RequireAuth>} />
              <Route path="/discuss/new" element={<RequireAuth allow="account"><DiscussNewPage /></RequireAuth>} />
              <Route path="/discuss/:id" element={<RequireAuth allow="guest"><DiscussPostPage /></RequireAuth>} />
              <Route path="/explore" element={<RequireAuth allow="guest"><ExplorePage /></RequireAuth>} />
              <Route path="/me" element={<RequireAuth allow="account"><MePage /></RequireAuth>} />
              <Route path="/ask" element={<RequireAuth><AskPage /></RequireAuth>} />

              {/* Roles */}
              <Route
                path="/organizer"
                element={<RequireAuth><RequireRole role="organizer"><OrganizerPage /></RequireRole></RequireAuth>}
              />
              {/* Opened by scanning a student's QR with the phone camera */}
              <Route
                path="/checkin/:code"
                element={<RequireAuth><RequireRole role="organizer"><CheckInPage /></RequireRole></RequireAuth>}
              />
              <Route
                path="/admin"
                element={<RequireAuth><RequireRole role="admin"><AdminPage /></RequireRole></RequireAuth>}
              />

              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
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
      <pre className="mt-4 rounded-xl bg-ink p-4 text-sm text-on-ink">
        VITE_SUPABASE_URL=https://xxxx.supabase.co{'\n'}VITE_SUPABASE_ANON_KEY=your-anon-key
      </pre>
      <p className="mt-3 text-sm text-slate-500">See SETUP.md for the full steps.</p>
    </div>
  )
}
