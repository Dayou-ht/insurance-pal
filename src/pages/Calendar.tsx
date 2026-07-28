import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths, getYear } from 'date-fns'
import { ChevronLeft, ChevronRight, DollarSign, Gift, Bell, BarChart3 } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const policies = useLiveQuery(() => db.policies.toArray()) || []
  const premiums = useLiveQuery(() => db.premiums.toArray()) || []
  const benefits = useLiveQuery(() => db.benefits.toArray()) || []
  const reminders = useLiveQuery(() => db.reminders.toArray()) || []

  // 本年各月保费合计
  const currentYear = getYear(new Date())
  const monthlyPremiums = useMemo(() => {
    const byMonth = Array(12).fill(0)
    for (const p of premiums) {
      const year = parseInt(p.dueDate.slice(0, 4), 10)
      if (year === currentYear && !p.paid) {
        const month = parseInt(p.dueDate.slice(5, 7), 10) - 1
        byMonth[month] += p.amount
      }
    }
    return byMonth
  }, [premiums, currentYear])
  const maxMonthly = Math.max(...monthlyPremiums, 1)

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  // 缴费日映射
  const premiumMap = new Map<string, typeof premiums>()
  premiums.forEach(p => {
    const key = p.dueDate
    if (!premiumMap.has(key)) premiumMap.set(key, [])
    premiumMap.get(key)!.push(p)
  })

  // 分红/生存金日映射
  const benefitMap = new Map<string, typeof benefits>()
  benefits.forEach(b => {
    const key = b.expectedDate
    if (!benefitMap.has(key)) benefitMap.set(key, [])
    benefitMap.get(key)!.push(b)
  })

  // 提醒日映射（续保、理赔跟进等）
  const reminderMap = new Map<string, typeof reminders>()
  reminders.forEach(r => {
    const key = r.date
    if (!reminderMap.has(key)) reminderMap.set(key, [])
    reminderMap.get(key)!.push(r)
  })

  const selectedPremiums = selectedDate ? premiumMap.get(format(selectedDate, 'yyyy-MM-dd')) || [] : []
  const selectedBenefits = selectedDate ? benefitMap.get(format(selectedDate, 'yyyy-MM-dd')) || [] : []
  const selectedReminders = selectedDate ? reminderMap.get(format(selectedDate, 'yyyy-MM-dd')) || [] : []

  function getDayEvents(date: Date) {
    const dateStr = format(date, 'yyyy-MM-dd')
    const p = premiumMap.get(dateStr) || []
    const b = benefitMap.get(dateStr) || []
    const r = reminderMap.get(dateStr) || []
    return { hasPremium: p.length > 0, hasBenefit: b.length > 0, hasReminder: r.length > 0, count: p.length + b.length + r.length }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-800">日历提醒</h1>

      {/* 年度保费分布 */}
      {monthlyPremiums.some(m => m > 0) && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-gray-500" />
            <h3 className="font-semibold text-gray-700">{currentYear}年待缴保费分布</h3>
            <span className="text-xs text-gray-400 ml-auto">
              合计 ¥{monthlyPremiums.reduce((a, b) => a + b, 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-20">
            {monthlyPremiums.map((amt, i) => {
              const pct = (amt / maxMonthly) * 100
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-400 font-medium">{amt > 0 ? `¥${(amt / 10000).toFixed(1)}万` : ''}</span>
                  <div className="w-full bg-gray-50 rounded-sm overflow-hidden flex-1 self-end"
                    style={{ height: `${Math.max(pct, 0)}%` }}>
                    <div className="w-full bg-gradient-to-t from-blue-400 to-blue-300 rounded-sm h-full transition-all" />
                  </div>
                  <span className="text-[10px] text-gray-400">{i + 1}月</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-[1fr_380px] gap-6">
        {/* 日历 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          {/* 月份切换 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-50 rounded-lg">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h2 className="font-semibold text-gray-800">{format(currentMonth, 'yyyy年 M月')}</h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-gray-50 rounded-lg">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 星期头 */}
          <div className="grid grid-cols-7 mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-center text-xs text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {/* 日期格 */}
          <div className="grid grid-cols-7 gap-1">
            {/* 填充月初空白 */}
            {Array.from({ length: getDay(days[0]) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20" />
            ))}

            {days.map(day => {
              const events = getDayEvents(day)
              const isSelected = selectedDate && isSameDay(day, selectedDate)
              const isToday = isSameDay(day, new Date())

              return (
                <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                  className={`h-20 rounded-lg p-1 text-left transition-colors relative ${
                    isSelected ? 'bg-blue-50 ring-2 ring-blue-200' :
                    isToday ? 'bg-blue-50' :
                    'hover:bg-gray-50'
                  }`}>
                  <span className={`text-xs font-medium ${isToday ? 'text-blue-700' : 'text-gray-600'}`}>
                    {format(day, 'd')}
                  </span>
                  {events.count > 0 && (
                    <div className="absolute bottom-1 left-1 right-1 space-y-0.5">
                      {events.hasPremium && <div className="h-1.5 w-full bg-red-400 rounded-full" />}
                      {events.hasBenefit && <div className="h-1.5 w-full bg-green-400 rounded-full" />}
                      {events.hasReminder && <div className="h-1.5 w-full bg-yellow-400 rounded-full" />}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧详情 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-4 border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-700 mb-3">
              {selectedDate ? format(selectedDate, 'M月d日 EEEE') : '点击日期查看详情'}
            </h3>

            {/* 缴费 */}
            {selectedPremiums.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-sm text-red-600 font-medium mb-2">
                  <DollarSign className="w-4 h-4" /> 缴费提醒
                </div>
                {selectedPremiums.map(p => {
                  const policy = policies.find(pol => pol.id === p.policyId)
                  return (
                    <div key={p.id} className="p-2 bg-red-50 rounded-lg mb-1 text-sm">
                      <div className="flex items-center justify-between">
                        <Link to={`/policies/${p.policyId}`} className="text-gray-700 hover:underline flex-1 min-w-0 truncate">
                          {policy?.productName || '未知'}
                        </Link>
                        <span className="text-red-600 font-medium flex-shrink-0 ml-2">¥{p.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <button onClick={async () => {
                          if (p.paid) {
                            await db.premiums.update(p.id!, { paid: false, paidDate: undefined })
                          } else {
                            await db.premiums.update(p.id!, { paid: true, paidDate: new Date().toISOString().slice(0, 10) })
                          }
                        }}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            p.paid
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                          }`}>
                          {p.paid ? '✅ 已缴费' : '⏳ 待缴费'}
                        </button>
                        <Link to={`/policies/${p.policyId}`} className="text-xs text-blue-600 hover:underline">查看保单</Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 分红/生存金 */}
            {selectedBenefits.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-sm text-green-600 font-medium mb-2">
                  <Gift className="w-4 h-4" /> 资金领取
                </div>
                {selectedBenefits.map(b => {
                  const policy = policies.find(pol => pol.id === b.policyId)
                  return (
                    <Link key={b.id} to={`/policies/${b.policyId}`}
                      className="block p-2 bg-green-50 rounded-lg mb-1 text-sm hover:bg-green-100">
                      <span className="text-gray-700">{b.type}</span>
                      <span className="float-right text-green-600 font-medium">¥{b.amount.toLocaleString()}</span>
                      <span className="block text-xs text-gray-400">{policy?.productName}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* 其他提醒（续保、理赔跟进等） */}
            {selectedReminders.length > 0 && (
              <div className="mb-3">
                <div className="flex items-center gap-1.5 text-sm text-yellow-600 font-medium mb-2">
                  <Bell className="w-4 h-4" /> 其他提醒
                </div>
                {selectedReminders.filter(r => r.type !== '缴费').map(r => {
                  const policy = policies.find(pol => pol.id === r.policyId)
                  return (
                    <Link key={r.id} to={`/policies/${r.policyId}`}
                      className="block p-2 bg-yellow-50 rounded-lg mb-1 text-sm hover:bg-yellow-100">
                      <span className="text-gray-700">{r.title}</span>
                      <span className="block text-xs text-gray-400">{r.done ? '✅ 已完成' : '⏳ 待处理'} · {policy?.productName}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {selectedPremiums.length === 0 && selectedBenefits.length === 0 && selectedReminders.length === 0 && selectedDate && (
              <div className="text-center py-6 text-gray-400 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>当天无待办事项</p>
              </div>
            )}
          </div>

          {/* 图例 */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 text-sm">
            <h4 className="text-gray-600 font-medium mb-2">图例</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-4 h-1.5 bg-red-400 rounded-full" />
                <span className="text-gray-500">缴费提醒</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1.5 bg-green-400 rounded-full" />
                <span className="text-gray-500">分红/生存金领取</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-1.5 bg-yellow-400 rounded-full" />
                <span className="text-gray-500">续保/其他提醒</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
