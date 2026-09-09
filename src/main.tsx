/* oxlint-disable react/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import { AppProvider } from './state/AppContext'
import { AuthProvider, useAuth } from './state/AuthContext'
import { CloudSyncProvider } from './state/CloudSyncContext'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/500.css'
import '@fontsource/roboto-condensed/600.css'
import '@fontsource/roboto-condensed/700.css'
import './index.css'
import './styles/sessions.css'

function DataProviders() {
  const auth = useAuth()

  // Authentication routes must stay usable even when this device contains an
  // old, corrupt or inaccessible local journal. Application data is opened
  // only after Supabase has restored an authenticated session.
  if (auth.configured && (auth.loading || !auth.user)) return <App />

  return <AppProvider><CloudSyncProvider><App /></CloudSyncProvider></AppProvider>
}

const router = createBrowserRouter([{ path: '*', element: <AuthProvider><DataProviders /></AuthProvider> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
