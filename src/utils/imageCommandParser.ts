/**
 * 图片生成命令解析器
 * 解析 /img、/draw、/画 等指令及其参数
 */

export interface ParsedImageCommand {
  isImageCommand: boolean
  prompt: string
  modelId?: string
  aspectRatio?: string
  imageSize?: string
  count?: number
}

// 触发前缀
const IMAGE_PREFIXES = ['/img', '/draw', '/画']

// 模型别名映射
const MODEL_ALIASES: Record<string, string> = {
  'nano': 'gemini-2.5-flash-image',
  'nanopro': 'gemini-3-pro-image-preview',
  'seedream4.5': 'doubao-seedream-4-5-251128',
  'seedream4.0': 'doubao-seedream-4-0-250828',
}

// 合法的宽高比
const VALID_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3']

// 合法的尺寸
const VALID_SIZES = ['1K', '2K', '4K']

/**
 * 检查消息是否以生图指令开头
 */
export function isImageCommand(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  return IMAGE_PREFIXES.some(prefix => trimmed.startsWith(prefix.toLowerCase()))
}

// 自然语言生图意图关键词（中文 + 英文）
const IMAGE_INTENT_PATTERNS = [
  // 中文带尾名词："生一张星空的图"、"画一张日落图片"
  /(?:帮我|给我|请|来)?(?:生成?|画|绘制|创作|做|搞|来)(?:一[张幅个]|[几\d]+[张幅个])?(?:.*?)(?:图|图片|图像|画|插画|照片|壁纸|头像|海报)/,
  // 中文带量词无尾名词："画一张星空"、"帮我生一张猫咪"、"来一张日落"
  /(?:帮我|给我|请|来)?(?:生成?|画|绘制|创作|做|搞|来)(?:一[张幅个]|[几\d]+[张幅个]).+/,
  // 中文简短："生图"、"画图"、"生成图片"
  /^(?:帮我|给我|请)?(?:生成?|画|绘制)(?:图|图片|图像|画)$/,
  // 英文：generate/create/draw/make + image/picture/photo
  /(?:generate|create|draw|make|produce|design)\s+(?:an?\s+)?(?:image|picture|photo|illustration|poster|wallpaper|artwork)/i,
]

// 图片编辑意图关键词（用于图生图场景，需要配合截图使用）
const IMAGE_EDIT_PATTERNS = [
  // "把 X 改成 Y"、"将 X 换成 Y"
  /(?:帮我|请)?(?:把|将|让).+(?:改成|换成|变成|替换成|改为|换为|变为)/,
  // "改成 X"、"换成 X"
  /(?:帮我|请)?(?:改成|换成|变成|替换成|修改为|修改成)/,
  // "修改一下"、"编辑"、"调整"
  /(?:帮我|请)?(?:修改|编辑|调整|改一下|换一下|变一下)/,
  // 英文
  /(?:change|replace|modify|edit|turn|transform|convert)\s+.+\s+(?:to|into|with)/i,
  /(?:make\s+it|change\s+it\s+to)/i,
]

/**
 * 检测是否为图片编辑意图（图生图场景）
 * 当用户有截图并且说"把猫改成狗"等修改指令时返回 true
 */
export function detectImageEditIntent(message: string): { isEdit: boolean; prompt: string } {
  const trimmed = message.trim()
  for (const pattern of IMAGE_EDIT_PATTERNS) {
    if (pattern.test(trimmed)) {
      // 对于编辑指令，整个消息就是 prompt（告诉模型要做什么修改）
      return { isEdit: true, prompt: trimmed }
    }
  }
  return { isEdit: false, prompt: '' }
}

/**
 * 意图检测结果
 */
export interface IntentDetectionResult {
  isImage: boolean
  prompt: string
  confidence: 'high' | 'medium' | 'low'  // 置信度
  ambiguousType?: 'plan' | 'document' | 'general'  // 模糊时可能的其他意图
}

// 高置信度的生图关键词（明确表示要生成图片）
const HIGH_CONFIDENCE_IMAGE_WORDS = [
  '图', '图片', '图像', '画', '插画', '照片', '壁纸', '头像', '海报',
  'image', 'picture', 'photo', 'illustration', 'artwork', 'poster', 'wallpaper',
]

// 可能是非图片生成的关键词（计划、文档等）
const NON_IMAGE_INDICATORS = [
  // 计划类
  '计划', '计画', '规划', '方案', '策略', '安排', 'plan', 'schedule', 'strategy',
  // 文档类
  '文档', '文件', '报告', '总结', '分析', 'document', 'report', 'summary', 'analysis',
  // 代码类
  '代码', '程序', '函数', '脚本', 'code', 'function', 'script', 'program',
  // 列表类
  '列表', '清单', '大纲', 'list', 'outline', 'checklist',
  // 表格类
  '表格', '表单', 'table', 'form', 'spreadsheet',
  // PPT类
  'ppt', '幻灯片', '演示', 'slides', 'presentation',
]

/**
 * 检测自然语言是否含有生图意图
 * 返回提取的 prompt、置信度、以及可能的模糊意图
 */
