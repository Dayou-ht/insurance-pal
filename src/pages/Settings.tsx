import { useState } from 'react'
import { db } from '../db'
import { seedDemoData } from '../db/seed'
import { Download, Upload, Trash2, Shield, Globe, Bot } from 'lucide-react'
import { getAiConfig, saveAiConfig, clearAiConfig, type AiConfig } from '../services/ai'

const PROVIDER_DEFAULTS: Record<string, { model: string; baseUrl: string }> = {
  deepseek: { model: 'deepseek-chat', baseUrl: 'https://api.deepseek.com/chat/completions' },
  doubao: { model: 'doubao-pro-32k', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' },
  kimi: { model: 'moonshot-v1-8k', baseUrl: 'https://api.moonshot.cn/v1/chat/completions' },
  zhipu: { model: 'glm-4-flash', baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions' },
  custom: { model: '', baseUrl: '' },
}

export default function Settings() {
  const [importing, setImporting] = useState(false)
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => getAiConfig() || { provider: 'deepseek', apiKey: '', model: 'deepseek-chat' })
  const [aiSaved, setAiSaved] = useState(false)

  function handleSaveAi() {
    if (!aiConfig.apiKey) return alert('请输入 API Key')
    saveAiConfig(aiConfig)
    setAiSaved(true)
    setTimeout(() => setAiSaved(false), 2000)
  }

  async function handleExport() {
    const policies = await db.policies.toArray()
    const persons = await db.persons.toArray()
    const coverages = await db.coverages.toArray()
    const premiums = await db.premiums.toArray()
    const benefits = await db.benefits.toArray()
    const reminders = await db.reminders.toArray()

    const data = JSON.stringify({ policies, persons, coverages, premiums, benefits, reminders }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `保单备份_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!confirm('导入备份将覆盖当前所有数据（清空后替换为备份内容），确认继续？')) {
        setImporting(false)
        return
      }
      setImporting(true)
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        // 清空现有数据，避免 ID 冲突
        await db.policies.clear()
        await db.persons.clear()
        await db.coverages.clear()
        await db.premiums.clear()
        await db.benefits.clear()
        await db.reminders.clear()
        // 导入备份数据
        if (data.persons) await db.persons.bulkAdd(data.persons)
        if (data.policies) await db.policies.bulkAdd(data.policies)
        if (data.coverages) await db.coverages.bulkAdd(data.coverages)
        if (data.premiums) await db.premiums.bulkAdd(data.premiums)
        if (data.benefits) await db.benefits.bulkAdd(data.benefits)
        if (data.reminders) await db.reminders.bulkAdd(data.reminders)
        alert(`✅ 导入成功！\n📋 保单 ${data.policies?.length || 0} 份\n👨‍👩‍👧‍👦 成员 ${data.persons?.length || 0} 人\n🛡️ 保障权益 ${data.coverages?.length || 0} 项\n💰 缴费记录 ${data.premiums?.length || 0} 条\n🎁 分红记录 ${data.benefits?.length || 0} 条\n🔔 提醒 ${data.reminders?.length || 0} 条`)
      } catch (err) {
        alert('❌ 导入失败，请检查文件格式是否正确')
      }
      setImporting(false)
    }
    input.click()
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">设置</h1>

      {/* 数据管理 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4">数据管理</h3>
        <div className="space-y-3">
          <button onClick={handleExport}
            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-700">导出备份</div>
              <div className="text-xs text-gray-400">所有保单数据导出为 JSON 文件</div>
            </div>
          </button>

          <button onClick={handleImport} disabled={importing}
            className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <Upload className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-left">
              <div className="font-medium text-gray-700">导入数据</div>
              <div className="text-xs text-gray-400">{importing ? '导入中...' : '从备份文件恢复数据'}</div>
            </div>
          </button>
        </div>
      </div>

      {/* AI 配置 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
          <Bot className="w-4 h-4 text-blue-600" /> AI 智能服务
        </h3>
        <p className="text-xs text-gray-400 mb-4">API Key 仅存储在本地浏览器，不会上传到任何服务器</p>
        <div className="space-y-3">
          <div className="flex gap-2">
            <select value={aiConfig.provider} onChange={e => {
                const p = e.target.value
                const def = PROVIDER_DEFAULTS[p]
                setAiConfig({ ...aiConfig, provider: p as any, model: def?.model || '', baseUrl: def?.baseUrl || '' })
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-44">
              <option value="deepseek">DeepSeek ⭐ 推荐</option>
              <option value="doubao">豆包（火山引擎）⭐ 推荐</option>
              <option value="kimi">Kimi（月之暗面）⭐ 推荐</option>
              <option value="zhipu">智谱（GLM）⭐ 推荐</option>
              <option value="custom">其他模型（自定义）</option>
            </select>
            <input value={aiConfig.model} onChange={e => setAiConfig({...aiConfig, model: e.target.value})}
              placeholder={aiConfig.provider === 'deepseek' ? 'deepseek-chat' :
                aiConfig.provider === 'doubao' ? 'doubao-pro-32k' :
                aiConfig.provider === 'kimi' ? 'moonshot-v1-8k' :
                aiConfig.provider === 'zhipu' ? 'glm-4-flash' :
                '模型名'}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="flex gap-2">
            <input type="password" value={aiConfig.apiKey} onChange={e => setAiConfig({...aiConfig, apiKey: e.target.value})}
              placeholder={aiConfig.provider === 'deepseek' ? 'sk-输入 DeepSeek API Key...' :
                aiConfig.provider === 'doubao' ? '输入火山引擎 API Key...' :
                aiConfig.provider === 'kimi' ? '输入 Kimi API Key...' :
                aiConfig.provider === 'zhipu' ? '输入智谱 API Key...' :
                '输入 API Key...'}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono" />
            <button onClick={handleSaveAi}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 whitespace-nowrap">
              {aiSaved ? '✅ 已保存' : '保存'}
            </button>
          </div>
          {aiConfig.provider === 'custom' && (
            <input value={aiConfig.baseUrl || ''} onChange={e => setAiConfig({...aiConfig, baseUrl: e.target.value})}
              placeholder="Base URL（如 https://api.deepseek.com/chat/completions）"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          )}
          {getAiConfig() && (
            <button onClick={() => { clearAiConfig(); setAiConfig({ provider: 'deepseek', apiKey: '', model: 'deepseek-chat', baseUrl: '' }) }}
              className="text-xs text-red-500 hover:underline">清除已保存的 API Key</button>
          )}
        </div>
      </div>

      {/* 开发工具 */}
      <div className="bg-white rounded-xl p-5 border border-amber-100">
        <h3 className="font-semibold text-amber-700 mb-4">开发工具</h3>
        <button onClick={async () => {
          if (confirm('加载示例数据会清空现有所有数据，确认？')) {
            const result = await seedDemoData()
            alert(`✅ 示例数据加载完成！
📋 保单 ${result.policies} 份
🛡️ 保障权益 ${result.coverages} 项
💰 缴费记录 ${result.premiums} 条
👨‍👩‍👧‍👦 家庭成员 6 人
刷新页面即可查看效果`)
          }
        }}
          className="flex items-center gap-3 w-full p-3 rounded-lg hover:bg-amber-50 transition-colors">
          <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
            <Globe className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-left">
            <div className="font-medium text-amber-800">加载示例数据</div>
            <div className="text-xs text-amber-600">一键生成 6 口之家、28 份保单的演示数据</div>
          </div>
        </button>
      </div>

      {/* 隐私说明 */}
      <div className="bg-white rounded-xl p-5 border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4">隐私与安全</h3>
        <div className="flex items-start gap-4 p-3 bg-blue-50 rounded-lg">
          <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-blue-800">数据完全本地存储</p>
            <p className="text-sm text-blue-600 mt-1">
              你的保单数据全部存储在这个浏览器中，不上传任何服务器。
              数据备份文件请自行妥善保管，建议加密存储。
            </p>
          </div>
        </div>
      </div>

      {/* 危险操作 */}
      <div className="bg-white rounded-xl p-5 border border-red-100">
        <h3 className="font-semibold text-red-700 mb-4">危险操作</h3>
        <button onClick={async () => {
          if (confirm('确定要清空所有数据？此操作不可恢复！')) {
            if (confirm('再次确认：所有保单数据将被永久删除！')) {
              await db.policies.clear()
              await db.persons.clear()
              await db.coverages.clear()
              await db.premiums.clear()
              await db.benefits.clear()
              await db.reminders.clear()
              alert('数据已清空')
            }
          }
        }}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 transition-colors">
          <Trash2 className="w-4 h-4" />
          清空所有数据
        </button>
      </div>

      {/* 版本 */}
      <p className="text-center text-xs text-gray-400 py-4">
        保单管家 v1.0.0 · 数据 100% 本地存储
      </p>
    </div>
  )
}
