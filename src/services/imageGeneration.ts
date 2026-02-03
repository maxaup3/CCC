/**
 * AI 图片生成服务
 * 移植自 PopArt，支持 Gemini 和 Seedream 模型
 * API: ai-nebula.com
 */
import { getNebulaApiKey } from '../components/ApiKeyDialog'

// API 基础地址
const API_BASE_URL = 'https://llm.ai-nebula.com/v1'

// 模型提供商类型
export type ModelProvider = 'gemini' | 'seedream'

// Gemini 图片尺寸
export type GeminiImageSize = '1K' | '2K' | '4K'

// Gemini 宽高比选项
export const GEMINI_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
] as const

// Gemini 尺寸选项（质量）
export const GEMINI_IMAGE_SIZES = [
  { value: '1K', label: '标清 1K' },
  { value: '2K', label: '高清 2K' },
  { value: '4K', label: '超清 4K' },
] as const

// Seedream 2K 分辨率选项
export const SEEDREAM_SIZES_2K = [
  { value: '2048x2048', label: '1:1', description: '2048×2048' },
  { value: '2560x1440', label: '16:9', description: '2560×1440' },
  { value: '1440x2560', label: '9:16', description: '1440×2560' },
  { value: '2304x1728', label: '4:3', description: '2304×1728' },
  { value: '1728x2304', label: '3:4', description: '1728×2304' },
  { value: '2496x1664', label: '3:2', description: '2496×1664' },
  { value: '1664x2496', label: '2:3', description: '1664×2496' },
] as const

// Seedream 4K 分辨率选项
export const SEEDREAM_SIZES_4K = [
  { value: '4096x4096', label: '1:1', description: '4096×4096' },
  { value: '5504x3040', label: '16:9', description: '5504×3040' },
  { value: '3040x5504', label: '9:16', description: '3040×5504' },
  { value: '4704x3520', label: '4:3', description: '4704×3520' },
  { value: '3520x4704', label: '3:4', description: '3520×4704' },
  { value: '4992x3328', label: '3:2', description: '4992×3328' },
  { value: '3328x4992', label: '2:3', description: '3328×4992' },
] as const

// 模型定义
export interface ImageModel {
  id: string
  name: string
  description: string
  provider: ModelProvider
}

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'gemini-2.5-flash-image',
    name: 'Nano Banana',
    description: '默认推荐，速度快',
    provider: 'gemini',
  },
  {
    id: 'gemini-3-pro-image-preview',
    name: 'Nano Banana Pro',
    description: '更高质量输出',
    provider: 'gemini',
  },
  {
    id: 'doubao-seedream-4-5-251128',
    name: 'Seedream 4.5',
    description: '画质最佳',
    provider: 'seedream',
  },
  {
    id: 'doubao-seedream-4-0-250828',
    name: 'Seedream 4.0',
    description: '稳定版，多图融合',
    provider: 'seedream',
  },
]

export const DEFAULT_MODEL = IMAGE_MODELS[0]
export const DEFAULT_GEMINI_ASPECT_RATIO = '1:1'
export const DEFAULT_GEMINI_IMAGE_SIZE: GeminiImageSize = '2K'
export const DEFAULT_SEEDREAM_SIZE = '2048x2048'

// 生成参数
export interface GenerateImageParams {
  prompt: string
  negativePrompt?: string
  modelId?: string
  referenceImages?: string[]
  aspectRatio?: string
  imageSize?: GeminiImageSize
  size?: string // Seedream 尺寸，如 '2048x2048'
}

// 生成结果
export interface GeneratedImage {
  base64: string
  mimeType: string
}

// API 响应格式
interface ApiResponse {
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
  created: number
}

/**
 * 构建 Gemini 请求体
 */
