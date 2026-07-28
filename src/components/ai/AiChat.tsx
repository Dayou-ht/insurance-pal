import { useState, useRef, useEffect } from 'react'
import { askAboutPolicy } from '../../services/ai'
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react'

interface Props {
  policyInfo: string
  coverages: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTED_QUESTIONS = [
  '这份保单主要保什么？',
  '如果住院了能赔多少钱？',
  '哪些情况不赔？',
  '缴费过期了怎么办？',
]

const TERM_QUESTIONS = [
  '解释：复归红利和终期红利有什么区别？',
  '解释：保证现金价值是什么？',
  '解释：豁免保费是什么意思？',
  '解释：等待期和宽限期分别是什么？',
]

export default function AiChat({ policyInfo, coverages }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function ask(question: string) {
    if (!question.trim() || loading) return
    setStarted(true)
    setError('')
    setInput('')

    const userMsg: Message = { role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])

    setLoading(true)
    abortRef.current = new AbortController()

    try {
      const history = [...messages, userMsg]
      const answer = await askAboutPolicy(policyInfo, coverages, history, abortRef.current.signal)
      setMessages(prev => [...prev, { role: 'assistant', content: answer }])
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message || '请求失败，请检查 API Key 是否正确')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
        <Bot className="w-5 h-5 text-blue-600" />
        <span className="font-medium text-sm text-gray-700">AI 保单顾问</span>
        {!getAiConfig() && (
          <span className="text-xs text-amber-600 ml-auto">⚠️ 未配置 API Key</span>
        )}
      </div>

      {!started ? (
        /* 初始状态：快捷提问 */
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-500">问 AI 关于这份保单的问题：</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUESTIONS.map(q => (
              <button key={q} onClick={() => ask(q)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors">
                {q}
              </button>
            ))}
          </div>
          {/* 名词解释 */}
          <div>
            <p className="text-xs text-gray-400 mb-2">📖 保险名词解释</p>
            <div className="flex flex-wrap gap-2">
              {TERM_QUESTIONS.map(q => (
                <button key={q} onClick={() => ask(q)}
                  className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && ask(input)}
              placeholder="或输入你的问题..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button onClick={() => ask(input)}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* 对话模式 */
        <div className="flex flex-col h-96">
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === 'assistant' ? '' : 'flex-row-reverse'}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  m.role === 'assistant' ? 'bg-blue-100' : 'bg-gray-100'
                }`}>
                  {m.role === 'assistant' ? <Bot className="w-4 h-4 text-blue-600" /> : <User className="w-4 h-4 text-gray-600" />}
                </div>
                <div className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                  m.role === 'assistant' ? 'bg-gray-50 text-gray-700' : 'bg-blue-600 text-white'
                }`}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                </div>
                <div className="px-3 py-2 bg-gray-50 rounded-lg">
                  <span className="text-sm text-gray-400">思考中...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg text-sm text-red-600">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 输入框 */}
          <div className="p-3 border-t border-gray-100">
            <div className="flex gap-2">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && ask(input)}
                placeholder="输入你的问题..."
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              <button onClick={() => ask(input)} disabled={loading}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getAiConfig() {
  try {
    const raw = localStorage.getItem('insurance_pal_ai_config')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
