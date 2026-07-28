import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { seedDemoData } from '../db/seed'
import { Shield, DollarSign, Users, AlertTriangle, Paperclip, ExternalLink, ChevronRight, PlusCircle, Download } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts'
import { Link, useNavigate } from 'react-router-dom'

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6']

export default function Dashboard() {
  const navigate = useNavigate()
  const [expandedDecade, setExpandedDecade] = useState<number | null>(null)
  const policies = useLiveQuery(() => db.policies.toArray()) || []
  const persons = useLiveQuery(() => db.persons.toArray()) || []
  const upcomingPremiums = useLiveQuery(() => db.getUpcomingPremiums(30)) || []

  // 空状态：没有数据时展示欢迎页
  const hasData = policies.length > 0 || persons.length > 0

  if (!hasData) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-md px-4">
          <Shield className="w-20 h-20 text-blue-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">欢迎来到保单管家</h1>
          <p className="text-gray-500 mb-8 leading-relaxed">
            管理你的家庭保单，随时查看保障覆盖和缴费计划。<br />
            所有数据仅存储在你的设备上，不上传任何服务器。
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/policies/new"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
            >
              <PlusCircle className="w-5 h-5" />
              添加第一份保单
            </Link>
            <button
              onClick={async () => {
                if (confirm('将加载一个6口之家、28份保单的演示数据，这会清空现有数据。确认？')) {
                  await seedDemoData()
                  alert('✅ 示例数据加载完成！刷新即可查看')
                }
              }}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <Download className="w-5 h-5" />
              加载演示数据
            </button>
          </div>
          <div className="mt-10 bg-blue-50 rounded-xl p-5 text-left">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 text-sm">🔒 隐私承诺</p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  你的保单数据仅存储在当前浏览器中，不上传任何服务器。
                  无需注册账号，无需绑定手机。随时可通过「设置 → 导出备份」备份你的数据。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const allMainPolicies = policies.filter(p => !p.parentPolicyId)
  const riders = policies.filter(p => p.parentPolicyId)
  const activeMains = allMainPolicies.filter(p => p.status === '有效')
  const activeRiders = riders.filter(r => r.status === '有效')

  // 年缴保费 = 主险 + 附加险合计
  const totalYearlyPremium = activeMains.reduce((s, p) => s + p.premium, 0) +
    activeRiders.reduce((s, r) => s + r.premium, 0)

  const currencySymbol: Record<string, string> = { CNY: '¥', HKD: 'HK$', USD: 'US$' }
  const cs = (c?: string) => currencySymbol[c || 'CNY'] || '¥'

  // 保费按币种合计
  const allActive = [...activeMains, ...activeRiders]
  const premiumByCurrency = allActive.reduce((acc, p) => {
    const cur = p.currency || 'CNY'
    acc[cur] = (acc[cur] || 0) + p.premium
    return acc
  }, {} as Record<string, number>)

  // 险种分布（只算主险，排除附加险）
  const categoryData = Object.entries(
    activeMains.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))

  // 保司分布（只算主险）
  const insurerData = Object.entries(
    activeMains.reduce((acc, p) => {
      acc[p.insurer] = (acc[p.insurer] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }))

  // 成员保障数（只算主险，每人仅计一次）
  const memberData = persons.map(person => ({
    name: person.name,
    id: person.id,
    投保人: activeMains.filter(p => p.holderId === person.id).length,
    被保人: activeMains.filter(p => p.insuredIds.includes(person.id!)).length,
    受益人: activeMains.filter(p => p.beneficiaryIds?.includes(person.id!)).length,
  }))

  // 按成员×险种 保额汇总
  const coverages = useLiveQuery(() => db.coverages.toArray()) || []
  const memberCoverageData = persons.map(person => {
    // 该成员作为投保人或被保人的有效保单
    const relPolicies = allMainPolicies.filter(p =>
      p.status === '有效' && (p.holderId === person.id || p.insuredIds.includes(person.id!))
    )
    // 按险种汇总保额
    const byCategory: Record<string, number> = {}
    for (const p of relPolicies) {
      const covs = coverages.filter(c => c.policyId === p.id)
      const total = covs.reduce((s, c) => s + c.amount, 0)
      if (total > 0) {
        byCategory[p.category] = (byCategory[p.category] || 0) + total
      }
    }
    return { name: person.name, id: person.id, categories: byCategory, total: Object.values(byCategory).reduce((a, b) => a + b, 0) }
  }).filter(d => d.total > 0)
  const maxMemberCoverage = Math.max(...memberCoverageData.flatMap(d => Object.values(d.categories)), 1)

  // 保险资产时间轴 — 年度现金流
  const allPremiums = useLiveQuery(() => db.premiums.toArray()) || []
  const allBenefits = useLiveQuery(() => db.benefits.toArray()) || []

  // 按年份归集
  const yearMap = new Map<number, { out: number; in: number; details: { type: string; amount: number }[] }>()
  for (const p of allPremiums) {
    const y = parseInt(p.dueDate.slice(0, 4), 10)
    if (!yearMap.has(y)) yearMap.set(y, { out: 0, in: 0, details: [] })
    yearMap.get(y)!.out += p.amount
  }
  for (const b of allBenefits) {
    const y = parseInt(b.expectedDate.slice(0, 4), 10)
    if (!yearMap.has(y)) yearMap.set(y, { out: 0, in: 0, details: [] })
    yearMap.get(y)!.in += b.amount
    yearMap.get(y)!.details.push({ type: b.type, amount: b.amount })
  }
  const timelineData = [...yearMap.entries()]
    .filter(([_, v]) => v.out > 0 || v.in > 0)
    .sort(([a], [b]) => a - b)
    .slice(0, 30) // 最多30年
  const maxFlow = Math.max(...timelineData.map(([_, v]) => Math.max(v.out, v.in)), 1)

  // 按十年归组
  const decadeGroups: { decade: number; years: typeof timelineData; outTotal: number; inTotal: number }[] = []
  for (const [year, data] of timelineData) {
    const decade = Math.floor(year / 10) * 10
    let group = decadeGroups.find(g => g.decade === decade)
    if (!group) {
      group = { decade, years: [], outTotal: 0, inTotal: 0 }
      decadeGroups.push(group)
    }
    group.years.push([year, data] as [number, typeof data])
    group.outTotal += data.out
    group.inTotal += data.in
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">家庭保障总览</h1>
          <p className="text-sm text-gray-500 mt-1">你的保单数据一目了然</p>
        </div>
        <Link to="/policies" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          + 添加保单
        </Link>
      </div>

      {/* 关键指标 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Shield} label="主险保单" value={`${activeMains.length} 份`}
          sub={activeRiders.length > 0 ? `含 ${activeRiders.length} 项附加险` : '无附加险'}
          color="blue" to="/policies" />
        <StatCard icon={DollarSign} label="年缴保费" value={
          Object.entries(premiumByCurrency).length > 1
            ? Object.entries(premiumByCurrency).map(([c, v]) => `${cs(c)}${v.toLocaleString()}`).join(' + ')
            : `${cs(Object.keys(premiumByCurrency)[0])}${totalYearlyPremium.toLocaleString()}`
        } sub="主险 + 附加险合计" color="green" to="/policies" />
        <StatCard icon={Users} label="家庭成员" value={`${persons.length} 人`} sub="已录入" color="purple" to="/family" />
        <StatCard icon={AlertTriangle} label="待缴费" value={`${upcomingPremiums.length} 笔`} sub="未来30天内" color="amber" to="/calendar" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* 险种分布 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <Link to="/policies" className="hover:underline">
            <h3 className="font-semibold text-gray-700 mb-3">险种分布 →</h3>
          </Link>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" label={({ name }) => name}
                    cursor="pointer"
                    onClick={(entry) => {
                      const name = entry as any as string
                      navigate(`/policies?category=${encodeURIComponent(name)}`)
                    }}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {categoryData.map((d, i) => (
                  <Link key={d.name} to={`/policies?category=${encodeURIComponent(d.name)}`}
                    className="flex items-center gap-2 text-sm group cursor-pointer">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-gray-600 group-hover:text-blue-600 transition-colors">{d.name}</span>
                    <span className="font-medium text-gray-800">{d.value}份</span>
                  </Link>
                ))}
                {activeRiders.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2">(另有 {activeRiders.length} 项附加险未计入分布)</p>
                )}
              </div>
            </div>
          ) : <p className="text-gray-400 text-sm py-10 text-center">暂无数据，先添加保单</p>}
        </div>

        {/* 成员保障 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <Link to="/family" className="hover:underline">
            <h3 className="font-semibold text-gray-700 mb-3">各成员保障数量 →</h3>
          </Link>
          {memberData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={memberData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: 'rgba(59,130,246,0.08)' }} />
                  <Bar dataKey="投保人" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} cursor="pointer"
                    onClick={(entry) => {
                      if (entry?.id) navigate(`/family?highlight=${entry.id}`)
                    }} />
                  <Bar dataKey="被保人" stackId="a" fill="#10b981" cursor="pointer"
                    onClick={(entry) => {
                      if (entry?.id) navigate(`/family?highlight=${entry.id}`)
                    }} />
                  <Bar dataKey="受益人" stackId="a" fill="#8b5cf6" cursor="pointer"
                    onClick={(entry) => {
                      if (entry?.id) navigate(`/family?highlight=${entry.id}`)
                    }} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex items-center justify-center gap-4 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{background:'#3b82f6'}}></span>投保人</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{background:'#10b981'}}></span>被保人</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{background:'#8b5cf6'}}></span>受益人</span>
              </div>
            </div>
          ) : <p className="text-gray-400 text-sm py-10 text-center">先添加家庭成员和保单</p>}
        </div>
      </div>

      {/* 保司分布 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <Link to="/policies" className="hover:underline">
          <h3 className="font-semibold text-gray-700 mb-3">保司分布 →</h3>
        </Link>
        {insurerData.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {insurerData.map(d => (
              <Link key={d.name} to={`/policies?insurer=${encodeURIComponent(d.name)}`}
                className="px-4 py-2 bg-gray-50 rounded-lg text-sm flex items-center gap-2 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer">
                <span className="text-gray-700">{d.name}</span>
                <span className="text-blue-600 font-medium">{d.value}份</span>
              </Link>
            ))}
          </div>
        ) : <p className="text-gray-400 text-sm">暂无数据</p>}
      </div>

      {/* 按成员×险种 保额汇总 */}
      {memberCoverageData.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">按成员保额汇总</h3>
          <div className="space-y-4">
            {memberCoverageData.map(d => {
              const categories = Object.entries(d.categories)
              return (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">{d.name}</span>
                    <span className="text-xs text-gray-400">合计 ¥{d.total.toLocaleString()}</span>
                  </div>
                  <div className="space-y-1.5">
                    {categories.map(([cat, amt], ci) => {
                      const pct = (amt / maxMemberCoverage) * 100
                      return (
                        <Link key={cat} to={`/policies?category=${encodeURIComponent(cat)}`}
                          className="flex items-center gap-3 group cursor-pointer">
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0 group-hover:text-blue-600 truncate">{cat}</span>
                          <div className="flex-1 h-4 bg-gray-50 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500 group-hover:opacity-80"
                              style={{ width: `${Math.max(pct, 0)}%`, backgroundColor: COLORS[ci] || '#3b82f6' }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700 w-20 text-right flex-shrink-0">
                            ¥{amt.toLocaleString()}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3">汇总主险保障权益中的保额，不含附加险</p>
        </div>
      )}

      {/* 保险资产时间轴 — 年度现金流 */}
      {timelineData.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">保险资产时间轴</h3>
          <div className="space-y-1">
            {decadeGroups.map(group => {
              const isExpanded = expandedDecade === group.decade
              const decadeLabel = `${group.decade}s`
              const netTotal = group.inTotal - group.outTotal
              return (
                <div key={group.decade} className="border border-gray-100 rounded-lg overflow-hidden">
                  {/* 年代标题（可点击展开/收起） */}
                  <button onClick={() => setExpandedDecade(isExpanded ? null : group.decade)}
                    className="flex items-center gap-2 w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left">
                    <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <span className="text-sm font-medium text-gray-700 w-14">{decadeLabel}</span>
                    <span className="text-xs text-red-500">
                      {group.outTotal > 0 ? `支出 -¥${(group.outTotal / 10000).toFixed(1)}万` : ''}
                    </span>
                    <span className="text-xs text-gray-300">/</span>
                    <span className="text-xs text-green-600">
                      {group.inTotal > 0 ? `收入 +¥${(group.inTotal / 10000).toFixed(1)}万` : ''}
                    </span>
                    <span className={`ml-auto text-xs font-semibold ${netTotal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      净额 {netTotal >= 0 ? '+' : ''}{netTotal.toLocaleString()}
                    </span>
                  </button>

                  {/* 展开：逐年详情 */}
                  {isExpanded && (
                    <div className="border-t border-gray-100">
                      {group.years.map(([year, data]) => {
                        const outPct = (data.out / maxFlow) * 100
                        const inPct = (data.in / maxFlow) * 100
                        const net = data.in - data.out
                        return (
                          <div key={year} className="flex items-center gap-2 px-4 py-1.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                            <span className="text-xs text-gray-400 w-8">{year}</span>
                            {/* 支出 */}
                            <div className="flex-1 flex items-center gap-1 justify-end">
                              {data.out > 0 && <span className="text-[10px] text-red-400">-¥{data.out.toLocaleString()}</span>}
                              <div className="w-16 h-2 bg-gray-50 rounded-sm overflow-hidden flex-row-reverse">
                                <div className="h-full bg-gradient-to-l from-red-400 to-red-300 rounded-sm"
                                  style={{ width: `${Math.max(outPct, 0)}%`, marginLeft: `${100 - Math.max(outPct, 0)}%` }} />
                              </div>
                            </div>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-200 flex-shrink-0" />
                            {/* 收入 */}
                            <div className="flex-1 flex items-center gap-1">
                              <div className="w-16 h-2 bg-gray-50 rounded-sm overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-green-400 to-green-300 rounded-sm"
                                  style={{ width: `${Math.max(inPct, 0)}%` }} />
                              </div>
                              {data.in > 0 && <span className="text-[10px] text-green-500">+¥{data.in.toLocaleString()}</span>}
                            </div>
                            <span className={`text-[10px] font-medium w-14 text-right ${net >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                              {net >= 0 ? '+' : ''}{net.toLocaleString()}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <details className="mt-3">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">查看明细说明</summary>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              按十年归组展示，点击各年代展开逐年明细<br />
              红色 = 保费支出（流出），绿色 = 分红/生存金/满期金等收入（流入）<br />
              净额 = 收入 − 支出
            </p>
          </details>
        </div>
      )}

      {/* 附加险 — 总览 */}
      {riders.length > 0 && (
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <Link to="/policies" className="hover:underline">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-gray-500" /> 附加险总览（{activeRiders.length}项）
            </h3>
          </Link>
          <div className="space-y-2">
            {activeRiders.slice(0, 10).map(r => {
              const main = allMainPolicies.find(m => m.id === r.parentPolicyId)
              return (
                <Link key={r.id} to={`/policies/${r.id}`}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded flex-shrink-0">附</span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-700 truncate block">{r.productName}</span>
                      <span className="text-xs text-gray-400">{main?.productName || r.insurer} 附加</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-gray-400">{r.category}</span>
                    <span className="text-sm font-medium text-blue-700">¥{r.premium.toLocaleString()}</span>
                  </div>
                </Link>
              )
            })}
            {activeRiders.length > 10 && (
              <Link to="/policies" className="block text-center text-sm text-blue-600 py-2 hover:underline">
                查看全部 {activeRiders.length} 项附加险 →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* 快速查询 — 金事通 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <ExternalLink className="w-4 h-4 text-gray-500" /> 快速查询
        </h3>
        <div className="space-y-2">
          <a href="https://apps.apple.com/cn/app/%E9%87%91%E4%BA%8B%E9%80%9A-%E4%BF%9D%E5%8D%95%E6%9F%A5%E8%AF%A2%E7%AE%A1%E7%90%86%E5%B7%A5%E5%85%B7/id1398623713" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 rounded-lg text-sm text-blue-700 hover:bg-blue-100 transition-colors w-fit">
            <ExternalLink className="w-4 h-4" />
            下载金事通 App（查名下所有保单）
          </a>
          <p className="text-xs text-gray-400">中国银保信官方出品 · 需实名+人脸识别登录</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, color, to }: {
  icon: any; label: string; value: string; sub: string; color: string; to: string
}) {
  const colors: Record<string, { bg: string; text: string; icon: string; hover: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', icon: 'text-blue-500', hover: 'hover:bg-blue-100' },
    green: { bg: 'bg-green-50', text: 'text-green-700', icon: 'text-green-500', hover: 'hover:bg-green-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'text-purple-500', hover: 'hover:bg-purple-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500', hover: 'hover:bg-amber-100' },
  }
  const c = colors[color]
  return (
    <Link to={to}
      className={`${c.bg} ${c.hover} rounded-xl p-4 border border-gray-100 block transition-colors cursor-pointer`}>
      <Icon className={`w-5 h-5 mb-1 ${c.icon}`} />
      <div className={`text-xl font-bold ${c.text}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      <div className="text-xs text-gray-400">{sub}</div>
    </Link>
  )
}
