/**
 * OCR 识别服务
 * 
 * PDF → pdf.js 提取文字 → LLM 结构化
 * 图片 → 如果 AI 支持视觉就视觉识别，否则 Tesseract.js 本地 OCR
 */

import type { OcrResult } from './ai'

// ===== 视觉能力检测 =====

const VISION_MODELS: Record<string, string[]> = {
  deepseek: ['deepseek-vision', 'deepseek-chat-vision'],
  doubao: ['doubao-pro-32k', 'doubao-vision-pro-32k'],
  kimi: ['moonshot-v1-8k', 'moonshot-v1-vision-preview'],
  zhipu: ['glm-4-flash', 'glm-4v', 'glm-4v-plus'],
}

export function supportsVision(provider: string, model: string): boolean {
  const models = VISION_MODELS[provider]
  if (!models) return false
  return models.some(m => model.includes(m.replace(/^.*?\//, '')) || model.includes(m))
}

// ===== PDF 文字提取 =====

let pdfjsLib: any = null

async function getPdfJs() {
  if (!pdfjsLib) {
    // @ts-ignore
    pdfjsLib = await import('pdfjs-dist')
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString()
  }
  return pdfjsLib
}

export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer()
  const pdfjs = await getPdfJs()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  let text = ''
  for (let i = 1; i <= Math.min(pdf.numPages, 30); i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((item: any) => item.str).join(' ') + '\n'
  }
  return text.trim()
}

// ===== Tesseract 本地 OCR（图片 fallback） =====

let tesseract: any = null

async function getTesseract() {
  if (!tesseract) {
    const T = await import('tesseract.js')
    tesseract = T
  }
  return tesseract
}

export async function ocrImageLocally(file: File, onProgress?: (pct: number) => void): Promise<string> {
  const T = await getTesseract()
  const { data } = await T.recognize(file, 'chi_sim+eng', {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  return data.text
}

// ===== 通用文件识别入口 =====

export async function recognizeFile(
  file: File,
  aiConfig: { provider: string; model: string; apiKey: string; baseUrl?: string },
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<OcrResult> {
  const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf')
  const isImage = file.type.startsWith('image/')

  if (!isPdf && !isImage) {
    throw new Error('不支持的文件格式，请上传 PDF 或图片')
  }

  let rawText = ''

  if (isPdf) {
    onProgress?.('正在提取 PDF 文字...')
    rawText = await extractTextFromPdf(file)
    // 文本不足 → 可能是扫描件，尝试视觉 AI
    if (!rawText || rawText.length < 50) {
      const canVision = supportsVision(aiConfig.provider, aiConfig.model)
      if (canVision) {
        onProgress?.('PDF 为扫描件，正在转图片用 AI 视觉识别...')
        rawText = await visionFromPdf(file, aiConfig, signal)
      } else {
        throw new Error('此 PDF 为扫描件，无法提取文字。请尝试拍照上传或配置支持视觉识别的 AI 模型')
      }
    } else {
      onProgress?.('正在用 AI 解析条款...')
    }
  } else {
    // 图片 → 优先视觉 AI，否则本地 OCR
    const canVision = supportsVision(aiConfig.provider, aiConfig.model)
    if (canVision) {
      onProgress?.('正在用 AI 视觉识别保单...')
      rawText = await callVisionAI(file, aiConfig, signal)
    } else {
      onProgress?.('正在本地 OCR 识别（这可能需要 30-60 秒）...')
      rawText = await ocrImageLocally(file, (pct) => onProgress?.(`OCR 识别中 ${pct}%`))
    }
  }

  if (!rawText || rawText.length < 20) {
    throw new Error('未能识别出有效文字，请确保图片清晰、光线充足')
  }

  onProgress?.('正在用 AI 提取保单信息...')

  // 调用 LLM 结构化
  const { recognizePolicy } = await import('./ai')
  const result = await recognizePolicy(rawText, signal)
  return result
}

// ===== 视觉 AI 调用 =====

/**
 * PDF 扫描件：把前几页转为图片，用视觉 AI 识别
 */
async function visionFromPdf(
  file: File,
  config: { provider: string; model: string; apiKey: string; baseUrl?: string },
  signal?: AbortSignal
): Promise<string> {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist')
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await getDocument({ data: arrayBuffer }).promise
  const maxPages = Math.min(pdf.numPages, 8) // 最多前 8 页

  let combinedText = ''
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    // 先尝试提取文字
    const content = await page.getTextContent()
    const pageText = content.items.map((item: any) => item.str).join(' ').trim()
    if (pageText.length > 50) {
      combinedText += pageText + '\n'
      continue // 有文字就不走视觉
    }
    // 无文字 → 渲染为图片用视觉 AI
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/jpeg', 0.85))
    const imageFile = new File([blob], `page_${i}.jpg`, { type: 'image/jpeg' })
    const text = await callVisionAI(imageFile, config, signal)
    combinedText += text + '\n'
  }
  return combinedText
}

async function callVisionAI(
  file: File,
  config: { provider: string; model: string; apiKey: string; baseUrl?: string },
  signal?: AbortSignal
): Promise<string> {
  // 将文件转为 base64
  const base64 = await fileToBase64(file)

  // 构建消息 - 不同提供商格式不同，但都兼容 OpenAI 格式
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请详细描述这份保险合同的内容，包括保险公司、产品名称、险种、保费、保障项目、保额、赔付条件等所有条款信息。请尽可能全面。' },
        { type: 'image_url', image_url: { url: base64 } },
      ],
    },
  ]

  const url = config.baseUrl || 'https://api.deepseek.com/chat/completions'
  const model = config.model

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({ model, messages, max_tokens: 4096 }),
    signal,
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`视觉识别请求失败 (${res.status}): ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