export function detectImageIntent(message: string): IntentDetectionResult {
  const trimmed = message.trim()
  const lowerTrimmed = trimmed.toLowerCase()

  // 首先检查是否包含非图片生成的关键词
  const hasNonImageIndicator = NON_IMAGE_INDICATORS.some(word =>
    lowerTrimmed.includes(word.toLowerCase())
  )

  // 检查是否包含明确的图片关键词
  const hasHighConfidenceImageWord = HIGH_CONFIDENCE_IMAGE_WORDS.some(word =>
    lowerTrimmed.includes(word.toLowerCase())
  )

  for (const pattern of IMAGE_INTENT_PATTERNS) {
    if (pattern.test(trimmed)) {
      // 提取描述部分：去掉动词前缀，保留核心描述
      let prompt = trimmed
        // 去掉中文前缀（"帮我生一张"、"画一张"、"来一个"等）
        .replace(/^(?:帮我|给我|请你?|来)?(?:生成?|画|绘制|创作|做|搞|来)(?:一[张幅个]|[几\d]+[张幅个])?/, '')
        // 去掉英文前缀
        .replace(/^(?:generate|create|draw|make|produce|design)\s+(?:an?\s+)?(?:image|picture|photo|illustration|poster|wallpaper|artwork)\s*(?:of|about|with|showing)?\s*/i, '')
        .trim()
      // 去掉中间的"有/关于"（"帮我生一张有星空的图" → "星空"）
      prompt = prompt.replace(/^(?:有|关于|包含)/, '').trim()
      // 去掉尾部的"的图/图片/画/照片"
      prompt = prompt.replace(/[的]?(?:图片?|图像|画|插画|照片|壁纸|头像|海报)$/, '').trim()
      // 如果清理后为空，用原始文本
      if (!prompt) prompt = trimmed

      // 判断置信度
      let confidence: 'high' | 'medium' | 'low'
      let ambiguousType: 'plan' | 'document' | 'general' | undefined

      if (hasNonImageIndicator && !hasHighConfidenceImageWord) {
        // 有非图片关键词，没有明确图片关键词 → 低置信度
        confidence = 'low'
        // 判断可能的意图类型
        if (/计划|计画|规划|方案|安排|plan|schedule/i.test(lowerTrimmed)) {
          ambiguousType = 'plan'
        } else if (/文档|报告|总结|分析|document|report/i.test(lowerTrimmed)) {
          ambiguousType = 'document'
        } else {
          ambiguousType = 'general'
        }
      } else if (hasHighConfidenceImageWord) {
        // 有明确图片关键词 → 高置信度
        confidence = 'high'
      } else {
        // 匹配了模式但没有明确关键词 → 中等置信度
        confidence = 'medium'
      }

      return { isImage: true, prompt, confidence, ambiguousType }
    }
  }
  return { isImage: false, prompt: '', confidence: 'low' }
}

/**
 * 简化版：只返回 boolean 和 prompt（向后兼容）
 */
export function detectImageIntentSimple(message: string): { isImage: boolean; prompt: string } {
  const result = detectImageIntent(message)
  // 只有高置信度才返回 isImage: true
  return {
    isImage: result.isImage && result.confidence === 'high',
    prompt: result.prompt,
  }
}

/**
 * 解析生图命令
 *
 * 格式：
 * /img [--model nano|nanopro|seedream4.5|seedream4.0] [--ratio 1:1|16:9|9:16|4:3] [--size 1K|2K|4K] [--count 1-4] <prompt>
 */
export function parseImageCommand(message: string): ParsedImageCommand {
  const trimmed = message.trim()

  // 检查是否匹配任一前缀
  let matchedPrefix = ''
  for (const prefix of IMAGE_PREFIXES) {
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      matchedPrefix = prefix
      break
    }
  }

  if (!matchedPrefix) {
    return { isImageCommand: false, prompt: '' }
  }

  // 去掉前缀后的剩余内容
  let rest = trimmed.slice(matchedPrefix.length).trim()

  let modelId: string | undefined
  let aspectRatio: string | undefined
  let imageSize: string | undefined
  let count: number | undefined

  // 解析 --key value 参数
  const parseArg = (flag: string): string | undefined => {
    const regex = new RegExp(`--${flag}\\s+(\\S+)`, 'i')
    const match = rest.match(regex)
    if (match) {
      rest = rest.replace(match[0], '').trim()
      return match[1]
    }
    return undefined
  }

  // 解析模型
  const modelArg = parseArg('model')
  if (modelArg) {
    const alias = modelArg.toLowerCase()
    modelId = MODEL_ALIASES[alias] || modelArg
  }

  // 解析宽高比
  const ratioArg = parseArg('ratio')
  if (ratioArg && VALID_RATIOS.includes(ratioArg)) {
    aspectRatio = ratioArg
  }

  // 解析尺寸
  const sizeArg = parseArg('size')
  if (sizeArg && VALID_SIZES.includes(sizeArg.toUpperCase())) {
    imageSize = sizeArg.toUpperCase()
  }

  // 解析数量
  const countArg = parseArg('count')
  if (countArg) {
    const n = parseInt(countArg, 10)
    if (n >= 1 && n <= 4) {
      count = n
    }
  }

  // 剩余部分就是 prompt
  const prompt = rest.trim()

  return {
    isImageCommand: true,
    prompt,
    modelId,
    aspectRatio,
    imageSize,
    count,
  }
}
