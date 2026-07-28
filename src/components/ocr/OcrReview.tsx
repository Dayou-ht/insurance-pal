import { Check, Edit2, Shield, DollarSign, Calendar, User, FileText, Building, Hash, Tag, Gift, HelpCircle, Paperclip } from 'lucide-react'
import type { Person } from '../../types'
import { formatPaymentFreq } from '../../types'

interface Props {
  form: {
    insurer: string
    policyNumber: string
    productName: string
    category: string
    subCategory?: string
    currency: string
    premium: number
    paymentMethod: string
    paymentPeriod: number
    paymentDay: number
    startDate: string
    endDate: string
    status: string
    holderId: number
    insuredIds: number[]
    beneficiaryType?: string
    beneficiaryIds?: number[]
    beneficiaryShares?: Record<number, number>
    renewable: boolean
    hasDividend: boolean
    hasSurvivalBenefit: boolean
    note?: string
  }
  coverages: { name: string; amount: number; condition: string; note?: string }[]
  riders?: { productName: string; category: string; premium: number }[]
  documents: { name: string }[]
  persons: Person[]
  onConfirm: () => void
  onEdit: () => void
  saving: boolean
  ocrLoading?: boolean
}

const personName = (id: number, persons: Person[]) => {
  const p = persons.find(pp => pp.id === id)
  return p ? `${p.name}（${p.relation}）` : `#${id}`
}

const currencySymbol: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$' }
const cs = (c?: string) => currencySymbol[c || 'CNY'] || '¥'

