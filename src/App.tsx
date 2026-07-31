import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from './components/layout/Sidebar'
import ErrorBoundary from './components/ErrorBoundary'
import Dashboard from './pages/Dashboard'
import Policies from './pages/Policies'
import Family from './pages/Family'
import Calendar from './pages/Calendar'
import SearchPage from './pages/SearchPage'
import Settings from './pages/Settings'
import PolicyForm from './pages/PolicyForm'
import PolicyDetail from './pages/PolicyDetail'
import Analysis from './pages/Analysis'
import { Menu } from 'lucide-react'

function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(v => !v)} />
      <main className="flex-1 overflow-auto bg-gray-50 relative">
        {/* Mobile hamburger button */}
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed top-3 left-3 z-30 p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          aria-label="打开菜单"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>
        <div className="p-4 md:p-6 pt-14 md:pt-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Layout><Dashboard /></Layout>} />
        <Route path="/policies" element={<Layout><Policies /></Layout>} />
        <Route path="/policies/new" element={<Layout><PolicyForm /></Layout>} />
        <Route path="/policies/:id/edit" element={<Layout><PolicyForm /></Layout>} />
        <Route path="/policies/:id" element={<Layout><PolicyDetail /></Layout>} />
        <Route path="/family" element={<Layout><Family /></Layout>} />
        <Route path="/calendar" element={<Layout><Calendar /></Layout>} />
        <Route path="/search" element={<Layout><SearchPage /></Layout>} />
        <Route path="/analysis" element={<Layout><Analysis /></Layout>} />
        <Route path="/settings" element={<Layout><Settings /></Layout>} />
      </Routes>
    </BrowserRouter>
  )
}
