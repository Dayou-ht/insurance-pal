import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText } from 'lucide-react'
import { formatPaymentFreq } from '../types'
import type { InsuranceCategory } from '../types'

const CATEGORIES: InsuranceCategory[] = ['重疾险','医疗险','意外险','寿险','年金险','分红险','万能险','车险','家财险','学平险','旅行险','危疾保险','储蓄保险','投资相连','其他']

export default function Policies() {
  const [searchParams] = useSearchParams()
  const policies = useLiveQuery(() => db.policies.toArray()) || []
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<string>(searchParams.get('category') || '全部')
  const [filterStatus, setFilterStatus] = useState<string>('全部')
  const [sortBy, setSortBy] = useState<string>('默认')

  const currencySymbol: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$' }
  const cs = (c?: string) => currencySymbol[c || 'CNY'] || '¥'
  const personMap = new Map(persons.map(p => [p.id!, p.name]))

  const filtered = policies.filter(p => {
    if (search && !p.productName.includes(search) && !p.insurer.includes(search) && !p.policyNumber.includes(search)) return false
    if (filterCat !== '全部' && p.category !== filterCat) return false
    const insurerFilter = searchParams.get('insurer')
    if (insurerFilter && p.insurer !== insurerFilter) return false
    const personFilter = searchParams.get('person')
    if (personFilter && p.holderId !== Number(personFilter) && !p.insuredIds.includes(Number(personFilter))) return false
    if (filterStatus !== '全部' && p.status !== filterStatus) return false
    return true
  })

  // 排序
  const sorted = useMemo(() => {
    const list = [...filtered]
    switch (sortBy) {
      case '保费从高到低': return list.sort((a, b) => b.premium - a.premium)
      case '保费从低到高': return list.sort((a, b) => a.premium - b.premium)
      case '起保从新到旧': return list.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''))
      case '起保从旧到新': return list.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''))
      default: return list
    }
  }, [filtered, sortBy])

  const maxPremium = useMemo(() => Math.max(...filtered.map(p => p.premium), 1), [filtered])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">所有保单</h1>
        <Link to="/policies/new" className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> 添加保单
        </Link>
      </div>

      {/* 搜索和筛选 */}
      <div className="flex gap-3 items-center">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="搜索保单名称/保司/保单号..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400"
          />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option>全部险种</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option>全部状态</option>
          <option>有效</option><option>已过期</option><option>已退保</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
          <option>默认排序</option>
          <option>保费从高到低</option>
          <option>保费从低到高</option>
          <option>起保从新到旧</option>
          <option>起保从旧到新</option>
        </select>
      </div>

      {/* 保单列表 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>还没有保单，点击右上角添加</p>
          </div>
        ) : (
          <>
            {sorted.map(p => {
              const pct = Math.min((p.premium / maxPremium) * 100, 85) // 最大85%，不满铺留白
              const barWidth = pct ? Math.max(pct, 5) : 0

              return (
                <Link key={p.id} to={`/policies/${p.id}`}
                  className="block bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-sm transition-all overflow-hidden">
                  <div className="flex items-stretch min-h-[88px]">
                    {/* 左侧 - 保单信息 */}
                    <div className="flex-1 p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-800 truncate">{p.productName}</h3>
                        {p.parentPolicyId != null ? (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 font-bold flex-shrink-0">附</span>
                        ) : (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-bold flex-shrink-0">主</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                          p.status === '有效' ? 'bg-green-50 text-green-700' :
                          p.status === '已过期' ? 'bg-red-50 text-red-600' :
                          'bg-gray-50 text-gray-500'
                        }`}>{p.status}</span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span>{p.insurer}</span>
                        <span className="text-gray-300">|</span>
                        <span>{p.category}</span>
                        {p.holderId && personMap.has(p.holderId) && (
                          <>
                            <span className="text-gray-300">|</span>
                            <span>投保人：{personMap.get(p.holderId)}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                        <span>📅 {p.startDate} ~ {p.endDate}</span>
                        {p.paymentDay > 0 && <span>💳 {formatPaymentFreq(p.paymentMethod, p.paymentDay, p.startDate)}</span>}
                      </div>
                    </div>

                    {/* 右侧 - 保费柱状图 */}
                    <div className="flex flex-col items-end justify-center pr-4 pl-2 py-3 flex-shrink-0">
                      <div className="text-sm font-semibold text-gray-800 whitespace-nowrap">
                        {cs(p.currency)}{p.premium.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-gray-400 mb-1.5">{p.paymentMethod}</div>
                      <div className="w-20 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
