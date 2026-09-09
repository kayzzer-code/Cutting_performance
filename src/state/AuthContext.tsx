/* oxlint-disable react/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, requireSupabase, supabase } from '../lib/supabase'

interface AuthContextValue {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ confirmationRequired: boolean }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Impossible de relire la session Supabase', error)
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw error
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const redirectTo = `${window.location.origin}/auth/connexion`
    const { data, error } = await requireSupabase().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirectTo } })
    if (error) throw error
    return { confirmationRequired: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (error) throw error
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/nouveau-mot-de-passe`
    const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw error
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await requireSupabase().auth.updateUser({ password })
    if (error) throw error
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    loading,
    session,
    user: session?.user ?? null,
    signIn,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
  }), [loading, requestPasswordReset, session, signIn, signOut, signUp, updatePassword])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return value
}
