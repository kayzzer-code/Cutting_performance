import { useCallback, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Cloud, Dumbbell, Home, LogOut, Menu, RotateCcw, ScanBarcode, Target, TrendingUp, Utensils, X } from 'lucide-react'
import { CuttingPerformanceLogo } from './BrandLogo'
import { addDays, formatLongDate, isIsoDate, isoDate } from '../domain/dates'
import type { JournalDateContext } from '../hooks/useJournalDate'
import { useApp } from '../state/AppContext'
import { formatDecimal } from '../domain/format'
import { QuickFoodScanFlow } from './QuickFoodScanFlow'
import { goalTypeLabels } from '../domain/objectives'
import { useAuth } from '../state/AuthContext'
import { useCloudSync } from '../state/CloudSyncContext'

const navItems = [
  { to: '/aujourdhui', label: 'Aujourd’hui', icon: Home },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/semaine', label: 'Semaine', icon: CalendarDays },
  { to: '/progression', label: 'Progression', icon: TrendingUp },
  { to: '/seances', label: 'Séances', icon: Dumbbell },
  { to: '/objectifs', label: 'Objectifs', icon: Target },
]

const mobilePrimary = [navItems[0], navItems[1], navItems[4]]
const mobileMore = [navItems[2], navItems[3], navItems[5]]

export function AppLayout() {
  const { state } = useApp()
  const auth = useAuth()
  const cloud = useCloudSync()
  const [moreOpen, setMoreOpen] = useState(false)
  const [foodScannerOpen, setFoodScannerOpen] = useState(false)
  const [scanNotice, setScanNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDate = isoDate()
  const activeGoal = state.goals.find(goal => goal.id === state.activeGoalId && goal.status === 'active')
  const requestedDate = searchParams.get('date')
  const selectedDate = isIsoDate(requestedDate) && requestedDate <= currentDate ? requestedDate : currentDate
  const openFoodScanner = useCallback(() => setFoodScannerOpen(true), [])
  const journalContext = useMemo<JournalDateContext>(() => ({
    selectedDate,
    openFoodScanner,
    dateHref: (path) => {
      const [pathname, query] = path.split('?')
      const params = new URLSearchParams(query)
      if (selectedDate !== currentDate) params.set('date', selectedDate)
      return `${pathname}${params.size ? `?${params}` : ''}`
    },
  }), [currentDate, openFoodScanner, selectedDate])

  function showScanNotice(message: string) {
    setFoodScannerOpen(false)
    setScanNotice(message)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setScanNotice(''), 3200)
  }

  function selectDate(date: string) {
    if (!isIsoDate(date) || date > currentDate) return
    const next = new URLSearchParams(searchParams)
    if (date === currentDate) next.delete('date')
    else next.set('date', date)
    setSearchParams(next)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <CuttingPerformanceLogo variant="dark" />
        <nav className="desktop-nav" aria-label="Navigation principale">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={journalContext.dateHref(to)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        {auth.configured && <div className="sidebar-account"><span className={`cloud-status ${cloud.status}`}><Cloud /> {cloud.label}</span><small>{auth.user?.email}</small><button type="button" onClick={() => void auth.signOut()}><LogOut /> Se déconnecter</button></div>}
      </aside>

      <main className="main-column">
        <div className="mobile-brand-bar">
          <CuttingPerformanceLogo variant="light" />
          <button className="global-scan-button" type="button" aria-label="Scanner un aliment" onClick={openFoodScanner}><ScanBarcode /><span>Scanner</span></button>
        </div>
        <header className="journal-date-bar">
          <div className="journal-date-copy"><span>Date du journal</span><strong>{selectedDate === currentDate ? 'Aujourd’hui' : 'Historique'}</strong></div>
          <div className="journal-date-controls">
            <button type="button" className="date-arrow" aria-label="Jour précédent" onClick={() => selectDate(addDays(selectedDate, -1))}><ChevronLeft /></button>
            <label className="journal-date-field" title="Choisir une autre date">
              <CalendarDays />
              <span>{formatLongDate(selectedDate)}</span>
              <ChevronDown />
              <input aria-label="Choisir la date du journal" type="date" max={currentDate} value={selectedDate} onChange={(event) => selectDate(event.target.value)} />
            </label>
            <button type="button" className="date-arrow" aria-label="Jour suivant" disabled={selectedDate >= currentDate} onClick={() => selectDate(addDays(selectedDate, 1))}><ChevronRight /></button>
          </div>
          {selectedDate !== currentDate && <button type="button" className="return-today" onClick={() => selectDate(currentDate)}><RotateCcw /> Revenir à aujourd’hui</button>}
          <div className="journal-goal"><Target /> {activeGoal ? activeGoal.type === 'fat-loss' ? `Objectif : −${formatDecimal(Math.abs(activeGoal.targetWeightChangeKgPerWeek))} kg / semaine` : activeGoal.type === 'lean-gain' ? `Objectif : +${formatDecimal(Math.abs(activeGoal.targetWeightChangeKgPerWeek))} kg / semaine` : goalTypeLabels[activeGoal.type] : 'Aucun objectif actif'}</div>
        </header>
        <div className="page-content" key={selectedDate}><Outlet context={journalContext} /></div>
      </main>

      {moreOpen && (
        <div className="mobile-more-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="mobile-more" onClick={(event) => event.stopPropagation()}>
            <div className="mobile-more-head"><strong>Plus</strong><button onClick={() => setMoreOpen(false)} aria-label="Fermer"><X /></button></div>
            {mobileMore.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={journalContext.dateHref(to)} onClick={() => setMoreOpen(false)}>
                {Icon && <Icon size={22} />}<span>{label}</span><ChevronRight size={18} />
              </NavLink>
            ))}
            {auth.configured && <button className="mobile-sign-out" type="button" onClick={() => void auth.signOut()}><LogOut size={22}/><span>Se déconnecter</span><ChevronRight size={18}/></button>}
          </div>
        </div>
      )}

      <nav className="mobile-nav" aria-label="Navigation mobile">
        {mobilePrimary.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={journalContext.dateHref(to)} className={({ isActive }) => isActive ? 'active' : ''}>
            <Icon /><span>{label === 'Aujourd’hui' ? 'Jour' : label}</span>
          </NavLink>
        ))}
        <button className={moreOpen ? 'active' : ''} onClick={() => setMoreOpen(true)}><Menu /><span>Plus</span></button>
      </nav>
      {foodScannerOpen && <QuickFoodScanFlow date={selectedDate} onClose={() => setFoodScannerOpen(false)} onAdded={showScanNotice} />}
      {scanNotice && <div className="global-food-toast" role="status"><span><Utensils /></span>{scanNotice}</div>}
    </div>
  )
}
