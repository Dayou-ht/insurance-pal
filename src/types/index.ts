// ===== 人 =====
export interface Person {
  id?: number
  name: string
  relation: '本人' | '配偶' | '子女' | '父母' | '其他'
  idCard?: string
  phone?: string
  birthDate?: string
  note?: string
}

// ===== 保障权益 =====
export interface Coverage {
  id?: number
  policyId: number
  name: string              // 保障项目名称，如"重大疾病保险金"
  amount: number            // 保额
  condition: string         // 赔付条件说明
  note?: string
}

// ===== 缴费记录 =====
export interface PremiumRecord {
  id?: number
  policyId: number
  dueDate: string           // 缴费日 YYYY-MM-DD
  amount: number
  paid: boolean
  paidDate?: string
  paymentMethod?: '银行卡' | '微信' | '支付宝' | '现金' | '其他'
  note?: string
}

// ===== 分红/生存金/红利 =====
export interface BenefitRecord {
  id?: number
  policyId: number
  type: '分红' | '生存金' | '满期金' | '年金' | '保证现金价值' | '复归红利' | '终期红利' | '其他'
  expectedDate: string
  amount: number
  received: boolean
  receivedDate?: string
  guaranteed: boolean      // 是否保证部分（香港保险区分保证/非保证）
  note?: string
}

// ===== 保单 =====
export interface Policy {
  id?: number
  // 基本信息
  insurer: string           // 保司
  policyNumber: string      // 保单号
  productName: string       // 产品名称
  category: InsuranceCategory
  subCategory?: string
  currency: Currency        // 币种：CNY / HKD / USD
  parentPolicyId?: number   // 关联主险ID（附加险用）

  // 投保信息
  holderId: number          // 投保人
  insuredIds: number[]      // 被保人列表
  beneficiaryIds?: number[] // 受益人列表
  beneficiaryType?: '法定' | '指定'  // 受益人类型，默认法定
  beneficiaryShares?: Record<number, number> // 指定受益人份额百分比 { personId: 百分比 }

  // 缴费信息
  premium: number           // 年缴保费
  paymentMethod: '趸交' | '年缴' | '半年缴' | '月缴' | '季缴'
  paymentPeriod: number     // 缴费年限（0=趸交）
  paymentDay: number        // 缴费日（从起保日期自动推算，1-31）

  // 时间信息
  startDate: string         // 起保日期
  endDate: string           // 到期日期
  renewable: boolean        // 是否可续保
  renewalAlertDays: number  // 提前提醒天数

  // 状态
  status: PolicyStatus
  hasDividend: boolean      // 是否有分红
  hasSurvivalBenefit: boolean // 是否有生存金

  // 文档
  documents: PolicyDocument[]

  // 备注
  note?: string

  createdAt: string
  updatedAt: string
}

export type InsuranceCategory =
  | '重疾险'
  | '医疗险'
  | '意外险'
  | '寿险'
  | '年金险'
  | '分红险'
  | '万能险'
  | '车险'
  | '家财险'
  | '学平险'
  | '旅行险'
  | '危疾保险'
  | '储蓄保险'
  | '投资相连'
  | '其他'

export type Currency = 'CNY' | 'HKD' | 'USD'

export type PolicyStatus = '有效' | '已过期' | '已退保' | '等待生效' | '理赔中'

export interface PolicyDocument {
  id?: string
  name: string
  type: 'pdf' | 'image' | 'other'
  dataUrl: string            // base64 或文件路径
  uploadDate: string
}

// ===== 提醒 =====
export interface Reminder {
  id?: number
  policyId: number
  type: '缴费' | '续保' | '分红领取' | '生存金领取' | '满期金' | '理赔跟进' | '其他'
  title: string
  date: string
  done: boolean
  note?: string
}

// ===== 事件关键词映射（遇事查保） =====
export const EVENT_KEYWORDS: Record<string, InsuranceCategory[]> = {
  '住院': ['医疗险', '重疾险', '意外险'],
  '手术': ['医疗险', '重疾险', '意外险'],
  '骨折': ['意外险', '医疗险'],
  '癌症': ['重疾险', '医疗险'],
  '门诊': ['医疗险'],
  '意外': ['意外险', '医疗险'],
  '身故': ['寿险', '意外险'],
  '伤残': ['意外险', '重疾险', '寿险'],
  '养老': ['年金险', '分红险'],
  '教育金': ['年金险'],
  '车损': ['车险'],
  '火灾': ['家财险'],
  '洪水': ['家财险'],
  '旅行': ['旅行险'],
}

// ===== 缴费频率格式化 =====
/** 根据年缴保费和缴费方式，计算每期应缴金额 */
export function getInstallmentAmount(annualPremium: number, paymentMethod: string): number {
  switch (paymentMethod) {
    case '月缴': return annualPremium / 12
    case '季缴': return annualPremium / 4
    case '半年缴': return annualPremium / 2
    default: return annualPremium // 年缴、趸交
  }
}

/** 生成可读的缴费频率文字，如"每年6月30日""每年6月30日和12月30日""每月30日" */
export function formatPaymentFreq(paymentMethod: string, paymentDay: number, startDate?: string): string {
  if (!paymentDay) return ''
  const day = paymentDay
  if (paymentMethod === '月缴') return `每月${day}日`

  // 从起保日期获取月份
  let month = 0
  if (startDate) {
    month = parseInt(startDate.split('-')[1], 10)
  }
  if (!month) month = 1 // 降级处理

  if (paymentMethod === '年缴') return `每年${month}月${day}日`

  if (paymentMethod === '半年缴') {
    const m2 = month + 6 > 12 ? month + 6 - 12 : month + 6
    return `每年${month}月${day}日和${m2}月${day}日`
  }

  if (paymentMethod === '季缴') {
    // 从起始月份算四个季度月份
    const months: number[] = []
    for (let i = 0; i < 4; i++) {
      let m = month + i * 3
      if (m > 12) m -= 12
      months.push(m)
    }
    return `每年${months.join('、')}月的${day}日`
  }

  return ''
}

/** 根据缴费信息生成所有应缴日期列表 */
export function generatePaymentDates(
  startDate: string,
  paymentMethod: string,
  paymentPeriod: number,
  paymentDay: number
): { dueDate: string; amount: number }[] {
  const dates: { dueDate: string; amount: number }[] = []
  if (paymentMethod === '趸交' || !startDate || paymentPeriod <= 0) return dates

  // 每期相隔月数
  let monthsPerPayment = 12
  if (paymentMethod === '月缴') monthsPerPayment = 1
  else if (paymentMethod === '季缴') monthsPerPayment = 3
  else if (paymentMethod === '半年缴') monthsPerPayment = 6

  const totalMonths = paymentPeriod * 12
  const numPayments = Math.max(1, Math.ceil(totalMonths / monthsPerPayment))

  const start = new Date(startDate)
  for (let i = 0; i < numPayments; i++) {
    const d = new Date(start)
    d.setMonth(d.getMonth() + i * monthsPerPayment)
    // 处理月末边界（如1月31日 + 1个月 = 2月28/29日）
    const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(paymentDay, maxDay))
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dates.push({ dueDate: `${y}-${m}-${dd}`, amount: 0 }) // amount set at save time
  }
  return dates
}
