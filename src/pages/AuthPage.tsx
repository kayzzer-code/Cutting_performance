import { useState, type FormEvent } from 'react'
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react'
import { CuttingPerformanceLogo } from '../components/BrandLogo'
import { useAuth } from '../state/AuthContext'

type AuthMode = 'sign-in' | 'sign-up' | 'forgot' | 'new-password'

const copy: Record<AuthMode, { title: string; description: string; submit: string }> = {
  'sign-in': { title: 'Retrouve tes données', description: 'Connecte-toi pour synchroniser ton suivi sur tous tes appareils.', submit: 'Se connecter' },
  'sign-up': { title: 'Créer ton espace privé', description: 'Tes journées, repas et séances seront isolés par des règles de sécurité Supabase.', submit: 'Créer mon compte' },
  forgot: { title: 'Mot de passe oublié', description: 'Nous t’enverrons un lien sécurisé pour choisir un nouveau mot de passe.', submit: 'Envoyer le lien' },
  'new-password': { title: 'Nouveau mot de passe', description: 'Choisis un mot de passe d’au moins 8 caractères.', submit: 'Mettre à jour' },
}

export function AuthPage({ mode }: { mode: AuthMode }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (!auth.configured) return <Navigate to="/aujourdhui" replace />
  if (auth.user && mode !== 'new-password') {
    const requested = (location.state as { from?: string } | null)?.from
    return <Navigate to={requested || '/aujourdhui'} replace />
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(''); setNotice('')
    if (mode !== 'forgot' && mode !== 'sign-in' && password.length < 8) { setError('Utilise au moins 8 caractères.'); return }
    if ((mode === 'sign-up' || mode === 'new-password') && password !== confirmPassword) { setError('Les deux mots de passe ne correspondent pas.'); return }
    setBusy(true)
    try {
      if (mode === 'sign-in') {
        await auth.signIn(email, password)
        navigate('/aujourdhui', { replace: true })
      } else if (mode === 'sign-up') {
        const result = await auth.signUp(email, password)
        if (result.confirmationRequired) setNotice('Compte créé. Ouvre l’e-mail de confirmation, puis reviens te connecter.')
        else navigate('/aujourdhui', { replace: true })
      } else if (mode === 'forgot') {
        await auth.requestPasswordReset(email)
        setNotice('Lien envoyé. Vérifie également le dossier des courriers indésirables.')
      } else {
        await auth.updatePassword(password)
        setNotice('Mot de passe mis à jour. Tu peux reprendre ton suivi.')
        window.setTimeout(() => navigate('/aujourdhui', { replace: true }), 900)
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      setError(message === 'Invalid login credentials' ? 'E-mail ou mot de passe incorrect.' : message)
    } finally { setBusy(false) }
  }

  const meta = copy[mode]
  const asksEmail = mode !== 'new-password'
  const asksPassword = mode !== 'forgot'
  return <main className="auth-page">
    <section className="auth-brand-panel">
      <CuttingPerformanceLogo variant="dark" />
      <div><span className="auth-eyebrow"><ShieldCheck /> Données privées</span><h1>Ton suivi,<br/>sur tous tes appareils.</h1><p>Nutrition, cardio, objectifs et performances restent réunis dans un espace personnel sécurisé.</p></div>
      <p className="auth-security"><LockKeyhole /> Aucun autre compte ne peut lire tes données.</p>
    </section>
    <section className="auth-form-panel">
      <form className="auth-card" onSubmit={submit}>
        <span className="auth-card-icon">{mode === 'forgot' || mode === 'new-password' ? <KeyRound /> : <ShieldCheck />}</span>
        <h2>{meta.title}</h2><p>{meta.description}</p>
        {asksEmail && <label><span>Adresse e-mail</span><div><Mail/><input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="toi@exemple.fr"/></div></label>}
        {asksPassword && <label><span>{mode === 'new-password' ? 'Nouveau mot de passe' : 'Mot de passe'}</span><div><LockKeyhole/><input required minLength={8} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum"/></div></label>}
        {(mode === 'sign-up' || mode === 'new-password') && <label><span>Confirmer le mot de passe</span><div><LockKeyhole/><input required minLength={8} autoComplete="new-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Répète le mot de passe"/></div></label>}
        {mode === 'sign-in' && <Link className="auth-forgot" to="/auth/mot-de-passe-oublie">Mot de passe oublié ?</Link>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {notice && <p className="auth-notice" role="status"><CheckCircle2 /> {notice}</p>}
        <button className="auth-submit" disabled={busy}>{busy ? 'Traitement…' : meta.submit}<ArrowRight /></button>
        {mode === 'sign-in' && <p className="auth-switch">Pas encore de compte ? <Link to="/auth/inscription">Créer mon espace</Link></p>}
        {mode === 'sign-up' && <p className="auth-switch">Déjà un compte ? <Link to="/auth/connexion">Se connecter</Link></p>}
        {(mode === 'forgot' || mode === 'new-password') && <p className="auth-switch"><Link to="/auth/connexion">Retour à la connexion</Link></p>}
      </form>
    </section>
  </main>
}
