import { useMemo, useState } from 'react'
import { NavLink, Outlet, useSearchParams } from 'react-router-dom'
import { Activity, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Dumbbell, Home, Menu, RotateCcw, Settings, Target, TrendingUp, Utensils, X } from 'lucide-react'
import { CuttingPerformanceLogo } from './BrandLogo'
import { addDays, formatLongDate, isIsoDate, isoDate } from '../domain/dates'
import type { JournalDateContext } from '../hooks/useJournalDate'
import { useApp } from '../state/AppContext'
import { formatDecimal } from '../domain/format'

const navItems = [
  { to: '/aujourdhui', label: 'Aujourd’hui', icon: Home },
  { to: '/activites', label: 'Activités', icon: Activity },
  { to: '/nutrition', label: 'Nutrition', icon: Utensils },
  { to: '/semaine', label: 'Semaine', icon: CalendarDays },
  { to: '/progression', label: 'Progression', icon: TrendingUp },
  { to: '/musculation', label: 'Musculation', icon: Dumbbell },
  { to: '/parametres', label: 'Paramètres', icon: Settings },
]

const mobilePrimary = navItems.slice(0, 4)
const mobileMore = navItems.slice(4)

export function AppLayout() {
  const { state } = useApp()
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const currentDate = isoDate()
  const requestedDate = searchParams.get('date')
  const selectedDate = isIsoDate(requestedDate) && requestedDate <= currentDate ? requestedDate : currentDate
  const journalContext = useMemo<JournalDateContext>(() => ({
    selectedDate,
    dateHref: (path) => selectedDate === currentDate ? path : `${path}?date=${selectedDate}`,
  }), [currentDate, selectedDate])

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
        <div className="mobile-brand-bar"><CuttingPerformanceLogo variant="light" /></div>
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
    </div>
  )
}
