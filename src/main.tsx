import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider, useParams } from 'react-router-dom'
import './index.css'
import { LangProvider } from './lib/i18n'
import { ToastProvider } from './components/Toast'
import Home from './pages/Home'
import Login from './pages/Login'
import PublicTournament from './pages/PublicTournament'
import PublicCourt from './pages/PublicCourt'
import Tv from './pages/Tv'
import Referee from './pages/Referee'
import OrgGuard from './pages/Organizer/OrgGuard'
import Organizer from './pages/Organizer'
import OrgScore from './pages/Organizer/OrgScore'
import PrintCourts from './pages/Organizer/PrintCourts'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

// Old hash links (#/t/<id>, #/ref?k=...) keep working: rewrite them to real paths before routing.
if (location.hash.startsWith('#/')) history.replaceState(null, '', BASE + location.hash.slice(1))

// Legacy redirects; a uuid works as :slug
function Redirect({ to }: { to: (p: Record<string, string | undefined>) => string }) {
  return <Navigate to={to(useParams())} replace />
}

const router = createBrowserRouter([
  { path: '/', element: <Home /> },
  { path: '/login', element: <Login /> },
  { path: '/ref', element: <Referee /> },
  { path: '/t/:tid', element: <Redirect to={p => `/${p.tid}`} /> },
  { path: '/t/:tid/tv', element: <Redirect to={p => `/${p.tid}/tv`} /> },
  { path: '/t/:tid/court/:cid', element: <Redirect to={p => `/${p.tid}/${p.cid}`} /> },
  { path: '/org/:tid', element: <Redirect to={p => `/${p.tid}/admin`} /> },
  { path: '/org/:tid/score/:mid', element: <Redirect to={p => `/${p.tid}/admin/score/${p.mid}`} /> },
  { path: '/org/:tid/print-courts', element: <Redirect to={p => `/${p.tid}/admin/print-courts`} /> },
  { path: '/:slug', element: <PublicTournament /> },
  { path: '/:slug/tv', element: <Tv /> },
  { path: '/:slug/admin', element: <OrgGuard><Organizer /></OrgGuard> },
  { path: '/:slug/admin/score/:mid', element: <OrgGuard><OrgScore /></OrgGuard> },
  { path: '/:slug/admin/print-courts', element: <OrgGuard><PrintCourts /></OrgGuard> },
  { path: '/:slug/:court', element: <PublicCourt /> },
], { basename: BASE || '/' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LangProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </LangProvider>
  </React.StrictMode>,
)
