import { NavLink } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db'
import type { PremiumRecord } from '../../types'
import {
  LayoutDashboard, FileText, Users, Calendar,
  Bell, Search, Settings, Shield, Brain, X,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '家庭看板' },
  { to: '/policies', icon: FileText, label: '所有保单' },
  { to: '/family', icon: Users, label: '家庭成员' },
  { to: '/calendar', icon: Calendar, label: '日历提醒' },
  { to: '/search', icon: Search, label: '遇事查保' },
  { to: '/analysis', icon: Brain, label: 'AI 分析' },
  { to: '/settings', icon: Settings, label: '设置' },
]

export default function Sidebar({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  const upcomingCount = useLiveQuery(async () => {
    const today = new Date().toISOString().slice(0, 10)
    const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
    return db.premiums
      .filter((p: PremiumRecord) => !p.paid && p.dueDate >= today && p.dueDate <= future)
      .count()
  }) || 0

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={onToggle} />
      )}

      <aside className={`
        w-56 bg-white border-r border-gray-200 flex flex-col h-screen flex-shrink-0
        transition-transform duration-200 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 fixed md:relative z-50 md:z-auto
      `}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-blue-600" />
            <span className="font-bold text-lg text-gray-800">保单管家</span>
          </div>
          <button onClick={onToggle} className="md:hidden text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-400 px-4 pb-2">你的家庭保险中心</p>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => {
                if (window.innerWidth < 768) onToggle()
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {upcomingCount > 0 && (
          <div className="p-3 border-t border-gray-100">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 rounded-lg">
              <Bell className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-amber-700">近30天有 {upcomingCount} 条缴费提醒</span>
            </div>
          </div>
        )}
      </aside>
    </>
  )
}
