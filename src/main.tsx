import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.tsx'
import { AppProvider } from './state/AppContext'
import { AuthProvider } from './state/AuthContext'
import { CloudSyncProvider } from './state/CloudSyncContext'
import '@fontsource/roboto-condensed/400.css'
import '@fontsource/roboto-condensed/500.css'
import '@fontsource/roboto-condensed/600.css'
import '@fontsource/roboto-condensed/700.css'
import './index.css'
import './styles/sessions.css'

const router = createBrowserRouter([{ path: '*', element: <AuthProvider><AppProvider><CloudSyncProvider><App /></CloudSyncProvider></AppProvider></AuthProvider> }])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
