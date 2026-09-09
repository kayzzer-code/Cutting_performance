// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../domain/storage'
import { CloudSyncProvider, useCloudSync } from './CloudSyncContext'

const mocks = vi.hoisted(() => ({
  auth: { configured: true, user: { id: 'user-1' } },
  state: { revision: 0 },
  replaceState: vi.fn(),
  inspectCloudState: vi.fn(),
  loadCloudState: vi.fn(),
  saveCloudState: vi.fn(),
}))

vi.mock('./AuthContext', () => ({ useAuth: () => mocks.auth }))
vi.mock('./AppContext', () => ({ useApp: () => ({ state: mocks.state, replaceState: mocks.replaceState }) }))
vi.mock('../lib/supabase', () => ({ requireSupabase: () => ({}) }))
vi.mock('../services/cloudStateRepository', () => ({
  inspectCloudState: mocks.inspectCloudState,
  loadCloudState: mocks.loadCloudState,
  saveCloudState: mocks.saveCloudState,
}))

function StatusProbe() {
  const cloud = useCloudSync()
  return <output aria-label="État cloud">{cloud.status}:{cloud.label}</output>
}

describe('démarrage cloud automatique', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('charge toujours le journal cloud existant sans demander quelle version utiliser', async () => {
    const remote = { revision: 7 }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ legacy: true }))
    mocks.inspectCloudState.mockResolvedValue({ exists: true, revision: 7 })
    mocks.loadCloudState.mockResolvedValue(remote)

    render(<CloudSyncProvider><StatusProbe /></CloudSyncProvider>)

    await waitFor(() => expect(screen.getByLabelText('État cloud').textContent).toBe('synced:Synchronisé'))
    expect(mocks.loadCloudState).toHaveBeenCalledWith({}, 'user-1')
    expect(mocks.saveCloudState).not.toHaveBeenCalled()
    expect(mocks.replaceState).toHaveBeenCalledWith(remote, 'Données cloud chargées')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(localStorage.getItem('cutting-performance-app:legacy-local-backup:unlinked')).toBe(JSON.stringify({ legacy: true }))
  })

  it('crée automatiquement un journal cloud neuf pour un nouveau compte', async () => {
    mocks.inspectCloudState.mockResolvedValue({ exists: false, revision: 0 })
    mocks.saveCloudState.mockResolvedValue({ revision: 1, syncedAt: '2026-09-09T20:00:00Z' })

    render(<CloudSyncProvider><StatusProbe /></CloudSyncProvider>)

    await waitFor(() => expect(screen.getByLabelText('État cloud').textContent).toBe('synced:Synchronisé'))
    expect(mocks.loadCloudState).not.toHaveBeenCalled()
    expect(mocks.saveCloudState).toHaveBeenCalledWith({}, 'user-1', expect.objectContaining({ schemaVersion: 6 }), 'automatic')
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
