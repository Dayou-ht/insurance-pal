import { db } from '../db'

export async function seedDemoData() {
  // 清除旧数据
  await Promise.all([
    db.policies.clear(), db.persons.clear(), db.coverages.clear(),
    db.premiums.clear(), db.benefits.clear(), db.reminders.clear(),
  ])

  // 家庭成员
  await db.persons.bulkAdd([
    { name: '张建国', relation: '本人' as const, birthDate: '1975-03-15', phone: '13800138001', note: '家庭支柱' },
    { name: '李秀芳', relation: '配偶', birthDate: '1978-08-22', phone: '13800138002' },
    { name: '张小明', relation: '子女', birthDate: '2005-06-10' },
    { name: '张小美', relation: '子女', birthDate: '2010-11-28' },
    { name: '张德厚', relation: '父母', birthDate: '1950-01-05', note: '张建国父亲' },
    { name: '王玉兰', relation: '父母', birthDate: '1952-07-18', note: '张建国母亲' },
  ])
  const [p1, p2, p3, p4, p5, p6] = [1, 2, 3, 4, 5, 6]
  const now = new Date().toISOString()

  // 保单
  const policyData: any[] = [
    { insurer: '中国人寿', policyNumber: 'GS20250101001', productName: '国寿福终身重疾', category: '重疾险', holderId: p1, insuredIds: [p1], premium: 12500, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 15, startDate: '2010-03-01', endDate: '终身', status: '有效' },
    { insurer: '中国平安', policyNumber: 'PA20150315088', productName: '平安福终身寿险', category: '寿险', holderId: p1, insuredIds: [p1], beneficiaryIds: [p2, p3, p4], premium: 15000, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 8, startDate: '2015-03-15', endDate: '终身', status: '有效' },
    { insurer: '太平洋保险', policyNumber: 'TPY20180812066', productName: '太保百万医疗', category: '医疗险', holderId: p1, insuredIds: [p1], premium: 850, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 12, startDate: '2018-08-12', endDate: '2028-08-11', status: '有效', renewable: true },
    { insurer: '中国人保', policyNumber: 'RB20200101033', productName: '人保意外险至尊版', category: '意外险', holderId: p1, insuredIds: [p1], premium: 299, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 20, startDate: '2020-01-01', endDate: '2026-12-31', status: '有效', renewable: true },
    { insurer: '新华保险', policyNumber: 'XH20060601022', productName: '新华红双喜分红险', category: '分红险', holderId: p1, insuredIds: [p1], premium: 50000, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 1, startDate: '2006-06-01', endDate: '2026-06-01', status: '有效', hasDividend: true },
    { insurer: '泰康人寿', policyNumber: 'TK20120618099', productName: '泰康健康百分百', category: '重疾险', holderId: p1, insuredIds: [p1], premium: 8900, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 18, startDate: '2012-06-18', endDate: '终身', status: '有效' },
    { insurer: '中国平安', policyNumber: 'PA20220815077', productName: '平安e生保2022', category: '医疗险', holderId: p1, insuredIds: [p1, p2, p3, p4], premium: 1200, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 15, startDate: '2022-08-15', endDate: '2027-08-14', status: '有效', renewable: true },
    { insurer: '中国人寿', policyNumber: 'GS20250228044', productName: '国寿鑫裕年年年金', category: '年金险', holderId: p1, insuredIds: [p1], premium: 20000, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 28, startDate: '2025-02-28', endDate: '2045-02-27', status: '有效', hasSurvivalBenefit: true, note: '60岁起每年领生存金' },
    { insurer: '阳光保险', policyNumber: 'YG20120101055', productName: '阳光随e保定期寿险', category: '寿险', holderId: p1, insuredIds: [p1], premium: 3600, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 10, startDate: '2012-01-01', endDate: '2032-01-01', status: '有效' },
    { insurer: '中国平安', policyNumber: 'PA20050101001', productName: '平安康泰终身保险(老版)', category: '重疾险', holderId: p1, insuredIds: [p1], premium: 3200, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 5, startDate: '2005-01-01', endDate: '2025-01-01', status: '已过期' },
    { insurer: '中国人寿', policyNumber: 'GS20080315066', productName: '国寿康宁定期', category: '重疾险', holderId: p1, insuredIds: [p1], premium: 2800, paymentMethod: '年缴', paymentPeriod: 15, paymentDay: 15, startDate: '2008-03-15', endDate: '2023-03-15', status: '已过期', note: '保障期满，未续保' },
    { insurer: '太平洋保险', policyNumber: 'TPY20090601003', productName: '太保长泰安康', category: '寿险', holderId: p1, insuredIds: [p1], premium: 5000, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 6, startDate: '2009-06-01', endDate: '2019-06-01', status: '已过期' },
    { insurer: '中国平安', policyNumber: 'PA20110601088', productName: '平安智盈人生万能险', category: '万能险', holderId: p2, insuredIds: [p2], premium: 12000, paymentMethod: '年缴', paymentPeriod: 15, paymentDay: 6, startDate: '2011-06-01', endDate: '终身', status: '有效', hasDividend: true },
    { insurer: '中国人寿', policyNumber: 'GS20170601044', productName: '国寿如E康悦医疗', category: '医疗险', holderId: p2, insuredIds: [p2], premium: 680, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 6, startDate: '2017-06-01', endDate: '2027-05-31', status: '有效', renewable: true },
    { insurer: '新华保险', policyNumber: 'XH20200101022', productName: '新华i健康重疾', category: '重疾险', holderId: p2, insuredIds: [p2], premium: 7500, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 11, startDate: '2020-01-01', endDate: '终身', status: '有效' },
    { insurer: '中国平安', policyNumber: 'PA20231201099', productName: '平安长相安长期医疗', category: '医疗险', holderId: p2, insuredIds: [p2], premium: 1050, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 1, startDate: '2023-12-01', endDate: '2043-11-30', status: '有效' },
    { insurer: '泰康人寿', policyNumber: 'TK20151015033', productName: '泰康全心全意', category: '意外险', holderId: p2, insuredIds: [p2], premium: 450, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 15, startDate: '2015-10-15', endDate: '2026-10-14', status: '有效', renewable: true },
    { insurer: '中国平安', policyNumber: 'PA20150601011', productName: '平安智慧星少儿险', category: '年金险', holderId: p1, insuredIds: [p3], premium: 10000, paymentMethod: '年缴', paymentPeriod: 15, paymentDay: 1, startDate: '2015-06-01', endDate: '2045-06-01', status: '有效', hasSurvivalBenefit: true, note: '教育金+婚嫁金' },
    { insurer: '中国人保', policyNumber: 'RB20220301055', productName: '人保学平险2022', category: '学平险', holderId: p1, insuredIds: [p3], premium: 200, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 1, startDate: '2022-03-01', endDate: '2026-08-31', status: '有效', renewable: true },
    { insurer: '太平洋保险', policyNumber: 'TPY20190610077', productName: '太保少儿重疾', category: '重疾险', holderId: p1, insuredIds: [p3], premium: 4200, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 10, startDate: '2019-06-10', endDate: '终身', status: '有效' },
    { insurer: '中国人寿', policyNumber: 'GS20161201022', productName: '国寿福少儿版', category: '重疾险', holderId: p1, insuredIds: [p4], premium: 3800, paymentMethod: '年缴', paymentPeriod: 20, paymentDay: 12, startDate: '2016-12-01', endDate: '终身', status: '有效' },
    { insurer: '中国平安', policyNumber: 'PA20220901088', productName: '平安学平险', category: '学平险', holderId: p1, insuredIds: [p4], premium: 150, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 1, startDate: '2022-09-01', endDate: '2026-08-31', status: '有效', renewable: true },
    { insurer: '中国人寿', policyNumber: 'GS20000101001', productName: '国寿99鸿福', category: '寿险', holderId: p5, insuredIds: [p5], beneficiaryIds: [p1], premium: 8000, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 1, startDate: '2000-01-01', endDate: '终身', status: '有效', hasDividend: true, note: '已缴清' },
    { insurer: '中国人保', policyNumber: 'RB20180501033', productName: '人保防癌险', category: '重疾险', holderId: p5, insuredIds: [p5], premium: 3500, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 5, startDate: '2018-05-01', endDate: '2028-04-30', status: '有效', note: '老年人专属防癌' },
    { insurer: '中国平安', policyNumber: 'PA20140801066', productName: '平安老年意外险', category: '意外险', holderId: p1, insuredIds: [p5], premium: 380, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 8, startDate: '2014-08-01', endDate: '2026-07-31', status: '有效', renewable: true },
    { insurer: '新华保险', policyNumber: 'XH20050101044', productName: '新华养老金保险', category: '年金险', holderId: p6, insuredIds: [p6], premium: 15000, paymentMethod: '年缴', paymentPeriod: 10, paymentDay: 1, startDate: '2005-01-01', endDate: '终身', status: '有效', hasSurvivalBenefit: true, note: '已缴清，55岁起领养老金' },
    { insurer: '中国人寿', policyNumber: 'GS20210601033', productName: '国寿夕阳红医疗', category: '医疗险', holderId: p6, insuredIds: [p6], premium: 2200, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 6, startDate: '2021-06-01', endDate: '2027-05-31', status: '有效', renewable: true },
    { insurer: '泰康人寿', policyNumber: 'TK20190315055', productName: '泰康老年骨折险', category: '意外险', holderId: p1, insuredIds: [p6], premium: 180, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 15, startDate: '2019-03-15', endDate: '2026-03-14', status: '有效', renewable: true },
    { insurer: '中国平安', policyNumber: 'PA20190301001', productName: '平安家庭财产险', category: '家财险', holderId: p1, insuredIds: [p1], premium: 600, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 1, startDate: '2019-03-01', endDate: '2026-02-28', status: '有效', renewable: true, note: '房屋及室内财产' },
    { insurer: '中国平安', policyNumber: 'PA20200101002', productName: '平安驾乘意外险', category: '车险', holderId: p1, insuredIds: [p1], premium: 3800, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 10, startDate: '2025-01-01', endDate: '2025-12-31', status: '有效' },
    { insurer: '中国人保', policyNumber: 'RB20240701066', productName: '人保旅行意外险（年度）', category: '旅行险', holderId: p1, insuredIds: [p1, p2, p3, p4], premium: 365, paymentMethod: '年缴', paymentPeriod: 1, paymentDay: 1, startDate: '2024-07-01', endDate: '2025-06-30', status: '有效', renewable: true },
  ]

  const policyIds: number[] = []
  for (const p of policyData) {
    const id = await db.policies.add({ ...p, documents: [], createdAt: now, updatedAt: now })
    policyIds.push(id!)
  }

  // 保障权益
  const coverages = [
    { policyId: policyIds[0], name: '重大疾病保险金', amount: 300000, condition: '确诊100种重疾之一赔付' },
    { policyId: policyIds[0], name: '轻症疾病保险金', amount: 90000, condition: '确诊50种轻症赔付30%' },
    { policyId: policyIds[0], name: '身故保险金', amount: 300000, condition: '身故赔付' },
    { policyId: policyIds[1], name: '身故保险金', amount: 500000, condition: '身故赔付' },
    { policyId: policyIds[1], name: '全残保险金', amount: 500000, condition: '全残赔付' },
    { policyId: policyIds[2], name: '住院医疗报销', amount: 2000000, condition: '住院医疗费用报销，免赔额1万' },
    { policyId: policyIds[3], name: '意外身故', amount: 100000, condition: '意外身故赔付' },
    { policyId: policyIds[3], name: '意外医疗', amount: 50000, condition: '意外医疗费用报销' },
    { policyId: policyIds[3], name: '意外住院津贴', amount: 150, condition: '150元/天，最高180天' },
    { policyId: policyIds[4], name: '年度分红', amount: 0, condition: '每年按保险公司经营状况分配红利' },
    { policyId: policyIds[5], name: '重大疾病保险金', amount: 200000, condition: '确诊80种重疾赔付' },
    { policyId: policyIds[5], name: '中症疾病保险金', amount: 100000, condition: '确诊20种中症赔付50%' },
    { policyId: policyIds[12], name: '身故保险金', amount: 200000, condition: '万能账户价值+身故赔付' },
    { policyId: policyIds[12], name: '重疾保险金', amount: 150000, condition: '确诊重疾提前给付' },
    { policyId: policyIds[18], name: '身故保险金', amount: 100000, condition: '身故赔付' },
    { policyId: policyIds[22], name: '身故保险金', amount: 50000, condition: '身故赔付' },
  ]
  for (const c of coverages) await db.coverages.add(c)

  // 缴费记录
  const premiums = [
    { policyId: policyIds[0], dueDate: '2026-03-15', amount: 12500, paid: false, paymentMethod: '银行卡' },
    { policyId: policyIds[1], dueDate: '2026-03-08', amount: 15000, paid: false, paymentMethod: '银行卡' },
    { policyId: policyIds[2], dueDate: '2026-08-12', amount: 850, paid: false, paymentMethod: '银行卡' },
    { policyId: policyIds[4], dueDate: '2026-06-01', amount: 50000, paid: true, paidDate: '2026-06-01', paymentMethod: '银行卡' },
    { policyId: policyIds[17], dueDate: '2026-06-01', amount: 10000, paid: true, paidDate: '2026-06-01', paymentMethod: '银行卡' },
    { policyId: policyIds[25], dueDate: '2026-06-01', amount: 15000, paid: true, paidDate: '2026-06-01', paymentMethod: '银行卡' },
    { policyId: policyIds[12], dueDate: '2026-06-06', amount: 12000, paid: false, paymentMethod: '银行卡' },
    { policyId: policyIds[7], dueDate: '2026-02-28', amount: 20000, paid: false, paymentMethod: '银行卡' },
    { policyId: policyIds[28], dueDate: '2025-12-31', amount: 3800, paid: false, paymentMethod: '银行卡' },
  ]
  for (const r of premiums) {
    await db.premiums.add(r as any)
  }

  // 分红/生存金
  for (const b of [
    { policyId: policyIds[4], type: '分红', expectedDate: '2026-06-01', amount: 3500, received: true, receivedDate: '2026-06-05', guaranteed: false, note: '2025年度分红' },
    { policyId: policyIds[4], type: '分红', expectedDate: '2025-06-01', amount: 3200, received: true, receivedDate: '2025-06-03', guaranteed: false },
    { policyId: policyIds[4], type: '分红', expectedDate: '2024-06-01', amount: 2800, received: true, receivedDate: '2024-06-02', guaranteed: false },
    { policyId: policyIds[12], type: '分红', expectedDate: '2026-06-06', amount: 1800, received: false, guaranteed: false, note: '预估' },
    { policyId: policyIds[17], type: '生存金', expectedDate: '2026-06-01', amount: 8000, received: true, receivedDate: '2026-06-01', guaranteed: true, note: '教育金领取' },
    { policyId: policyIds[25], type: '生存金', expectedDate: '2026-01-01', amount: 12000, received: true, receivedDate: '2026-01-05', guaranteed: true, note: '养老金' },
    { policyId: policyIds[7], type: '生存金', expectedDate: '2035-02-28', amount: 25000, received: false, guaranteed: false, note: '预计60岁起领' },
  ]) await db.benefits.add(b as any)

  // 提醒
  for (const r of [
    { policyId: policyIds[1], type: '缴费', title: '平安福终身寿险保费到期', date: '2026-03-08', done: false },
    { policyId: policyIds[0], type: '缴费', title: '国寿福终身重疾保费到期', date: '2026-03-15', done: false },
    { policyId: policyIds[12], type: '缴费', title: '平安智盈人生万能险保费到期', date: '2026-06-06', done: false },
    { policyId: policyIds[4], type: '缴费', title: '新华红双喜分红险保费到期', date: '2026-06-01', done: true },
    { policyId: policyIds[3], type: '续保', title: '人保意外险至尊版续保提醒', date: '2026-12-20', done: false },
  ]) await db.reminders.add(r as any)

  return { policies: policyData.length, coverages: coverages.length, premiums: premiums.length }
}
