import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { Plus, X, Scan, Loader2 } from 'lucide-react'
import type { InsuranceCategory, PolicyStatus, Coverage } from '../types'
import { generatePaymentDates, getInstallmentAmount } from '../types'
import { recognizeFile } from '../services/ocr'
import { getAiConfig } from '../services/ai'
import type { AiConfig } from '../services/ai'
import OcrReview from '../components/ocr/OcrReview'
import PersonSelector from '../components/PersonSelector'

/** 生成唯一 ID（兼容非 HTTPS 环境） */
function uid(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  arr[6] = (arr[6] & 0x0f) | 0x40
  arr[8] = (arr[8] & 0x3f) | 0x80
  return Array.from(arr, (b, i) =>
    [4, 6, 8, 10].includes(i) ? '-' + b.toString(16).padStart(2, '0') : b.toString(16).padStart(2, '0')
  ).join('')
}

const CATEGORIES: InsuranceCategory[] = ['重疾险','医疗险','意外险','寿险','年金险','分红险','万能险','车险','家财险','学平险','旅行险','危疾保险','储蓄保险','投资相连','其他']
const STATUSES: PolicyStatus[] = ['有效','已过期','已退保','等待生效','理赔中']
const PAYMENT_METHODS = ['年缴','半年缴','月缴','季缴','趸交'] as const
const RELATIONS = ['本人','配偶','子女','父母','其他']

