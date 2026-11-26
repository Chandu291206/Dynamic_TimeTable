import { BrowserRouter, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Footer from './components/Footer.jsx'
import Navbar from './components/Navbar.jsx'
import { ToastProvider } from './components/Toast.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import DesignerPage from './pages/DesignerPage.jsx'
import LiveMonitorPage from './pages/LiveMonitorPage.jsx'
import CRDashboard from './pages/CRDashboard.jsx'
import CRLogin from './pages/CRLogin.jsx'
import AllTimetablesPage from './pages/AllTimetablesPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PlaceholderPage from './pages/PlaceholderPage.jsx'
import TimetablePage from './pages/TimetablePage.jsx'

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="site-shell">
          <Navbar />
          <main>
            <ErrorBoundary>
              <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/timetables" element={<AllTimetablesPage />} />
              <Route path="/timetable/:classId" element={<TimetablePage />} />
              <Route path="/cr/login" element={<CRLogin />} />
              <Route path="/cr/dashboard" element={<CRDashboard />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/designer" element={<DesignerPage />} />
              <Route path="/admin/designer/:classId" element={<DesignerPage />} />
              <Route path="/admin/live-monitor" element={<LiveMonitorPage />} />
              <Route path="/admin/monitor" element={<LiveMonitorPage />} />
              <Route path="*" element={<PlaceholderPage kind="notFound" />} />
            </Routes>
            </ErrorBoundary>
          </main>
          <Footer />
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
