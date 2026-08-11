import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { TrackerProvider, useTracker } from './hooks/useTracker'
import { AddEntry } from './views/AddEntry'
import { History } from './views/History'
import { Settings } from './views/Settings'
import { Trends } from './views/Trends'

function Shell() {
  const { ready, queueCount } = useTracker()

  if (!ready) {
    return (
      <div className="boot">
        <p className="brand">Daymark</p>
        <p>Loading your log…</p>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <main className="app-main">
        <Routes>
          <Route path="/" element={<AddEntry />} />
          <Route path="/history" element={<History />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="bottom-nav" aria-label="Primary">
        <NavLink to="/" end>
          Log
        </NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/trends">Trends</NavLink>
        <NavLink to="/settings" className="nav-settings">
          Settings
          {queueCount > 0 ? <span className="queue-dot" aria-label={`${queueCount} pending sync`} /> : null}
        </NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <TrackerProvider>
      <Shell />
    </TrackerProvider>
  )
}
