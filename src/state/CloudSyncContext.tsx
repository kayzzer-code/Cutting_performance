/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Cloud, CloudDownload, CloudUpload, Download, ShieldAlert, X } from 'lucide-react'
import { createInitialState } from '../domain/seed'
import { exportLocalData } from '../domain/storage'
import { requireSupabase } from '../lib/supabase'
import { inspectCloudState, loadCloudState, saveCloudState, type CloudStateInfo } from '../services/cloudStateRepository'
import { useApp } from './AppContext'
import { useAuth } from './AuthContext'

type SyncStatus = 'local' | 'checking' | 'choice' | 'syncing' | 'synced' | 'error' | 'conflict'

interface CloudSyncValue {
  status: SyncStatus
  label: string
  error: string
  retry: () => void
}

const CloudSyncContext = createContext<CloudSyncValue | null>(null)
const CLOUD_USER_KEY = 'cutting-performance-app:cloud-user'

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { configured, user } = useAuth()
  const { state, replaceState, storageAvailable, hadStoredState } = useApp()
  const [status, setStatus] = useState<SyncStatus>(configured ? 'checking' : 'local')
  const [error, setError] = useState('')
  const [cloudInfo, setCloudInfo] = useState<CloudStateInfo | null>(null)
  const [foreignLocalCache, setForeignLocalCache] = useState(false)
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

  const initialize = useCallback(async (forceChoice = false) => {
    if (!configured || !user) { setStatus(configured ? 'checking' : 'local'); return }
    setStatus('checking'); setError('')
    try {
      const info = await inspectCloudState(requireSupabase(), user.id)
      setCloudInfo(info)
      const linkedOwner = readLinkedOwner()
      const alreadyLinked = linkedOwner === user.id
      setForeignLocalCache(Boolean(linkedOwner && linkedOwner !== user.id))
      if (!forceChoice && info.exists && (alreadyLinked || !hadStoredState || !storageAvailable)) {
        const remote = await loadCloudState(requireSupabase(), user.id)
        if (remote) {
          lastCloudRevision.current = info.revision
          lastLocalRevision.current = remote.revision ?? info.revision
          rememberLinkedOwner(user.id)
          replaceState(remote, 'Données cloud chargées')
          setStatus('synced')
          return
        }
      }
      setStatus('choice')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error')
    }
  }, [configured, hadStoredState, readLinkedOwner, rememberLinkedOwner, replaceState, storageAvailable, user])

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

  const importLocal = useCallback(async () => {
    if (!user) return
    setStatus('syncing'); setError('')
    try {
      const result = await saveCloudState(requireSupabase(), user.id, state, 'local-import', cloudInfo?.exists ? cloudInfo.revision : undefined)
      lastCloudRevision.current = result.revision
      lastLocalRevision.current = result.revision
      rememberLinkedOwner(user.id)
      replaceState({ ...state, revision: result.revision }, 'Import cloud vérifié')
      setCloudInfo({ exists: true, revision: result.revision, updatedAt: result.syncedAt })
      setStatus('synced')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error') }
  }, [cloudInfo, rememberLinkedOwner, replaceState, state, user])

  const loadCloud = useCallback(async () => {
    if (!user) return
    setStatus('syncing'); setError('')
    try {
      const remote = await loadCloudState(requireSupabase(), user.id)
      if (!remote) throw new Error('Aucune donnée cloud n’a été trouvée pour ce compte.')
      lastCloudRevision.current = remote.revision ?? cloudInfo?.revision ?? 0
      lastLocalRevision.current = remote.revision ?? 0
      rememberLinkedOwner(user.id)
      replaceState(remote, 'Données cloud chargées')
      setStatus('synced')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error') }
  }, [cloudInfo, rememberLinkedOwner, replaceState, user])

  const startFresh = useCallback(async () => {
    if (!user) return
    const fresh = createInitialState()
    setStatus('syncing'); setError('')
    try {
      const result = await saveCloudState(requireSupabase(), user.id, fresh, 'local-import', cloudInfo?.exists ? cloudInfo.revision : undefined)
      const next = { ...fresh, revision: result.revision }
      lastCloudRevision.current = result.revision; lastLocalRevision.current = result.revision
      rememberLinkedOwner(user.id)
      replaceState(next, 'Nouveau journal cloud créé')
      setStatus('synced')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('error') }
  }, [cloudInfo, rememberLinkedOwner, replaceState, user])

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
    label: status === 'local' ? 'Mode local' : status === 'checking' ? 'Vérification du cloud…' : status === 'syncing' ? 'Synchronisation…' : status === 'synced' ? 'Synchronisé' : status === 'choice' ? 'Import à confirmer' : status === 'conflict' ? 'Conflit cloud' : 'Cloud indisponible',
    error,
    retry: () => void initialize(status === 'conflict'),
  }), [error, initialize, status])

  return <CloudSyncContext.Provider value={value}>
    {children}
    {status === 'choice' && <div className="cloud-choice-backdrop" role="presentation">
      <section className="cloud-choice" role="dialog" aria-modal="true" aria-labelledby="cloud-choice-title">
        <span className="cloud-choice-icon"><Cloud /></span>
        <h2 id="cloud-choice-title">Connecter ce journal au cloud</h2>
        <p>{foreignLocalCache ? 'Le cache de cet appareil appartient à un autre compte. Pour éviter tout mélange de données, il ne peut pas être importé dans ce compte.' : cloudInfo?.exists ? 'Ce compte contient déjà un journal cloud. Choisis la version à utiliser avant toute synchronisation.' : 'Ton compte est prêt. Importe maintenant les données déjà présentes sur cet appareil sans les effacer.'}</p>
        <div className="cloud-choice-backup"><ShieldAlert /><span><strong>Sauvegarde conservée</strong> L’import crée une copie récupérable et vérifie le nombre d’éléments transférés.</span></div>
        <div className="cloud-choice-actions">
          {cloudInfo?.exists && <button className="primary" onClick={() => void loadCloud()}><CloudDownload /> Charger le journal cloud</button>}
          {!foreignLocalCache && <button className={cloudInfo?.exists ? '' : 'primary'} onClick={() => void importLocal()}><CloudUpload /> {cloudInfo?.exists ? 'Remplacer par mes données locales' : 'Importer mes données locales'}</button>}
          {!cloudInfo?.exists && <button className={foreignLocalCache ? 'primary' : 'text-button'} onClick={() => void startFresh()}><X /> Commencer avec un journal neuf</button>}
          {!foreignLocalCache && <button className="text-button" onClick={() => exportLocalData(JSON.stringify(state))}><Download /> Télécharger d’abord une sauvegarde JSON</button>}
        </div>
      </section>
    </div>}
    {(status === 'error' || status === 'conflict') && <div className="cloud-sync-alert" role="alert"><ShieldAlert/><span><strong>{status === 'conflict' ? 'Une version cloud plus récente existe.' : 'La synchronisation a été interrompue.'}</strong>{error}</span><button onClick={() => void initialize(status === 'conflict')}>Résoudre</button></div>}
  </CloudSyncContext.Provider>
}

export function useCloudSync() {
  const value = useContext(CloudSyncContext)
  if (!value) throw new Error('useCloudSync doit être utilisé dans CloudSyncProvider')
  return value
}
