import { useCallback, useMemo, useRef, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { Activity, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Home, Menu, RotateCcw, ScanBarcode, Settings, Target, TrendingUp, Utensils, X } from 'lucide-react'
import { CuttingPerformanceLogo } from './BrandLogo'
import { addDays, formatLongDate, isIsoDate, isoDate } from '../domain/dates'
import type { JournalDateContext } from '../hooks/useJournalDate'
import { useApp } from '../state/AppContext'
import { formatDecimal } from '../domain/format'
import { QuickFoodScanFlow } from './QuickFoodScanFlow'

const navItems = [
  { to: '/aujourdhui', label: 'Aujourd’hui', icon: Home },
  { to: '/activites', label: 'Activités', icon: Activity },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/semaine', label: 'Semaine', icon: CalendarDays },
  { to: '/progression', label: 'Progression', icon: TrendingUp },
  { to: '/seances', label: 'Séances', icon: Dumbbell },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
]

const mobilePrimary = [navItems[0], navItems[1], navItems[2], navItems[5]]
const mobileMore = [navItems[3], navItems[4], navItems[6]]

export function AppLayout() {
  const { state } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const [foodScannerOpen, setFoodScannerOpen] = useState(false)
  const [scanNotice, setScanNotice] = useState('')
  const noticeTimer = useRef<number | undefined>(undefined)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDate = isoDate()
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
          <div className="journal-goal"><Target /> Objectif : −{formatDecimal(state.profile.weeklyLossTargetKg)} kg / semaine</div>
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
