/**
 * AI 服务 — 浏览器端直接调用 LLM API
 * 
 * API Key 存储在 localStorage，不经过任何第三方服务器
 * 支持 DeepSeek / OpenAI / 兼容接口
 */

const API_CONFIG_KEY = 'insurance_pal_ai_config'

export type AiProvider = 'deepseek' | 'doubao' | 'kimi' | 'zhipu' | 'custom'

export interface AiConfig {
  provider: AiProvider
  apiKey: string
  baseUrl?: string
  model?: string
}

export function getAiConfig(): AiConfig | null {
  try {
    const raw = localStorage.getItem(API_CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function saveAiConfig(config: AiConfig) {
  localStorage.setItem(API_CONFIG_KEY, JSON.stringify(config))
}

export function clearAiConfig() {
  localStorage.removeItem(API_CONFIG_KEY)
}

function getEndpoint(config: AiConfig): { url: string; model: string } {
  switch (config.provider) {
    case 'deepseek':
      return {
        url: config.baseUrl || 'https://api.deepseek.com/chat/completions',
        model: config.model || 'deepseek-chat',
      }
    case 'doubao':
      return {
        url: config.baseUrl || 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        model: config.model || 'doubao-pro-32k',
      }
    case 'kimi':
      return {
        url: config.baseUrl || 'https://api.moonshot.cn/v1/chat/completions',
        model: config.model || 'moonshot-v1-8k',
      }
    case 'zhipu':
      return {
        url: config.baseUrl || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        model: config.model || 'glm-4-flash',
      }
    case 'custom':
      return {
        url: config.baseUrl || 'https://api.deepseek.com/chat/completions',
        model: config.model || 'deepseek-chat',
      }
  }
}

export async function callLLM(messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
  const config = getAiConfig()
  if (!config) throw new Error('请先在设置中配置 AI API Key')

  const { url, model } = getEndpoint(config)

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      max_tokens: 4096,
    }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '未知错误')
    throw new Error(`API 请求失败 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

// ============ OCR: 保单文本识别 ============

export interface OcrResult {
  productName?: string
  insurer?: string
  policyNumber?: string
  category?: string
  premium?: number
  paymentMethod?: string
  paymentPeriod?: number
  startDate?: string
  endDate?: string
  coverages: { name: string; amount: number; condition: string }[]
  note?: string
  /** AI 识别到的附加险列表 */
  riders?: { productName: string; category: string; premium: number }[]
}

export async function recognizePolicy(text: string, signal?: AbortSignal): Promise<OcrResult> {
  const prompt = `你是一个专业的保险条款解析助手。请从以下保险合同中提取关键信息，以 JSON 格式返回。

提取字段：
- productName: 产品名称
- insurer: 保险公司
- policyNumber: 保单号
- category: 险种（重疾险/医疗险/意外险/寿险/年金险/分红险/万能险/车险/家财险/其他）
- premium: 年缴保费（数字，不要单位）
- paymentMethod: 缴费方式（年缴/半年缴/季缴/月缴/趸交）
- paymentPeriod: 缴费年限（**单位是年**，数字。例如月缴12期=1年，半年缴2年=2，趸交=0）
- startDate: 起保日期（YYYY-MM-DD格式）
- endDate: 到期日期（YYYY-MM-DD格式，终身则为"终身"）
- coverages: 保障权益列表，每个元素包含 { name: 保障项目名称, amount: 保额(数字), condition: 赔付条件说明 }
- note: 其他重要信息
- riders: 附加险列表（**如果没有附加险则设为空数组 []**），每个元素包含 { productName: 产品名称, category: 险种, premium: 保费(数字) }

注意：
- paymentPeriod 的单位是**年**不是月。如果合同写"缴费12期（月缴）"，则 paymentPeriod = 1（年）
- 如果合同有**附加险/附加条款**，请用 riders 字段列出，不要混入 coverages
- 认真识别缴费方式（年缴/半年缴/季缴/月缴/趸交）

保险合同内容：
${text.slice(0, 15000)}

请只返回 JSON，不要其他文字。如果某个字段无法确定，设为 null。`

  const result = await callLLM([
    { role: 'system', content: '你是一个保险条款分析专家。只输出 JSON，不要额外说明。' },
    { role: 'user', content: prompt },
  ], signal)

  try {
    // 尝试从返回中提取 JSON
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    let parsed: any
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0])
    } else {
      parsed = JSON.parse(result)
    }
    // 确保数值字段为 number 类型（AI 可能返回字符串）
    if (parsed.premium != null) parsed.premium = Number(parsed.premium)
    if (parsed.paymentPeriod != null) parsed.paymentPeriod = Number(parsed.paymentPeriod)
    if (parsed.coverages) {
      parsed.coverages = parsed.coverages.map((c: any) => ({
        ...c,
        amount: c.amount != null ? Number(c.amount) : 0,
      }))
    }
    return parsed
  } catch {
    throw new Error('AI 识别失败，无法解析返回结果')
  }
}

// ============ AI 问答: 保单条款解读 ============

export async function askAboutPolicy(
  policyInfo: string,
  coverages: string,
  messages: { role: string; content: string }[],
  signal?: AbortSignal
): Promise<string> {
  const systemMsg = {
    role: 'system',
    content: `你是一个专业的保险顾问，帮助用户理解他们的保单条款。

你的回答原则：
1. 优先根据保单的实际条款（保障权益）回答
2. 如果用户没有录入具体的保障权益，你可以根据保单名称和保司，利用你自己的保险产品知识库提供该类产品的**通用保障范围**作为参考
3. 但必须明确区分"已录入的条款"和"通用产品知识"——如果是根据产品名称推测的，要说明"根据该产品的常见保障范围"
4. 不要编造具体的保额或赔付条件——如果不知道就诚实说不知道
5. 用通俗易懂的语言解释专业术语
6. 如果信息不足以回答，坦诚说明，不要猜测
7. 回答要客观，不推销、不贬低任何保险产品
8. 这是一个连续对话，你记得之前聊过的内容，可以在此基础上继续深入`,
  }
  const contextMsg = {
    role: 'user',
    content: `保单基本信息：
${policyInfo}

已录入的保障权益：
${coverages}

（以上是保单信息，下面开始正式对话）`,
  }
  return callLLM([systemMsg, contextMsg, ...messages], signal)
}

// ============ 保障分析: 个人/家庭 ============

export interface AnalysisResult {
  summary: string
  strengths: string[]
  gaps: string[]
  overlaps: string[]
  suggestions: string[]
}

export async function analyzeInsurance(
  scope: '个人' | '家庭',
  memberName: string,
  policiesData: string,
  signal?: AbortSignal
): Promise<AnalysisResult> {
  const prompt = `你是一个专业的独立保险顾问，不隶属于任何保险公司。请对以下${scope}的保单配置进行全面分析。

分析维度：
1. summary: 总体评价（一段话概括）
2. strengths: 配置合理的地方（3-5条）
3. gaps: 保障缺口（3-5条，如某项风险没有覆盖、保额不足等）
4. overlaps: 保障重叠或冗余（如果有）
5. suggestions: 具体的优化建议（3-5条，分优先级）

${scope === '个人' ? `分析对象：${memberName}` : '分析范围：整个家庭'}

保单数据：
${policiesData}

请只返回以下 JSON 格式：
{
  "summary": "...",
  "strengths": ["...", "..."],
  "gaps": ["...", "..."],
  "overlaps": ["...", "..."],
  "suggestions": ["...", "..."]
}`

  const result = await callLLM([
    { role: 'system', content: '你是一个严谨的独立保险顾问。只输出 JSON，不要额外说明。' },
    { role: 'user', content: prompt },
  ], signal)

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) return JSON.parse(jsonMatch[0])
    return JSON.parse(result)
  } catch {
    throw new Error('AI 分析失败，无法解析返回结果')
  }
}
