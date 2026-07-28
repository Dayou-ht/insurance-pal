import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { analyzeInsurance, getAiConfig } from '../services/ai'
import { Brain, AlertTriangle, CheckCircle, Lightbulb, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'

const ALL_CATEGORIES = ['重疾险','医疗险','意外险','寿险','年金险','分红险','万能险','车险','家财险','学平险','旅行险','危疾保险','储蓄保险','投资相连']

/** 从文本中提取提到的险种名称 */
function findMentionedCategories(text: string): string[] {
  return ALL_CATEGORIES.filter(cat => text.includes(cat))
}

export default function Analysis() {
  const [scope, setScope] = useState<'个人' | '家庭'>('家庭')
  const [selectedPerson, setSelectedPerson] = useState<number | null>(null)
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const policies = useLiveQuery(() => db.policies.where('status').equals('有效').toArray()) || []
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const coverages = useLiveQuery(() => db.coverages.toArray()) || []

  const personMap = new Map(persons.map(p => [p.id!, p]))

  function buildPoliciesData(personId?: number) {
    const filtered = personId
      ? policies.filter(p => p.holderId === personId || p.insuredIds.includes(personId))
      : policies

    return filtered.map(p => {
      const holder = personMap.get(p.holderId)
      const insureds = p.insuredIds.map(id => personMap.get(id)?.name).filter(Boolean).join('、')
      const covs = coverages.filter(c => c.policyId === p.id)
      return `
保单：${p.productName}
保司：${p.insurer}
险种：${p.category}
投保人：${holder?.name || '未知'}
被保人：${insureds || '未知'}
保费：¥${p.premium}/年（${p.paymentMethod}）
期间：${p.startDate} ~ ${p.endDate}
保障权益：${covs.length > 0 ? covs.map(c => `  - ${c.name}：保额¥${c.amount.toLocaleString()}（${c.condition}）`).join('\n') : '  未录入'}
      `.trim()
    }).join('\n---\n')
  }

  async function handleAnalyze() {
    if (!getAiConfig()) {
      setError('请先在设置中配置 AI API Key')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const data = scope === '个人' && selectedPerson
        ? buildPoliciesData(selectedPerson)
        : buildPoliciesData()

      const memberName = selectedPerson ? personMap.get(selectedPerson)?.name || '' : ''

      const res = await analyzeInsurance(scope, memberName, data)
      setResult(res)
    } catch (err: any) {
      setError(err.message || '分析失败')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Brain className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">AI 保障分析</h1>
          <p className="text-sm text-gray-500">基于现有保单，用 AI 分析保障配置的合理性</p>
        </div>
      </div>

      {/* 配置引导 */}
      {!getAiConfig() && (
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800">未配置 AI API Key</p>
              <p className="text-sm text-amber-700 mt-1">需要配置 API Key 才能使用 AI 分析功能。</p>
              <Link to="/settings" className="text-sm text-blue-600 hover:underline mt-1 inline-block">前往设置 →</Link>
            </div>
          </div>
        </div>
      )}

      {/* 分析范围选择 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['个人', '家庭'] as const).map(s => (
              <button key={s} onClick={() => { setScope(s); setResult(null) }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  scope === s ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {s === '个人' ? '👤 个人分析' : '🏠 家庭分析'}
              </button>
            ))}
          </div>

          {scope === '个人' && (
            <select value={selectedPerson || ''} onChange={e => setSelectedPerson(Number(e.target.value) || null)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">选择分析对象</option>
              {persons.map(p => (
                <option key={p.id} value={p.id}>{p.name}（{p.relation}）</option>
              ))}
            </select>
          )}

          <button onClick={handleAnalyze} disabled={loading || !getAiConfig()}
            className="ml-auto flex items-center gap-1.5 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {loading ? '分析中...' : '开始分析'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 rounded-xl p-4 border border-red-200 text-sm text-red-600">{error}</div>
      )}

      {/* 分析结果 */}
      {result && (
        <div className="space-y-4">
          {/* 总体评价 */}
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-700 mb-2">📋 总体评价</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{result.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* 优势 */}
            <div className="bg-green-50 rounded-xl p-5 border border-green-100">
              <h3 className="font-semibold text-green-800 mb-3 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> 配置亮点
              </h3>
              <ul className="space-y-2">
                {result.strengths?.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-green-700 flex gap-2">
                    <span className="text-green-500 flex-shrink-0">✓</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>

            {/* 缺口 */}
            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
              <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> 保障缺口
              </h3>
              <ul className="space-y-2">
                {result.gaps?.map((s: string, i: number) => {
                  const cats = findMentionedCategories(s)
                  return (
                    <li key={i} className="text-sm text-amber-700">
                      <span className="flex gap-2">
                        <span className="text-amber-500 flex-shrink-0">!</span>
                        <span>{s}</span>
                      </span>
                      {cats.length > 0 && (
                        <div className="flex gap-1.5 mt-1 ml-5">
                          {cats.map(cat => (
                            <Link key={cat} to={`/policies?category=${encodeURIComponent(cat)}`}
                              className="text-xs px-2 py-0.5 bg-white rounded border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors">
                              → 查看{cat}
                            </Link>
                          ))}
                          <Link to="/policies/new"
                            className="text-xs px-2 py-0.5 bg-white rounded border border-amber-200 text-amber-600 hover:bg-amber-100 transition-colors">
                            + 添加保单
                          </Link>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>

          {/* 重叠 */}
          {result.overlaps?.length > 0 && (
            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
              <h3 className="font-semibold text-red-700 mb-3">🔄 保障重叠</h3>
              <ul className="space-y-2">
                {result.overlaps.map((s: string, i: number) => (
                  <li key={i} className="text-sm text-red-600 flex gap-2">
                    <span className="text-red-400">→</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 优化建议 */}
          <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
            <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4" /> 优化建议
            </h3>
            <ol className="space-y-3">
              {result.suggestions?.map((s: string, i: number) => {
                const cats = findMentionedCategories(s)
                return (
                  <li key={i} className="text-sm text-blue-700">
                    <span className="flex gap-2">
                      <span className="font-bold text-blue-500 flex-shrink-0">{i + 1}.</span>
                      <span>{s}</span>
                    </span>
                    {cats.length > 0 && (
                      <div className="flex gap-1.5 mt-1.5 ml-6">
                        {cats.map(cat => (
                          <Link key={cat} to={`/policies?category=${encodeURIComponent(cat)}`}
                            className="text-xs px-2 py-0.5 bg-white rounded border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                            → 查看{cat}
                          </Link>
                        ))}
                        <Link to="/policies/new"
                          className="text-xs px-2 py-0.5 bg-white rounded border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                          + 添加保单
                        </Link>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-20 text-gray-400">
          <Brain className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p>选择分析范围，点击"开始分析"</p>
          <p className="text-xs mt-1">系统会将保单数据发送到 AI API 进行分析</p>
        </div>
      )}
    </div>
  )
}
