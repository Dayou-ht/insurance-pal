import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Link } from 'react-router-dom'
import { Search, AlertTriangle, ArrowRight } from 'lucide-react'

const SUGGESTED_EVENTS = [
  '意外骨折', '疾病住院', '门诊看病', '手术', '确诊癌症',
  '车辆事故', '火灾', '自然灾害', '伤残', '身故',
  '退休养老', '孩子教育金', '分红到期'
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [searched, setSearched] = useState(false)

  const policies = useLiveQuery(() => db.policies.where('status').equals('有效').toArray()) || []
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const allCoverages = useLiveQuery(() => db.coverages.toArray()) || []
  const personMap = new Map(persons.map(p => [p.id!, p]))

  // 保单ID → 保额合计 映射
  const coverageTotalMap = new Map<number, number>()
  for (const c of allCoverages) {
    coverageTotalMap.set(c.policyId, (coverageTotalMap.get(c.policyId) || 0) + c.amount)
  }

  function getCoverageAmount(policyId: number): number {
    return coverageTotalMap.get(policyId) || 0
  }

  async function handleSearch(input: string) {
    setQuery(input)
    if (!input.trim()) { setResults([]); setSearched(false); return }

    // 从用户的输入中提取关键词，匹配险种
    const categoryMap: Record<string, string> = {
      '住院': '医疗险', '疾病': '医疗险', '医疗': '医疗险', '看病': '医疗险', '门诊': '医疗险',
      '手术': '医疗险', '癌症': '重疾险', '肿瘤': '重疾险', '重疾': '重疾险', '大病': '重疾险',
      '意外': '意外险', '骨折': '意外险', '受伤': '意外险', '伤残': '意外险',
      '身故': '寿险', '死亡': '寿险', '寿命': '寿险',
      '养老': '年金险', '退休': '年金险', '年金': '年金险',
      '分红': '分红险', '教育': '年金险',
      '车': '车险', '驾驶': '车险',
      '旅行': '旅行险', '旅游': '旅行险', '出行': '旅行险',
      '火灾': '家财险', '家': '家财险', '房屋': '家财险',
    }

    const matchedCategories = new Set<string>()
    for (const [keyword, category] of Object.entries(categoryMap)) {
      if (input.includes(keyword)) matchedCategories.add(category)
    }

    let matched: typeof policies = []
    if (matchedCategories.size > 0) {
      matched = policies.filter(p => matchedCategories.has(p.category))
    } else {
      // 没有关键词匹配时，搜索保单名称、保司、保单号和备注
      matched = policies.filter(p =>
        p.productName.includes(input) ||
        p.insurer.includes(input) ||
        (p.policyNumber && p.policyNumber.includes(input)) ||
        (p.note && p.note.includes(input))
      )
    }

    setResults(matched)
    setSearched(true)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">遇事查保</h1>
        <p className="text-sm text-gray-500 mt-1">输入你遇到的情况，系统自动匹配可以理赔的保单</p>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="描述你遇到的情况，比如：意外骨折住院、确诊癌症..."
          value={query}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 shadow-sm"
        />
      </div>

      {/* 快捷场景 */}
      {!searched && (
        <div>
          <h3 className="text-sm text-gray-500 mb-2">快捷查询</h3>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_EVENTS.map(ev => (
              <button key={ev} onClick={() => handleSearch(ev)}
                className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
                {ev}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 搜索结果 */}
      {searched && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            {results.length > 0
              ? `找到 ${results.length} 份可能相关的保单`
              : '未匹配到相关保单，建议试试其他关键词或检查保单类别是否正确'}
          </p>

          {results.map(p => {
            const holder = p.holderId ? personMap.get(p.holderId) : null
            return (
              <Link key={p.id} to={`/policies/${p.id}`}
                className="block bg-white rounded-xl p-4 border border-gray-100 hover:border-blue-200 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-800">{p.productName}</h3>
                      <span className="text-xs px-2 py-0.5 bg-green-50 text-green-700 rounded-full">{p.status}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {p.insurer} · {p.category}
                      {holder && ` · 投保人：${holder.name}`}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <span className="text-blue-700 font-medium">保额 ¥{getCoverageAmount(p.id!).toLocaleString()}</span>
                  <span className="text-gray-400">📅 {p.startDate} ~ {p.endDate}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {results.length === 0 && searched && (
        <div className="text-center py-16">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-300" />
          <h3 className="text-lg font-medium text-gray-600">没有匹配结果</h3>
          <p className="text-sm text-gray-400 mt-1">建议把保单的保障权益填写完整，匹配会更准确</p>
        </div>
      )}
    </div>
  )
}
