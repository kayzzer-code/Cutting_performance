/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ShieldAlert } from 'lucide-react'
import { createInitialState } from '../domain/seed'
import { migrateState, STORAGE_KEY } from '../domain/storage'
import { requireSupabase } from '../lib/supabase'
import { inspectCloudState, loadCloudState, saveCloudState } from '../services/cloudStateRepository'
import { useApp } from './AppContext'
import { useAuth } from './AuthContext'

type SyncStatus = 'local' | 'checking' | 'syncing' | 'synced' | 'error' | 'conflict'

interface CloudSyncValue {
  status: SyncStatus
  label: string
  error: string
  retry: () => void
}

const CloudSyncContext = createContext<CloudSyncValue | null>(null)
const CLOUD_USER_KEY = 'cutting-performance-app:cloud-user'
const LEGACY_LOCAL_BACKUP_KEY = 'cutting-performance-app:legacy-local-backup'

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { configured, user } = useAuth()
  const { state, replaceState } = useApp()
  const [status, setStatus] = useState<SyncStatus>(configured ? 'checking' : 'local')
  const [error, setError] = useState('')
  const initializedUser = useRef<string | null>(null)
  const lastCloudRevision = useRef(0)
  const lastLocalRevision = useRef(state.revision ?? 0)
  const syncTimer = useRef<number | undefined>(undefined)

  const readLinkedOwner = useCallback(() => {
    try { return localStorage.getItem(CLOUD_USER_KEY) } catch { return null }
  }, [])
  const rememberLinkedOwner = useCallback((userId: string) => {
    try { localStorage.setItem(CLOUD_USER_KEY, userId) } catch { /* Cloud remains the source of truth. */ }
  }, [])
  const preserveLegacyLocalCache = useCallback((userId: string) => {
    try {
      const linkedOwner = readLinkedOwner()
      if (linkedOwner === userId) return
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const backupOwner = linkedOwner ?? 'unlinked'
      const backupKey = `${LEGACY_LOCAL_BACKUP_KEY}:${backupOwner}`
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw)
    } catch { /* A blocked local cache must never block the cloud journal. */ }
  }, [readLinkedOwner])

  const initialize = useCallback(async () => {
    if (!configured || !user) { setStatus(configured ? 'checking' : 'local'); return }
    setStatus('checking'); setError('')
    try {
      const info = await inspectCloudState(requireSupabase(), user.id)
      preserveLegacyLocalCache(user.id)
      if (info.exists) {
        const remote = await loadCloudState(requireSupabase(), user.id)
        if (!remote) throw new Error('Le journal cloud de ce compte est introuvable.')
        lastCloudRevision.current = info.revision
        lastLocalRevision.current = remote.revision ?? info.revision
        rememberLinkedOwner(user.id)
        replaceState(remote, 'Données cloud chargées')
        setStatus('synced')
        return
      }

      const fresh = migrateState(createInitialState())
      const result = await saveCloudState(requireSupabase(), user.id, fresh, 'automatic')
      const next = { ...fresh, revision: result.revision }
      lastCloudRevision.current = result.revision
      lastLocalRevision.current = result.revision
      rememberLinkedOwner(user.id)
      replaceState(next, 'Nouveau journal cloud créé')
      setStatus('synced')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error')
    }
  }, [configured, preserveLegacyLocalCache, rememberLinkedOwner, replaceState, user])

  useEffect(() => {
    if (!configured || !user) {
      initializedUser.current = null
      // Authentication is the external source of truth for the synchronization lifecycle.
      // oxlint-disable-next-line react/set-state-in-effect
      setStatus(configured ? 'checking' : 'local')
      return
    }
    if (initializedUser.current === user.id) return
    initializedUser.current = user.id
    void initialize()
  }, [configured, initialize, user])

  useEffect(() => {
    if (!configured || !user || status !== 'synced') return
    const revision = state.revision ?? 0
    if (revision === lastLocalRevision.current) return
    if (syncTimer.current) window.clearTimeout(syncTimer.current)
    syncTimer.current = window.setTimeout(async () => {
      setStatus('syncing'); setError('')
      try {
        const result = await saveCloudState(requireSupabase(), user.id, state, 'automatic', lastCloudRevision.current)
        lastCloudRevision.current = result.revision
        lastLocalRevision.current = result.revision
        if (result.revision !== revision) replaceState({ ...state, revision: result.revision }, 'Synchronisé dans le cloud')
        setStatus('synced')
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause)
        setError(message)
        setStatus(message.includes('version cloud') || message.includes('concurrente') ? 'conflict' : 'error')
      }
    }, 900)
    return () => { if (syncTimer.current) window.clearTimeout(syncTimer.current) }
  }, [configured, replaceState, state, status, user])

  const value = useMemo<CloudSyncValue>(() => ({
    status,
    label: status === 'local' ? 'Mode local' : status === 'checking' ? 'Chargement du cloud…' : status === 'syncing' ? 'Synchronisation…' : status === 'synced' ? 'Synchronisé' : status === 'conflict' ? 'Conflit cloud' : 'Cloud indisponible',
    error,
    retry: () => void initialize(),
  }), [error, initialize, status])

  return <CloudSyncContext.Provider value={value}>
    {children}
    {(status === 'error' || status === 'conflict') && <div className="cloud-sync-alert" role="alert"><ShieldAlert/><span><strong>{status === 'conflict' ? 'Une version cloud plus récente existe.' : 'La synchronisation a été interrompue.'}</strong>{error}</span><button onClick={() => void initialize()}>{status === 'conflict' ? 'Charger le cloud' : 'Réessayer'}</button></div>}
  </CloudSyncContext.Provider>
}

export function useCloudSync() {
  const value = useContext(CloudSyncContext)
  if (!value) throw new Error('useCloudSync doit être utilisé dans CloudSyncProvider')
  return value
}
