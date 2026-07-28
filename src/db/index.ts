import Dexie, { type EntityTable } from 'dexie'
import type { Policy, Person, Coverage, PremiumRecord, BenefitRecord, Reminder } from '../types'

export class InsuranceDB extends Dexie {
  policies!: EntityTable<Policy, 'id'>
  persons!: EntityTable<Person, 'id'>
  coverages!: EntityTable<Coverage, 'id'>
  premiums!: EntityTable<PremiumRecord, 'id'>
  benefits!: EntityTable<BenefitRecord, 'id'>
  reminders!: EntityTable<Reminder, 'id'>

  constructor() {
    super('InsurancePal')

    this.version(1).stores({
      policies: '++id, insurer, category, currency, status, holderId, startDate, endDate, parentPolicyId',
      persons: '++id, name, relation',
      coverages: '++id, policyId, name',
      premiums: '++id, policyId, dueDate, paid',
      benefits: '++id, policyId, type, expectedDate, received',
      reminders: '++id, policyId, type, date, done',
    })
  }

  /** 搜索匹配某事件的保单（遇事查保） */
  async searchByEvent(keywords: string[]) {
    const categories = new Set<string>()
    for (const kw of keywords) {
      const { EVENT_KEYWORDS } = await import('../types')
      const cats = EVENT_KEYWORDS[kw]
      if (cats) cats.forEach(c => categories.add(c))
    }
    if (categories.size === 0) return []
    return this.policies
      .where('category')
      .anyOf([...categories])
      .filter(p => p.status === '有效')
      .toArray()
  }

  /** 获取某人的所有保单 */
  async getPersonPolicies(personId: number) {
    return this.policies
      .filter(p => p.holderId === personId || p.insuredIds.includes(personId))
      .toArray()
  }

  /** 获取即将到来的缴费提醒 */
  async getUpcomingPremiums(days: number = 30) {
    const today = new Date()
    const future = new Date(today.getTime() + days * 86400000)
    const dateStr = (d: Date) => d.toISOString().slice(0, 10)
    return this.premiums
      .filter(p => !p.paid && p.dueDate >= dateStr(today) && p.dueDate <= dateStr(future))
      .toArray()
  }
}

export const db = new InsuranceDB()