export default function OcrReview({ form, coverages, riders, documents, persons, onConfirm, onEdit, saving, ocrLoading }: Props) {
  const holder = form.holderId ? personName(form.holderId, persons) : '未识别'
  const insureds = form.insuredIds.map(id => personName(id, persons))

  if (ocrLoading) {
    return (
      <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
        <div className="animate-pulse space-y-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full mx-auto flex items-center justify-center">
            <Shield className="w-8 h-8 text-blue-400" />
          </div>
          <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
          <div className="h-3 bg-gray-200 rounded w-64 mx-auto" />
          <div className="space-y-2 mt-6">
            <div className="h-20 bg-gray-100 rounded-lg" />
            <div className="h-20 bg-gray-100 rounded-lg" />
            <div className="h-20 bg-gray-100 rounded-lg" />
          </div>
          <p className="text-sm text-gray-400 mt-4">AI 正在识别保单信息…</p>
        </div>
      </div>
    )
  }

  const hasData = form.productName || form.insurer || form.premium > 0 || coverages.length > 0

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div className="flex items-center gap-2">
        <Check className="w-5 h-5 text-green-500" />
        <h2 className="text-lg font-semibold text-gray-800">AI 识别结果</h2>
        <span className="text-xs text-gray-400 ml-auto">请核对以下信息是否正确</span>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-xl p-8 border border-gray-100 text-center">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">未识别到保单信息，请手动录入或重新拍照</p>
          <button onClick={onEdit}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            手动录入
          </button>
        </div>
      ) : (
        <>
          {/* ===== 保单概要 ===== */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-500" />
                保单概要
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                <InfoRow icon={Building} label="保险公司" value={form.insurer || '未识别'} highlight />
                <InfoRow icon={Tag} label="产品名称" value={form.productName || '未识别'} highlight />
                <InfoRow icon={Hash} label="保单号" value={form.policyNumber || '未识别'} />
                <InfoRow icon={Shield} label="险种" value={form.category} />
                <InfoRow icon={DollarSign} label="保费" value={form.premium > 0 ? `${cs(form.currency)}${form.premium.toLocaleString()}/年` : '未识别'} />
                <InfoRow icon={User} label="投保人" value={holder} />
                <InfoRow icon={User} label="被保人" value={insureds.length > 0 ? insureds.join('、') : '同投保人'} />
                <InfoRow icon={User} label="受益人" value={
                  form.beneficiaryType === '法定' ? '法定继承人' :
                  (form.beneficiaryIds || []).map(id => {
                    const name = personName(id, persons)
                    const pct = form.beneficiaryShares?.[id]
                    return pct ? `${name} ${pct}%` : name
                  }).join('、') || '未指定'
                } />
                <InfoRow icon={Calendar} label="起保日期" value={form.startDate || '未识别'} />
                <InfoRow icon={Calendar} label="到期日期" value={form.endDate || '未识别'} />
                <InfoRow icon={DollarSign} label="缴费方式" value={
                  form.paymentMethod === '趸交' ? '一次性缴清' :
                  `${form.paymentMethod}${form.paymentPeriod > 0 ? ` ${form.paymentPeriod}年` : ''}`
                } />
                {form.paymentDay > 0 && (
                  <InfoRow icon={Calendar} label="缴费日" value={formatPaymentFreq(form.paymentMethod, form.paymentDay, form.startDate)} />
                )}
                {form.renewable && <InfoRow icon={Gift} label="续保" value="可续保" />}
              </div>
            </div>
          </div>

          {/* ===== 保障权益 ===== */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-green-600" />
                保障权益（{coverages.length}项）
              </h3>
            </div>
            <div className="p-5 space-y-3">
              {coverages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-3">未识别到具体保障权益</p>
              ) : coverages.map((cov, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 mt-1.5" />
                      <div>
                        <span className="text-sm font-medium text-gray-800">{cov.name}</span>
                        {cov.amount > 0 && (
                          <span className="text-sm font-semibold text-blue-700 ml-2">{cs(form.currency)}{cov.amount.toLocaleString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {cov.condition && (
                    <p className="text-xs text-gray-500 mt-1.5 ml-4">{cov.condition}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ===== 附加险 ===== */}
          {riders && riders.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 flex items-center gap-1.5">
                  <Paperclip className="w-4 h-4 text-purple-600" />
                  附加险（{riders.length}项）
                </h3>
              </div>
              <div className="p-5 space-y-3">
                {riders.map((r, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded">附</span>
                      <span className="text-sm font-medium text-gray-700">{r.productName}</span>
                      <span className="text-xs text-gray-400">{r.category}</span>
                    </div>
                    {r.premium > 0 && <span className="text-sm font-medium text-blue-700">¥{r.premium.toLocaleString()}/年</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 时间信息摘要 ===== */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                时间信息
              </h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-400">保障期间</div>
                  <div className="font-medium text-gray-700 mt-0.5">{form.startDate || '?'} ~ {form.endDate || '终身'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">状态</div>
                  <span className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full ${
                    form.status === '有效' ? 'bg-green-50 text-green-700' :
                    form.status === '已过期' ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-gray-500'
                  }`}>{form.status}</span>
                </div>
                {form.paymentMethod !== '趸交' && form.startDate && (
                  <div>
                    <div className="text-xs text-gray-400">分红/生存金</div>
                    <div className="font-medium text-gray-700 mt-0.5 text-xs">
                      {form.hasDividend ? '有分红' : ''}
                      {form.hasDividend && form.hasSurvivalBenefit ? '、' : ''}
                      {form.hasSurvivalBenefit ? '有生存金' : ''}
                      {!form.hasDividend && !form.hasSurvivalBenefit && '无'}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ===== 合同文件 ===== */}
          {documents.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-5 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-700 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-500" />
                  合同文件（{documents.length}份）
                </h3>
              </div>
              <div className="p-5">
                <div className="space-y-1.5">
                  {documents.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="w-3.5 h-3.5 text-gray-400" />
                      <span className="truncate">{d.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== 备注 ===== */}
          {form.note && (
            <div className="bg-white rounded-xl p-5 border border-gray-100">
              <p className="text-sm text-gray-600">{form.note}</p>
            </div>
          )}

          {/* ===== AI 标注 ===== */}
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2.5 flex items-start gap-2">
            <HelpCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <span>以上信息由 AI 自动识别生成，请仔细核对。识别结果仅供参考，不构成法律建议。如果某项信息有误，点击「修改信息」调整。</span>
          </div>

          {/* ===== 确认/修改按钮 ===== */}
          <div className="flex gap-3">
            <button onClick={onEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors">
              <Edit2 className="w-4 h-4" />
              修改信息
            </button>
            <button onClick={onConfirm} disabled={saving}
              className="flex-[2] flex items-center justify-center gap-1.5 px-4 py-3 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> 保存中...</>
              ) : (
                <><Check className="w-4 h-4" /> ✅ 信息都对，保存</>
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/** 单行信息 */
function InfoRow({ icon: Icon, label, value, highlight }: { icon: any; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
      <span className="text-gray-500 flex-shrink-0">{label}：</span>
      <span className={`truncate ${highlight ? 'font-medium text-gray-800' : 'text-gray-600'}`}>{value}</span>
    </div>
  )
}

function Loader2(props: any) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
