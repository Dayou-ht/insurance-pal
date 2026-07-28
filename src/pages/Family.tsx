import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, User } from 'lucide-react'
import type { Person } from '../types'

const RELATIONS = ['本人', '配偶', '子女', '父母', '其他'] as const

export default function Family() {
  const [searchParams] = useSearchParams()
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const policies = useLiveQuery(() => db.policies.toArray()) || []
  const allCoverages = useLiveQuery(() => db.coverages.toArray()) || []
  const [editing, setEditing] = useState<Partial<Person>>({ relation: '本人' })
  const [showForm, setShowForm] = useState(false)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  // 从 URL 参数高亮成员
  useEffect(() => {
    const h = searchParams.get('highlight')
    if (h) {
      const id = Number(h)
      setHighlightId(id)
      setTimeout(() => {
        document.getElementById(`person-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(() => setHighlightId(null), 2000)
      }, 100)
    }
  }, [searchParams])

  async function handleSave() {
    if (!editing.name) return
    if (editing.id) {
      await db.persons.update(editing.id, editing as Person)
    } else {
      await db.persons.add(editing as Person)
    }
    setEditing({ relation: '本人' })
    setShowForm(false)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">家庭成员</h1>
        <button onClick={() => { setEditing({ relation: '本人' }); setShowForm(true) }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> 添加成员
        </button>
      </div>

      {/* 表单弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">{editing.id ? '编辑成员' : '添加成员'}</h3>
            <div className="space-y-3">
              <input placeholder="姓名" value={editing.name || ''} onChange={e => setEditing({...editing, name: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select value={editing.relation} onChange={e => setEditing({...editing, relation: e.target.value as any})}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {RELATIONS.map(r => <option key={r}>{r}</option>)}
              </select>
              <input placeholder="身份证号（选填）" value={editing.idCard || ''} onChange={e => setEditing({...editing, idCard: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="手机号（选填）" value={editing.phone || ''} onChange={e => setEditing({...editing, phone: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input type="date" value={editing.birthDate || ''} onChange={e => setEditing({...editing, birthDate: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="备注（选填）" value={editing.note || ''} onChange={e => setEditing({...editing, note: e.target.value})}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={handleSave} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 成员卡片 */}
      <div className="grid grid-cols-2 gap-4">
        {persons.map(person => {
          const asHolder = policies.filter(p => p.holderId === person.id && !p.parentPolicyId)
          const asInsured = policies.filter(p => p.insuredIds.includes(person.id!) && !p.parentPolicyId)
          const asBeneficiary = policies.filter(p => p.beneficiaryIds?.includes(person.id!) && !p.parentPolicyId)
          const personRiders = policies.filter(p => p.parentPolicyId && (p.holderId === person.id || p.insuredIds.includes(person.id!)))
          const allMainPolicies = [...new Set([...asHolder, ...asInsured, ...asBeneficiary].map(p => p.id!))].length
          const activePolicies = [...asHolder, ...asInsured].filter(p => p.status === '有效')

          return (
            <Link key={person.id} to={`/policies?person=${person.id}`}
              id={`person-${person.id}`}
              className={`block bg-white rounded-xl p-5 border transition-all ${
                highlightId === person.id
                  ? 'border-blue-400 ring-2 ring-blue-200 bg-blue-50'
                  : 'border-gray-100 hover:border-blue-200 hover:shadow-sm'
              }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800">{person.name}</h3>
                    <span className="text-xs text-gray-400">{person.relation}</span>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={e => { e.preventDefault(); e.stopPropagation(); setEditing(person); setShowForm(true) }}
                    className="text-blue-600 hover:underline">编辑</button>
                  <button onClick={async e => { e.preventDefault(); e.stopPropagation(); if (confirm('确认删除？')) await db.persons.delete(person.id!) }}
                    className="text-red-500 hover:underline">删除</button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-50">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <div className="text-gray-400 text-xs">合计</div>
                    <div className="font-semibold text-gray-800">{allMainPolicies} 份主险
                      {personRiders.length > 0 && <span className="text-xs text-purple-600 font-normal"> + {personRiders.length}项附加</span>}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">投保人</div>
                    <div className="font-semibold text-blue-700">{asHolder.length} 份</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">被保人</div>
                    <div className="font-semibold text-green-700">{asInsured.length} 份</div>
                  </div>
                  <div>
                    <div className="text-gray-400 text-xs">受益人</div>
                    <div className="font-semibold text-purple-700">{asBeneficiary.length} 份</div>
                  </div>
                </div>

                {/* 险种标签 */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[...new Set(activePolicies.map(p => p.category))].map(cat => (
                    <span key={cat} className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{cat}</span>
                  ))}
                </div>

                {/* 保额汇总 */}
                {(() => {
                  const relIds = new Set(activePolicies.map(p => p.id!))
                  const catAmounts: Record<string, number> = {}
                  for (const c of allCoverages) {
                    if (relIds.has(c.policyId)) {
                      const pol = activePolicies.find(p => p.id === c.policyId)
                      if (pol) {
                        catAmounts[pol.category] = (catAmounts[pol.category] || 0) + c.amount
                      }
                    }
                  }
                  const entries = Object.entries(catAmounts)
                  if (entries.length === 0) return null
                  return (
                    <div className="mt-2 pt-2 border-t border-gray-50 grid grid-cols-2 gap-x-3 gap-y-1">
                      {entries.map(([cat, amt]) => (
                        <div key={cat} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">{cat}</span>
                          <span className="font-medium text-gray-700">¥{amt.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </Link>
          )
        })}

        {persons.length === 0 && (
          <div className="col-span-2 text-center py-20 text-gray-400">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>还没有家庭成员，点击添加</p>
          </div>
        )}
      </div>
    </div>
  )
}