export default function PolicyForm() {
  const navigate = useNavigate()
  const { id } = useParams()
  const editId = id ? Number(id) : null
  const isEdit = editId !== null
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const existingPolicy = useLiveQuery(() => db.policies.get(editId ?? 0), [editId])
  const existingCoverages = useLiveQuery(() => db.coverages.where('policyId').equals(editId ?? 0).toArray(), [editId])
  const existingRiders = useLiveQuery(() => db.policies.where('parentPolicyId').equals(editId ?? 0).toArray(), [editId])

  const [form, setForm] = useState({
    insurer: '',
    policyNumber: '',
    productName: '',
    category: '重疾险' as InsuranceCategory,
    subCategory: '',
    currency: 'CNY' as 'CNY' | 'HKD' | 'USD',
    holderId: 0,
    insuredIds: [] as number[],
    beneficiaryIds: [] as number[],
    beneficiaryType: '法定' as '法定' | '指定',
    beneficiaryShares: {} as Record<number, number>,
    premium: 0,
    paymentMethod: '年缴' as typeof PAYMENT_METHODS[number],
    paymentPeriod: 20,
    paymentDay: 1,
    startDate: '',
    endDate: '',
    renewable: false,
    renewalAlertDays: 30,
    status: '有效' as PolicyStatus,
    parentPolicyId: undefined as number | undefined,
    hasDividend: false,
    hasSurvivalBenefit: false,
    note: '',
  })

  const [coverages, setCoverages] = useState<Omit<Coverage, 'id' | 'policyId'>[]>([])
  const [documents, setDocuments] = useState<{name: string; dataUrl: string}[]>([])
  // 分红/生存金领取时间
  const [benefits, setBenefits] = useState<{type: string; year: string; amount: number}[]>([])
  // 附加险（主险录入时内嵌添加）
  const [riders, setRiders] = useState<{productName: string; category: InsuranceCategory; premium: number; paymentMethod: typeof PAYMENT_METHODS[number]; paymentPeriod: number; coverages: Omit<Coverage, 'id' | 'policyId'>[]}[]>([])
  const [showReview, setShowReview] = useState(false)
  const [showRiderSection, setShowRiderSection] = useState(false)
  const [showNewPersonForm, setShowNewPersonForm] = useState(false)
  const [newPersonName, setNewPersonName] = useState('')
  const [newPersonRelation, setNewPersonRelation] = useState('本人')
  const [activePersonField, setActivePersonField] = useState<'holder' | 'insured' | 'beneficiary' | null>(null)
  const [saving, setSaving] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<string>('')
  const [ocrLoading, setOcrLoading] = useState(false)



  // 编辑模式：加载已有保单数据
  useEffect(() => {
    if (existingPolicy) {
      setForm({
        insurer: existingPolicy.insurer || '',
        policyNumber: existingPolicy.policyNumber || '',
        productName: existingPolicy.productName || '',
        category: existingPolicy.category,
        subCategory: existingPolicy.subCategory || '',
        currency: existingPolicy.currency || 'CNY',
        holderId: existingPolicy.holderId || 0,
        insuredIds: existingPolicy.insuredIds || [],
        beneficiaryIds: existingPolicy.beneficiaryIds || [],
        beneficiaryType: existingPolicy.beneficiaryType || '法定',
        beneficiaryShares: existingPolicy.beneficiaryShares || {},
        premium: existingPolicy.premium || 0,
        paymentMethod: existingPolicy.paymentMethod,
        paymentPeriod: existingPolicy.paymentPeriod || 0,
        paymentDay: existingPolicy.paymentDay || 1,
        startDate: existingPolicy.startDate || '',
        endDate: existingPolicy.endDate || '',
        renewable: existingPolicy.renewable || false,
        renewalAlertDays: existingPolicy.renewalAlertDays || 30,
        status: existingPolicy.status,
        parentPolicyId: existingPolicy.parentPolicyId ?? undefined,
        hasDividend: existingPolicy.hasDividend || false,
        hasSurvivalBenefit: existingPolicy.hasSurvivalBenefit || false,
        note: existingPolicy.note || '',
      })
      // 加载已有文档
      if (existingPolicy.documents?.length > 0) {
        setDocuments(existingPolicy.documents.map(d => ({ name: d.name, dataUrl: d.dataUrl })))
      }
    }
  }, [existingPolicy])

  // 编辑模式：加载已有保障权益
  useEffect(() => {
    if (existingCoverages && existingCoverages.length > 0) {
      setCoverages(existingCoverages.map(c => ({
        name: c.name,
        amount: c.amount,
        condition: c.condition,
        note: c.note || '',
      })))
    }
  }, [existingCoverages])

  // 编辑模式：加载已有附加险
  useEffect(() => {
    if (existingRiders && existingRiders.length > 0) {
      setRiders(existingRiders.map(r => ({
        productName: r.productName,
        category: r.category as InsuranceCategory,
        premium: r.premium,
        paymentMethod: r.paymentMethod as typeof PAYMENT_METHODS[number],
        paymentPeriod: r.paymentPeriod || 1,
        coverages: [] as Omit<Coverage, 'id' | 'policyId'>[],
      })))
      setShowRiderSection(true)
    }
  }, [existingRiders])

  // 添加新成员
  async function addPerson() {
    if (!newPersonName.trim()) return
    const id = await db.persons.add({
      name: newPersonName.trim(),
      relation: newPersonRelation as any,
    })
    if (activePersonField === 'holder') setForm(f => ({ ...f, holderId: id! }))
    else if (activePersonField === 'insured') setForm(f => ({ ...f, insuredIds: [...f.insuredIds, id!] }))
    else if (activePersonField === 'beneficiary') setForm(f => ({ ...f, beneficiaryIds: [...f.beneficiaryIds, id!] }))
    setNewPersonName('')
    setShowNewPersonForm(false)
    setActivePersonField(null)
  }

  // 添加保障权益
  function addCoverage() {
    setCoverages([...coverages, { name: '', amount: 0, condition: '', note: '' }])
  }

  function updateCoverage(index: number, field: string, value: any) {
    const updated = [...coverages]
    ;(updated[index] as any)[field] = value
    setCoverages(updated)
  }

  function removeCoverage(index: number) {
    setCoverages(coverages.filter((_, i) => i !== index))
  }

  // 处理文档上传 + 智能识别
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return

    const config = getAiConfig() as AiConfig | null
    if (!config?.apiKey) {
      alert('请先在设置中配置 AI API Key，否则只能上传文件无法自动识别')
    }

    for (const file of Array.from(files)) {
      // 先存文件
      const reader = new FileReader()
      reader.onload = () => {
        setDocuments(prev => [...prev, {
          name: file.name,
          dataUrl: reader.result as string,
        }])
      }
      reader.readAsDataURL(file)

      // OCR 识别（如果有 AI 配置）
      if (config?.apiKey) {
        setOcrLoading(true)
        setOcrStatus(`正在识别 ${file.name}...`)
        try {
          const result = await recognizeFile(file, config as { provider: string; model: string; apiKey: string; baseUrl?: string }, (msg) => setOcrStatus(msg))
          if (result) {
            // 后处理：月缴且缴费年限≥12，说明AI把月数当成年数了，转成实际年数
            let fixedPeriod = result.paymentPeriod
            if (result.paymentMethod === '月缴' && fixedPeriod != null && fixedPeriod >= 12) {
              fixedPeriod = Math.ceil(fixedPeriod / 12)
            }
            if (result.paymentMethod === '季缴' && fixedPeriod != null && fixedPeriod >= 12) {
              fixedPeriod = Math.ceil(fixedPeriod / 4)
            }
            // 自动填充表单
            setForm(prev => {
              // AI 返回的 premium 可能是月缴/季缴金额，转成年缴
              let convertedPremium = result.premium != null ? Number(result.premium) : prev.premium
              if (result.premium != null && result.paymentMethod) {
                if (result.paymentMethod === '月缴') convertedPremium = Number(result.premium) * 12
                else if (result.paymentMethod === '季缴') convertedPremium = Number(result.premium) * 4
                else if (result.paymentMethod === '半年缴') convertedPremium = Number(result.premium) * 2
              }
              return {
                ...prev,
                insurer: result.insurer || prev.insurer,
                policyNumber: result.policyNumber || prev.policyNumber,
                productName: result.productName || prev.productName,
                category: (result.category as InsuranceCategory) || prev.category,
                premium: convertedPremium,
                paymentMethod: (result.paymentMethod as any) || prev.paymentMethod,
                paymentPeriod: fixedPeriod ?? prev.paymentPeriod,
                startDate: result.startDate || prev.startDate,
                endDate: result.endDate || prev.endDate,
                note: result.note || prev.note,
              }
            })
            if (result.coverages?.length > 0) {
              setCoverages(prev => {
                const existing = [...prev]
                for (const c of result.coverages) {
                  if (c.name && !existing.find(e => e.name === c.name)) {
                    existing.push({ name: c.name, amount: c.amount, condition: c.condition || '', note: '' })
                  }
                }
                return existing
              })
            }
            // 处理 AI 识别到的附加险
            const riderList = result.riders
            if (riderList?.length) {
              setRiders(riderList.map(r => ({
                productName: r.productName,
                category: r.category as InsuranceCategory,
                premium: r.premium || 0,
                paymentMethod: '年缴' as typeof PAYMENT_METHODS[number],
                paymentPeriod: 1,
                coverages: [],
              })))
              setShowRiderSection(true)
            }
            setOcrStatus(`✅ ${file.name} 识别完成，已自动填充表单`)
            setShowReview(true)
            setTimeout(() => setOcrStatus(''), 3000)
          }
        } catch (err: any) {
          setOcrStatus(`⚠️ 识别失败：${err.message}`)
        }
        setOcrLoading(false)
      }
    }
  }

  async function handleSubmit() {
    // 编辑模式：放宽校验，已保存的数据不需要重新验证
    if (!isEdit) {
      if (!form.productName || !form.insurer || !form.startDate) {
        alert('请填写保单名称、保司和起保日期')
        return
      }
      if (!form.holderId) {
        alert('请选择投保人（如果还没有家庭成员，点"被保人"旁边的"+ 新建"添加）')
        return
      }
    }

    setSaving(true)
    try {
      const now = new Date().toISOString()
      // 从起保日期自动推算缴费日（正确解析日）
      const autoPaymentDay = form.startDate ? parseInt(form.startDate.split('-')[2], 10) || 1 : 1
      const policyData = {
        ...form,
        paymentDay: autoPaymentDay,
        insuredIds: form.insuredIds.length > 0 ? form.insuredIds : [form.holderId],
        documents: documents.map(d => ({
          id: uid(),
          name: d.name,
          type: d.dataUrl.startsWith('data:application/pdf') ? 'pdf' as const : 'image' as const,
          dataUrl: d.dataUrl,
          uploadDate: now,
        })),
        updatedAt: now,
      }

      if (isEdit && editId) {
        // === 编辑模式（事务保证原子性） ===
        await db.transaction('rw', db.policies, db.coverages, db.premiums, db.reminders, async () => {
          await db.policies.update(editId, policyData)

          // 替换保障权益
          await db.coverages.where('policyId').equals(editId).delete()
          for (const cov of coverages) {
            if (cov.name) {
              await db.coverages.add({ ...cov, policyId: editId } as any)
            }
          }

          // 保留已有缴费记录，只补充新增期次（不清除已缴标记）
          const existingPremiums = await db.premiums.where('policyId').equals(editId).toArray()
          const existingDates = new Set(existingPremiums.map(p => p.dueDate))
          if (form.paymentMethod !== '趸交' && form.premium > 0 && form.startDate) {
            const paymentDates = generatePaymentDates(form.startDate, form.paymentMethod, form.paymentPeriod, form.paymentDay)
            for (const pd of paymentDates) {
              if (!existingDates.has(pd.dueDate)) {
                const instAmount = getInstallmentAmount(form.premium, form.paymentMethod)
                await db.premiums.add({
                  policyId: editId,
                  dueDate: pd.dueDate,
                  amount: instAmount,
                  paid: false,
                  paymentMethod: '银行卡',
                } as any)
              }
            }
            // 更新已有缴费记录的金额（如果保费变了）
            const instAmount = getInstallmentAmount(form.premium, form.paymentMethod)
            for (const prem of existingPremiums) {
              if (prem.amount !== instAmount) {
                await db.premiums.update(prem.id!, { amount: instAmount })
              }
            }
          }

          // 保留已有提醒，只补充新增期次
          const existingReminders = await db.reminders.where('policyId').equals(editId).toArray()
          const existingReminderDates = new Set(existingReminders.map(r => r.date))
          if (form.paymentMethod !== '趸交' && form.premium > 0 && form.startDate) {
            const paymentDates = generatePaymentDates(form.startDate, form.paymentMethod, form.paymentPeriod, form.paymentDay)
            for (const pd of paymentDates) {
              if (!existingReminderDates.has(pd.dueDate)) {
                await db.reminders.add({
                  policyId: editId,
                  type: '缴费',
                  title: `${form.productName} 保费到期`,
                  date: pd.dueDate,
                  done: false,
                } as any)
              }
            }
          }

          // 替换附加险
          await db.policies.where('parentPolicyId').equals(editId).delete()
          for (const rider of riders) {
            if (!rider.productName) continue
            await db.policies.add({
              insurer: form.insurer,
              policyNumber: '',
              productName: rider.productName,
              category: rider.category,
              currency: form.currency,
              parentPolicyId: editId,
              holderId: form.holderId,
              insuredIds: form.insuredIds,
              beneficiaryIds: form.beneficiaryIds,
              beneficiaryType: form.beneficiaryType,
              beneficiaryShares: form.beneficiaryShares,
              premium: rider.premium,
              paymentMethod: rider.paymentMethod,
              paymentPeriod: rider.paymentPeriod || 1,
              paymentDay: form.paymentDay,
              startDate: form.startDate,
              endDate: form.endDate,
              renewable: false,
              renewalAlertDays: 30,
              status: '有效',
              hasDividend: false,
              hasSurvivalBenefit: false,
              documents: [],
              createdAt: now,
              updatedAt: now,
            })
          }
        })
        alert('保单更新成功！')
        navigate(`/policies/${editId}`)
      } else {
        // === 新增模式 ===
        const policyId = await db.policies.add({
          ...policyData,
          createdAt: now,
        })

        // 保存保障权益
        for (const cov of coverages) {
          if (cov.name) {
            await db.coverages.add({ ...cov, policyId: policyId! } as any)
          }
        }

        // 自动生成所有缴费期次提醒
        if (form.paymentMethod !== '趸交' && form.premium > 0 && form.startDate) {
          const paymentDates = generatePaymentDates(form.startDate, form.paymentMethod, form.paymentPeriod, form.paymentDay)
          for (const pd of paymentDates) {
            await db.premiums.add({
              policyId: policyId!,
              dueDate: pd.dueDate,
              amount: getInstallmentAmount(form.premium, form.paymentMethod),
              paid: false,
              paymentMethod: '银行卡',
            } as any)
            await db.reminders.add({
              policyId: policyId!,
              type: '缴费',
              title: `${form.productName} 保费到期`,
              date: pd.dueDate,
              done: false,
            } as any)
          }
        }

        // 保存内嵌附加险
        for (const rider of riders) {
          if (!rider.productName) continue
          const riderId = await db.policies.add({
            insurer: form.insurer,
            policyNumber: '',
            productName: rider.productName,
            category: rider.category,
            currency: form.currency,
            parentPolicyId: policyId!,
            holderId: form.holderId,
            insuredIds: form.insuredIds,
            beneficiaryIds: form.beneficiaryIds,
            beneficiaryType: form.beneficiaryType,
            beneficiaryShares: form.beneficiaryShares,
            premium: rider.premium,
            paymentMethod: rider.paymentMethod,
            paymentPeriod: rider.paymentPeriod || 1,
            paymentDay: form.paymentDay,
            startDate: form.startDate,
            endDate: form.endDate,
            renewable: false,
            renewalAlertDays: 30,
            status: '有效',
            hasDividend: false,
            hasSurvivalBenefit: false,
            documents: [],
            createdAt: now,
            updatedAt: now,
          })
          // 附加险的保障权益
          for (const cov of rider.coverages) {
            if (cov.name) {
              await db.coverages.add({ ...cov, policyId: riderId! } as any)
            }
          }
        }

        // 保存分红/生存金领取时间
        for (const b of benefits) {
          if (b.year) {
            await db.benefits.add({
              policyId: policyId!,
              type: b.type as any,
              expectedDate: b.year,
              amount: b.amount || 0,
              received: false,
              guaranteed: false,
            } as any)
          }
        }

        alert('保单添加成功！')
        navigate('/policies')
      }
    } catch (err) {
      alert('保存失败：' + String(err))
    }
    setSaving(false)
  }

  // OCR 确认保存：直接以当前表单数据创建新保单（不走表单校验）
  async function handleOcrConfirm() {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const autoPaymentDay = form.startDate ? parseInt(form.startDate.split('-')[2], 10) || 1 : 1
      const policyData = {
        ...form,
        paymentDay: autoPaymentDay,
        insuredIds: form.insuredIds.length > 0 ? form.insuredIds : [form.holderId],
        documents: documents.map(d => ({
          id: uid(),
          name: d.name,
          type: d.dataUrl.startsWith('data:application/pdf') ? 'pdf' as const : 'image' as const,
          dataUrl: d.dataUrl,
          uploadDate: now,
        })),
        createdAt: now,
        updatedAt: now,
      }

      const policyId = await db.policies.add(policyData)

      // 保存保障权益
      for (const cov of coverages) {
        if (cov.name) {
          await db.coverages.add({ ...cov, policyId: policyId! } as any)
        }
      }

      // 生成所有缴费期次提醒
      if (form.paymentMethod !== '趸交' && form.premium > 0 && form.startDate) {
        const paymentDates = generatePaymentDates(form.startDate, form.paymentMethod, form.paymentPeriod, form.paymentDay)
        for (const pd of paymentDates) {
          await db.premiums.add({
            policyId: policyId!,
            dueDate: pd.dueDate,
            amount: getInstallmentAmount(form.premium, form.paymentMethod),
            paid: false,
            paymentMethod: '银行卡',
          } as any)
          await db.reminders.add({
            policyId: policyId!,
            type: '缴费',
            title: `${form.productName} 保费到期`,
            date: pd.dueDate,
            done: false,
          } as any)
        }
      }

      // 保存分红/生存金
      for (const b of benefits) {
        if (b.year) {
          await db.benefits.add({
            policyId: policyId!,
            type: b.type as any,
            expectedDate: b.year,
            amount: b.amount || 0,
            received: false,
            guaranteed: false,
          } as any)
        }
      }

      // 保存内嵌附加险
      for (const rider of riders) {
        if (!rider.productName) continue
        const riderId = await db.policies.add({
          insurer: form.insurer,
          policyNumber: '',
          productName: rider.productName,
          category: rider.category,
          currency: form.currency,
          parentPolicyId: policyId!,
          holderId: form.holderId,
          insuredIds: form.insuredIds,
          beneficiaryIds: form.beneficiaryIds,
          beneficiaryType: form.beneficiaryType,
          beneficiaryShares: form.beneficiaryShares,
          premium: rider.premium,
          paymentMethod: rider.paymentMethod,
          paymentPeriod: rider.paymentPeriod || 1,
          paymentDay: autoPaymentDay,
          startDate: form.startDate,
          endDate: form.endDate,
          renewable: false,
          renewalAlertDays: 30,
          status: '有效',
          hasDividend: false,
          hasSurvivalBenefit: false,
          documents: [],
          createdAt: now,
          updatedAt: now,
        })
        for (const cov of rider.coverages) {
          if (cov.name) await db.coverages.add({ ...cov, policyId: riderId! } as any)
        }
      }

      alert('保单添加成功！')
      navigate(`/policies/${policyId}`)
    } catch (err) {
      alert('保存失败：' + String(err))
    }
    setSaving(false)
  }

  // ===== 渲染 =====

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{isEdit ? '编辑保单' : '添加保单'}</h1>
        <button onClick={() => navigate(isEdit ? `/policies/${editId}` : '/policies')} className="text-sm text-gray-500 hover:text-gray-700">取消</button>
      </div>
      {showReview && !isEdit ? renderOcrReview() : renderFormContent()}
    </div>
  )

  // ===== OCR 识别结果 → 保障卡片 =====
  function renderOcrReview() {
    return (
      <OcrReview
        form={form}
        coverages={coverages}
        riders={riders}
        documents={documents}
        persons={persons}
        onConfirm={handleOcrConfirm}
        onEdit={() => setShowReview(false)}
        saving={saving}
        ocrLoading={ocrLoading}
      />
    )
  }

  // ===== 表单内容 =====
  function renderFormContent() {
    return (
      <>
      {showNewPersonForm && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowNewPersonForm(false)}>
          <div className="bg-white rounded-xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">新建成员</h3>
            <div className="space-y-3">
              <input autoFocus placeholder="姓名" value={newPersonName} onChange={e => setNewPersonName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select value={newPersonRelation} onChange={e => setNewPersonRelation(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                {RELATIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setShowNewPersonForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm">取消</button>
              <button onClick={addPerson} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">添加</button>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={e => { e.preventDefault(); handleSubmit() }} className="space-y-6">
        {/* ===== 基本信息 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">保单名称 *</label>
              <input value={form.productName} onChange={e => setForm({...form, productName: e.target.value})}
                placeholder="如：康宁终身重大疾病保险"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">保司 *</label>
              <input value={form.insurer} onChange={e => setForm({...form, insurer: e.target.value})}
                placeholder="如：中国人寿"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">保单号</label>
              <input value={form.policyNumber} onChange={e => setForm({...form, policyNumber: e.target.value})}
                placeholder="保单号"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">险种</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value as InsuranceCategory})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">币种</label>
              <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="CNY">¥ 人民币 (CNY)</option>
                <option value="HKD">HK$ 港币 (HKD)</option>
                <option value="USD">US$ 美元 (USD)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">子类别（选填）</label>
              <input value={form.subCategory} onChange={e => setForm({...form, subCategory: e.target.value})}
                placeholder="如：终身/定期/消费型"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

        {/* ===== 附加险（仅主险录入时显示） ===== */}
        {form.parentPolicyId == null && (
          <div className="bg-white rounded-xl p-5 border border-gray-100">
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-4">
              <input type="checkbox" checked={showRiderSection}
                onChange={e => setShowRiderSection(e.target.checked)}
                className="rounded border-gray-300" />
              <span className="font-semibold text-gray-700">有附加险</span>
            </label>

            {showRiderSection && (
              <>
              <div className="flex items-center justify-between mb-4">
                <button type="button" onClick={() => setRiders([...riders, { productName: '', category: '医疗险' as InsuranceCategory, premium: 0, paymentMethod: '年缴' as typeof PAYMENT_METHODS[number], paymentPeriod: 1, coverages: [] }])}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                  <Plus className="w-3.5 h-3.5" /> 添加附加险
                </button>
              </div>

              {riders.length === 0 && (
                <p className="text-sm text-gray-400 py-3 text-center">勾选后添加本保单的附加险</p>
              )}

              <div className="space-y-4">
                {riders.map((rider, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg relative">
                  <button type="button" onClick={() => setRiders(riders.filter((_, i) => i !== idx))}
                    className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                  <p className="text-xs text-gray-400 mb-3 font-medium">附加险 #{idx + 1}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <input placeholder="附加险名称（如：住院医疗）"
                        value={rider.productName} onChange={e => {
                          const updated = [...riders]
                          updated[idx] = {...updated[idx], productName: e.target.value}
                          setRiders(updated)
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <select value={rider.category} onChange={e => {
                        const updated = [...riders]
                        updated[idx] = {...updated[idx], category: e.target.value as InsuranceCategory}
                        setRiders(updated)
                      }}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                        {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <input type="number" min={0} step="any" placeholder="保费（元/年）"
                        value={rider.premium || ''} onChange={e => {
                          const updated = [...riders]
                          updated[idx] = {...updated[idx], premium: Number(e.target.value)}
                          setRiders(updated)
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                    <div>
                      <select value={rider.paymentMethod} onChange={e => {
                        const updated = [...riders]
                        updated[idx] = {...updated[idx], paymentMethod: e.target.value as typeof PAYMENT_METHODS[number]}
                        setRiders(updated)
                      }}
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
                        {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <input type="number" min={0} placeholder="缴费年限"
                        value={rider.paymentPeriod || ''} onChange={e => {
                          const updated = [...riders]
                          updated[idx] = {...updated[idx], paymentPeriod: Number(e.target.value)}
                          setRiders(updated)
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </>
            )}
          </div>
        )}
        </div>

        {/* ===== 相关人员 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">相关人员</h2>
          <div className="space-y-3">
            <PersonSelector label="投保人 *" value={form.holderId}
              onChange={id => setForm({...form, holderId: id})}
              persons={persons} onNewPerson={f => { setActivePersonField(f); setShowNewPersonForm(true) }} />
            <PersonSelector label="被保人" multiple values={form.insuredIds}
              onAdd={id => setForm({...form, insuredIds: [...form.insuredIds, id]})}
              onRemove={id => setForm({...form, insuredIds: form.insuredIds.filter(i => i !== id)})}
              persons={persons} onNewPerson={f => { setActivePersonField(f); setShowNewPersonForm(true) }} />
            {/* 受益人 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">受益人</label>
              <div className="flex gap-3 mb-2">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="beneficiaryType" value="法定" checked={form.beneficiaryType === '法定'}
                    onChange={() => setForm({...form, beneficiaryType: '法定', beneficiaryIds: [], beneficiaryShares: {}})}
                    className="text-blue-600" />
                  法定继承人
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" name="beneficiaryType" value="指定" checked={form.beneficiaryType === '指定'}
                    onChange={() => setForm({...form, beneficiaryType: '指定'})}
                    className="text-blue-600" />
                  指定受益人
                </label>
              </div>
              {form.beneficiaryType === '指定' && (
                <div>
                  <PersonSelector label="受益人（指定）" multiple values={form.beneficiaryIds}
                    onAdd={id => setForm({...form, beneficiaryIds: [...form.beneficiaryIds, id]})}
                    onRemove={id => {
                      const shares = {...form.beneficiaryShares}
                      delete shares[id]
                      setForm({...form, beneficiaryIds: form.beneficiaryIds.filter(i => i !== id), beneficiaryShares: shares})
                    }} persons={persons} onNewPerson={f => { setActivePersonField(f); setShowNewPersonForm(true) }} />
                  {form.beneficiaryIds.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-gray-400">份额百分比（总和应为 100%）</p>
                      {form.beneficiaryIds.map(id => {
                        const p = persons.find(pp => pp.id === id)
                        return (
                          <div key={id} className="flex items-center gap-2">
                            <span className="text-sm text-gray-600 w-16 truncate">{p?.name || '未知'}</span>
                            <input type="number" min={0} max={100} step="any"
                              value={form.beneficiaryShares[id] || ''}
                              onChange={e => setForm({
                                ...form,
                                beneficiaryShares: {...form.beneficiaryShares, [id]: Number(e.target.value)}
                              })}
                              className="w-20 px-2 py-1 border rounded text-sm" />
                            <span className="text-xs text-gray-400">%</span>
                          </div>
                        )
                      })}
                      <p className={`text-xs ${Object.values(form.beneficiaryShares).reduce((a, b) => a + b, 0) === 100 ? 'text-green-600' : 'text-amber-500'}`}>
                        合计：{Object.values(form.beneficiaryShares).reduce((a, b) => a + b, 0)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== 缴费信息 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">缴费信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">年缴保费（元）</label>
              <input type="number" min={0} step="any" value={form.premium || ''}
                onChange={e => setForm({...form, premium: Number(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">缴费方式</label>
              <select value={form.paymentMethod} onChange={e => setForm({...form, paymentMethod: e.target.value as any})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            {form.paymentMethod !== '趸交' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">缴费年限</label>
                <input type="number" min={1} value={form.paymentPeriod || ''}
                  onChange={e => setForm({...form, paymentPeriod: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
            )}
            {form.paymentMethod !== '趸交' && form.startDate && (() => {
              const parts = form.startDate.split('-')
              const month = parseInt(parts[1], 10)
              const day = parseInt(parts[2], 10)
              const endYear = parseInt(parts[0], 10) + form.paymentPeriod
              const freqText = (() => {
                if (form.paymentMethod === '年缴') return `每年${month}月${day}日`
                if (form.paymentMethod === '半年缴') {
                  const m2 = month + 6 > 12 ? month + 6 - 12 : month + 6
                  return `每年${month}月${day}日和${m2}月${day}日`
                }
                if (form.paymentMethod === '季缴') {
                  const months: number[] = []
                  for (let i = 0; i < 4; i++) {
                    let m = month + i * 3
                    if (m > 12) m -= 12
                    months.push(m)
                  }
                  return `每年${months.join('、')}月的${day}日`
                }
                return `每月${day}日`
              })()
              return (
                <div className="text-xs text-gray-400 self-end pb-1">
                  📅 {freqText}（共缴至{endYear}年）
                </div>
              )
            })()}
          </div>
        </div>

        {/* ===== 时间信息 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">时间信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">起保日期 *</label>
              <input type="date" value={form.startDate}
                onChange={e => setForm({...form, startDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">合同到期日期</label>
              <input type="date" value={form.endDate}
                onChange={e => setForm({...form, endDate: e.target.value})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            {/* 缴费结束日期（自动推算） */}
            {form.paymentMethod !== '趸交' && form.startDate && form.paymentPeriod > 0 && (() => {
              const start = form.startDate.split('-')
              const endY = parseInt(start[0], 10) + form.paymentPeriod
              const lastPayDate = `${endY}-${start[1]}-${start[2]}`
              return (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">缴费结束日期</label>
                  <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-600">
                    {lastPayDate}（自动推算）
                  </div>
                </div>
              )
            })()}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as PolicyStatus})}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.renewable}
                onChange={e => setForm({...form, renewable: e.target.checked})}
                className="rounded border-gray-300" />
              可续保
            </label>
            {form.renewable && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">提前</span>
                <input type="number" min={1} value={form.renewalAlertDays}
                  onChange={e => setForm({...form, renewalAlertDays: Number(e.target.value)})}
                  className="w-16 px-2 py-1 border rounded text-sm" />
                <span className="text-sm text-gray-500">天提醒</span>
              </div>
            )}
          </div>
        </div>

        {/* ===== 保障权益 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-700">保障权益</h2>
            <button type="button" onClick={addCoverage}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
              <Plus className="w-3.5 h-3.5" /> 添加保障项
            </button>
          </div>

          {coverages.length === 0 && (
            <p className="text-sm text-gray-400 py-3 text-center">添加保障权益后，遇事查保会更精准</p>
          )}

          <div className="space-y-3">
            {coverages.map((cov, i) => (
              <div key={i} className="p-3 bg-gray-50 rounded-lg relative">
                <button type="button" onClick={() => removeCoverage(i)}
                  className="absolute top-2 right-2 text-gray-400 hover:text-red-500">
                  <X className="w-4 h-4" />
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <input placeholder="保障项目名称，如：重大疾病保险金"
                      value={cov.name} onChange={e => updateCoverage(i, 'name', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <input type="number" step="any" placeholder="保额（元）"
                      value={cov.amount || ''} onChange={e => updateCoverage(i, 'amount', Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <input placeholder="赔付条件说明"
                      value={cov.condition || ''} onChange={e => updateCoverage(i, 'condition', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 mt-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.hasDividend}
                onChange={e => setForm({...form, hasDividend: e.target.checked})}
                className="rounded border-gray-300" />
              有分红
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.hasSurvivalBenefit}
                onChange={e => setForm({...form, hasSurvivalBenefit: e.target.checked})}
                className="rounded border-gray-300" />
              有生存金
            </label>
          </div>

          {/* 分红/生存金领取时间设定 */}
          {(form.hasDividend || form.hasSurvivalBenefit) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-600">领取时间设定</h3>
                <button type="button" onClick={() => setBenefits([...benefits, { type: form.hasDividend ? '分红' : '生存金' as any, year: '', amount: 0 }])}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700">
                  <Plus className="w-3.5 h-3.5" /> 添加领取日期
                </button>
              </div>
              {benefits.length === 0 && (
                <p className="text-xs text-gray-400">添加分红/生存金的预计领取时间和金额</p>
              )}
              <div className="space-y-2">
                {benefits.map((b, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select value={b.type} onChange={e => {
                      const updated = [...benefits]
                      updated[i] = {...updated[i], type: e.target.value as any}
                      setBenefits(updated)
                    }}
                      className="px-2 py-1.5 border rounded text-xs bg-white">
                      <option value="分红">分红</option>
                      <option value="生存金">生存金</option>
                      <option value="满期金">满期金</option>
                      <option value="年金">年金</option>
                    </select>
                    <input type="date" value={b.year}
                      onChange={e => {
                        const updated = [...benefits]
                        updated[i] = {...updated[i], year: e.target.value}
                        setBenefits(updated)
                      }}
                      className="flex-1 px-2 py-1.5 border rounded text-sm" />
                    <input type="number" min={0} step="any" placeholder="金额"
                      value={b.amount || ''} onChange={e => {
                        const updated = [...benefits]
                        updated[i] = {...updated[i], amount: Number(e.target.value)}
                        setBenefits(updated)
                      }}
                      className="w-24 px-2 py-1.5 border rounded text-sm" />
                    <button type="button" onClick={() => setBenefits(benefits.filter((_, j) => j !== i))}
                      className="text-red-400 hover:text-red-600 text-xs">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ===== 文档上传 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">合同文件</h2>
          <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-gray-200 rounded-lg cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            {ocrLoading ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> : <Scan className="w-5 h-5 text-gray-400" />}
            <span className="text-sm text-gray-500">{ocrLoading ? ocrStatus || '识别中...' : '上传 PDF 或拍照上传（自动识别）'}</span>
            <input type="file" multiple accept=".pdf,image/*" onChange={handleFileUpload} className="hidden" />
          </label>
          {ocrStatus && !ocrLoading && (
            <p className="text-xs mt-1.5 text-gray-500">{ocrStatus}</p>
          )}
          {documents.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {documents.map((d, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg text-sm">
                  <span className="text-gray-600 truncate">{d.name}</span>
                  <button type="button" onClick={() => setDocuments(documents.filter((_, j) => j !== i))}
                    className="text-red-400 hover:text-red-600 flex-shrink-0">删除</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ===== 备注 ===== */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h2 className="font-semibold text-gray-700 mb-4">备注</h2>
          <textarea value={form.note} onChange={e => setForm({...form, note: e.target.value})}
            rows={3} placeholder="其他需要记录的信息..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none" />
        </div>

        {/* ===== 提交 ===== */}
        <button type="submit" disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {saving ? '保存中...' : isEdit ? '更新保单' : '保存保单'}
        </button>
      </form>
      </>
    )
  }
}