const buildGeminiRequest = (
  model: ImageModel,
  prompt: string,
  options: {
    aspectRatio?: string
    imageSize?: GeminiImageSize
    referenceImages?: string[]
  }
): Record<string, unknown> => {
  const requestBody: Record<string, unknown> = {
    model: model.id,
    size: options.aspectRatio || DEFAULT_GEMINI_ASPECT_RATIO,
    quality: 'high',
    image_size: options.imageSize || DEFAULT_GEMINI_IMAGE_SIZE,
    response_format: 'b64_json',
  }

  if (options.referenceImages && options.referenceImages.length > 0) {
    requestBody.contents = [
      {
        role: 'user',
        parts: [
          { text: prompt },
          ...options.referenceImages.map((img) => ({ image: img })),
        ],
      },
    ]
  } else {
    requestBody.prompt = prompt
  }

  return requestBody
}

/**
 * 构建 Seedream 请求体
 */
const buildSeedreamRequest = (
  model: ImageModel,
  prompt: string,
  options: {
    size?: string
    referenceImages?: string[]
  }
): Record<string, unknown> => {
  const requestBody: Record<string, unknown> = {
    model: model.id,
    size: options.size || DEFAULT_SEEDREAM_SIZE,
    watermark: false,
    optimize_prompt_options: {
      mode: 'standard',
    },
  }

  if (options.referenceImages && options.referenceImages.length > 0) {
    requestBody.contents = [
      {
        role: 'user',
        parts: [
          ...options.referenceImages.map((img) => ({ image: img })),
          { text: prompt },
        ],
      },
    ]
  } else {
    requestBody.prompt = prompt
  }

  return requestBody
}

/**
 * 从 URL 下载图片并转为 base64
 */
const downloadImageAsBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`图片下载失败: ${response.status}`)
  }
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * 根据宽高比获取 Seedream 的 size 参数
 */
export function getSeedreamSizeFromAspectRatio(aspectRatio: string, quality: string = '2K'): string {
  const sizes = quality === '4K' ? SEEDREAM_SIZES_4K : SEEDREAM_SIZES_2K
  const match = sizes.find(s => s.label === aspectRatio)
  return match ? match.value : DEFAULT_SEEDREAM_SIZE
}

/**
 * 调用 AI API 生成图片
 */
export const generateImage = async (params: GenerateImageParams): Promise<GeneratedImage> => {
  const apiKey = getNebulaApiKey()
  if (!apiKey) {
    throw new Error('生图 API Key 未配置')
  }

  const modelId = params.modelId || DEFAULT_MODEL.id
  const model = IMAGE_MODELS.find((m) => m.id === modelId) || DEFAULT_MODEL

  let fullPrompt = params.prompt
  if (params.negativePrompt) {
    fullPrompt += `\n\nNegative prompt: ${params.negativePrompt}`
  }

  const requestBody =
    model.provider === 'gemini'
      ? buildGeminiRequest(model, fullPrompt, {
          aspectRatio: params.aspectRatio,
          imageSize: params.imageSize,
          referenceImages: params.referenceImages,
        })
      : buildSeedreamRequest(model, fullPrompt, {
          size: params.size || getSeedreamSizeFromAspectRatio(params.aspectRatio || '1:1'),
          referenceImages: params.referenceImages,
        })

  const response = await fetch(`${API_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 请求失败: ${response.status} - ${errorText}`)
  }

  const result: ApiResponse = await response.json()

  const imageData = result.data?.[0]
  if (!imageData) {
    throw new Error('响应中没有图片数据')
  }

  let base64 = imageData.b64_json
  if (!base64 && imageData.url) {
    base64 = await downloadImageAsBase64(imageData.url)
  }

  if (!base64) {
    throw new Error('响应中没有图片数据 (b64_json 或 url)')
  }

  return {
    base64,
    mimeType: 'image/png',
  }
}

/**
 * base64 转 data URL
 */
export const base64ToDataUrl = (base64: string, mimeType: string): string => {
  return `data:${mimeType};base64,${base64}`
}

/**
 * base64 转 Blob URL（避免大 data URL 占用内存）
 */
export const base64ToBlobUrl = (base64: string, mimeType: string): string => {
  const byteString = atob(base64)
  const ab = new ArrayBuffer(byteString.length)
  const ia = new Uint8Array(ab)
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i)
  }
  const blob = new Blob([ab], { type: mimeType })
  return URL.createObjectURL(blob)
}
