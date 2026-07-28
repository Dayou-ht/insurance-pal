import { useParams, Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { ArrowLeft, Edit, Trash2, FileText, DollarSign, Gift, Calendar, Shield, User } from 'lucide-react'
import { formatPaymentFreq } from '../types'
import AiChat from '../components/ai/AiChat'

export default function PolicyDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const policyId = Number(id)

  const policy = useLiveQuery(() => db.policies.get(policyId))
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const coverages = useLiveQuery(() => db.coverages.where('policyId').equals(policyId).toArray()) || []
  const premiums = useLiveQuery(() => db.premiums.where('policyId').equals(policyId).toArray()) || []
  const benefits = useLiveQuery(() => db.benefits.where('policyId').equals(policyId).toArray()) || []
  const riders = useLiveQuery(() => db.policies.where('parentPolicyId').equals(policyId).toArray()) || []

  const personMap = new Map(persons.map(p => [p.id!, p]))

  const currencySymbol: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$' }
  const cs = (c?: string) => currencySymbol[c || 'CNY'] || '¥'

  if (!policy) {
    return (
      <div className="text-center py-20 text-gray-400">
        <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
        <p>保单不存在</p>
        <Link to="/policies" className="text-blue-600 text-sm mt-2 inline-block">← 返回保单列表</Link>
      </div>
    )
  }

  const statusColor: Record<string, string> = {
    '有效': 'bg-green-50 text-green-700',
    '已过期': 'bg-red-50 text-red-600',
    '已退保': 'bg-gray-50 text-gray-500',
    '等待生效': 'bg-blue-50 text-blue-600',
    '理赔中': 'bg-amber-50 text-amber-600',
  }

  const holder = personMap.get(policy.holderId)
  const insureds = policy.insuredIds.map(id => personMap.get(id)).filter(Boolean)
  const beneficiaries = (policy.beneficiaryIds || []).map(id => personMap.get(id)).filter(Boolean)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between">
        <Link to="/policies" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="w-4 h-4" /> 返回保单列表
        </Link>
        <div className="flex gap-2">
          <Link to={`/policies/${policyId}/edit`} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            <Edit className="w-4 h-4" /> 编辑
          </Link>
          <button onClick={async () => {
            if (confirm('确认删除此保单？')) {
              await db.policies.delete(policyId)
              await db.coverages.where('policyId').equals(policyId).delete()
              await db.premiums.where('policyId').equals(policyId).delete()
              await db.benefits.where('policyId').equals(policyId).delete()
              navigate('/policies')
            }
          }}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" /> 删除
          </button>
        </div>
      </div>

      {/* 保单头部 */}
      <div className="bg-white rounded-xl p-6 border border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-800">{policy.productName}</h1>
              {policy.parentPolicyId != null ? (
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 font-bold">附</span>
              ) : (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 font-bold">主</span>
              )}
              <span className={`text-xs px-2.5 py-0.5 rounded-full ${statusColor[policy.status] || 'bg-gray-50 text-gray-500'}`}>
                {policy.status}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span>🏢 {policy.insurer}</span>
              <span className="text-gray-300">|</span>
              <span>📋 {policy.policyNumber || '未填'}</span>
              <span className="text-gray-300">|</span>
              <span>🏷️ {policy.category}</span>
              {policy.subCategory && <><span className="text-gray-300">|</span><span>{policy.subCategory}</span></>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-700">{cs(policy.currency)}{policy.premium.toLocaleString()}</div>
            <div className="text-xs text-gray-400 mt-0.5">{policy.currency} · {policy.paymentMethod}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-6 pt-4 border-t border-gray-50">
          <div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 保障期间
            </div>
            <div className="text-sm font-medium text-gray-700 mt-1">
              {policy.startDate} ~ {policy.endDate}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> 缴费方式
            </div>
            <div className="text-sm font-medium text-gray-700 mt-1">
              {policy.paymentMethod === '趸交' ? '一次性缴清' : `${policy.paymentMethod} · ${policy.paymentPeriod}年`}
              {policy.paymentDay > 0 && ` · ${formatPaymentFreq(policy.paymentMethod, policy.paymentDay, policy.startDate)}`}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 flex items-center gap-1">
              <Gift className="w-3 h-3" /> 权益类型
            </div>
            <div className="text-sm font-medium text-gray-700 mt-1">
              {[policy.hasDividend && '分红', policy.hasSurvivalBenefit && '生存金'].filter(Boolean).join('、') || '无额外权益'}
            </div>
          </div>
        </div>
      </div>

      {/* 附加险 */}
      {riders.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3">📎 附加险（{riders.length}项）</h3>
          <div className="space-y-2">
            {riders.map(r => (
              <Link key={r.id} to={`/policies/${r.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                <div>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 font-bold">附</span>
                    <span className="text-sm font-medium text-gray-700">{r.productName}</span>
                  </span>
                  <span className="text-xs text-gray-400 ml-2">{r.category}</span>
                </div>
                <div className="text-sm font-medium text-blue-700">+¥{r.premium.toLocaleString()}/年</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-5">
        {/* 相关人员 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <User className="w-4 h-4" /> 相关人员
          </h3>
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-400">投保人</div>
              <div className="text-sm font-medium text-gray-700">{holder?.name || '未知'} <span className="text-xs text-gray-400">（{holder?.relation || ''}）</span></div>
            </div>
            <div>
              <div className="text-xs text-gray-400">被保人</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {insureds.length > 0 ? insureds.map(p => p && (
                  <span key={p.id} className="text-sm px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">{p.name}</span>
                )) : <span className="text-sm text-gray-400">未设置</span>}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">受益人</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {policy.beneficiaryType === '法定' ? (
                  <span className="text-sm px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">法定继承人</span>
                ) : beneficiaries.length > 0 ? beneficiaries.map(p => p && (
                  <span key={p.id} className="text-sm px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full">
                    {p.name}{policy.beneficiaryShares?.[p.id!] ? ` ${policy.beneficiaryShares[p.id!]}%` : ''}
                  </span>
                )) : <span className="text-sm text-gray-400">未指定</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 保障权益 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Shield className="w-4 h-4" /> 保障权益（{coverages.length}项）
          </h3>
          {coverages.length > 0 ? (
            <div className="space-y-2">
              {coverages.map(c => (
                <div key={c.id} className="p-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{c.name}</span>
                    {c.amount > 0 && <span className="text-sm font-semibold text-blue-700">¥{c.amount.toLocaleString()}</span>}
                  </div>
                  {c.condition && <div className="text-xs text-gray-400 mt-0.5">{c.condition}</div>}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">未录入保障权益</p>
          )}
        </div>
      </div>

      {/* 缴费记录 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <DollarSign className="w-4 h-4" /> 缴费记录
        </h3>
        {premiums.length > 0 ? (
          <div className="space-y-2">
            {premiums.map(p => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">{p.dueDate}</span>
                  <span className="font-medium text-gray-800">¥{p.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={async () => {
                    if (p.paid) {
                      await db.premiums.update(p.id!, { paid: false, paidDate: undefined })
                    } else {
                      await db.premiums.update(p.id!, { paid: true, paidDate: new Date().toISOString().slice(0, 10) })
                    }
                  }}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                      p.paid
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                    }`}>
                    {p.paid ? `✅ 已缴${p.paidDate ? ' ('+p.paidDate+')' : ''}` : '⏳ 待缴费'}
                  </button>
                  {p.paymentMethod && <span className="text-xs text-gray-400">{p.paymentMethod}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400 py-2">无缴费记录</p>
        )}
      </div>

      {/* 分红/生存金 */}
      {benefits.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
            <Gift className="w-4 h-4" /> 分红/生存金记录
          </h3>
          <div className="space-y-2">
            {benefits.map(b => (
              <div key={b.id} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${b.type === '分红' ? 'bg-pink-50 text-pink-700' : 'bg-teal-50 text-teal-700'}`}>
                    {b.type}
                  </span>
                  <span className="text-gray-600">{b.expectedDate}</span>
                  <span className="font-medium text-gray-800">¥{b.amount.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${b.received ? 'text-green-600' : 'text-amber-600'}`}>
                    {b.received ? '✅ 已领取' : '⏳ 待领取'}
                  </span>
                  {b.note && <span className="text-xs text-gray-400">({b.note})</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 备注 */}
      {policy.note && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-2">备注</h3>
          <p className="text-sm text-gray-600 whitespace-pre-wrap">{policy.note}</p>
        </div>
      )}

      {/* 合同文件 */}
      {policy.documents && policy.documents.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-3">合同文件（{policy.documents.length}份）</h3>
          <div className="space-y-2">
            {policy.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <FileText className="w-4 h-4 text-blue-500" />
                <span className="text-gray-600">{doc.name}</span>
                <span className="text-xs text-gray-400 ml-auto">{doc.uploadDate?.slice(0, 10)}</span>
                <a href={doc.dataUrl} target="_blank" rel="noreferrer"
                  className="text-blue-600 hover:underline text-xs">查看</a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI 保单顾问 */}
      <AiChat
        policyInfo={`保单名称：${policy.productName}\n保司：${policy.insurer}\n险种：${policy.category}\n投保人：${holder?.name || '未知'}\n被保人：${insureds.map(p => p?.name).filter(Boolean).join('、')}\n保费：¥${policy.premium}/年\n缴费方式：${policy.paymentMethod}\n保障期间：${policy.startDate} ~ ${policy.endDate}\n状态：${policy.status}${policy.note ? '\n备注：' + policy.note : ''}`}
        coverages={coverages.length > 0
          ? coverages.map(c => `【${c.name}】保额¥${c.amount.toLocaleString()}，赔付条件：${c.condition || '详见条款'}`).join('\n')
          : '未录入具体保障权益'}
      />
    </div>
  )
}
