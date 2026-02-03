/**
 * useErrorRecovery Hook
 * 处理错误恢复、重试机制和错误日志
 */

import { useCallback, useRef } from 'react'

export interface ErrorRecoveryOptions {
  maxRetries?: number
  initialDelay?: number
  maxDelay?: number
  onError?: (error: Error, retryCount: number) => void
  onRetry?: (retryCount: number) => void
}

export interface ErrorWithRetry extends Error {
  retryCount?: number
  lastError?: Error
}

/**
 * 执行可重试的异步操作
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: ErrorRecoveryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    onError,
    onRetry,
  } = options

  let lastError: Error = new Error('Unknown error')
  let lastDelay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      lastError.name = `RetryableError[${attempt}/${maxRetries}]`

      if (attempt < maxRetries) {
        onRetry?.(attempt + 1)
        // 指数退避策略
        const delay = Math.min(lastDelay * Math.pow(2, attempt), maxDelay)
        // 添加随机抖动避免雷鸣羊群效应
        const jitter = delay * 0.1 * Math.random()
        await new Promise(resolve => setTimeout(resolve, delay + jitter))
      } else {
        onError?.(lastError, maxRetries)
      }
    }
  }

  throw lastError
}

/**
 * React Hook 用于管理错误和重试状态
 */
export function useErrorRecovery() {
  const retryCountRef = useRef<Map<string, number>>(new Map())
  const lastErrorsRef = useRef<Map<string, Error>>(new Map())

  const execute = useCallback(
    async <T,>(
      key: string,
      fn: () => Promise<T>,
      options: ErrorRecoveryOptions = {}
    ): Promise<T> => {
      try {
        const result = await executeWithRetry(fn, {
          ...options,
          onRetry: (count) => {
            retryCountRef.current.set(key, count)
            options.onRetry?.(count)
          },
          onError: (error, maxRetries) => {
            lastErrorsRef.current.set(key, error)
            options.onError?.(error, maxRetries)
          },
        })
        // 成功时清除计数器
        retryCountRef.current.delete(key)
        return result
      } catch (error) {
        throw error
      }
    },
    []
  )

  const getRetryCount = useCallback((key: string) => {
    return retryCountRef.current.get(key) || 0
  }, [])

  const getLastError = useCallback((key: string) => {
    return lastErrorsRef.current.get(key) || null
  }, [])

  const clearError = useCallback((key: string) => {
    retryCountRef.current.delete(key)
    lastErrorsRef.current.delete(key)
  }, [])

  return {
    execute,
    getRetryCount,
    getLastError,
    clearError,
  }
}

/**
 * 错误分类器 - 判断错误是否可重试
 */
export function isRetryableError(error: Error | unknown): boolean {
  if (!(error instanceof Error)) return false

  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /service unavailable/i,
    /503/i,
    /429/i, // Rate limit
  ]

  const errorMessage = error.message || error.toString()
  return retryablePatterns.some(pattern => pattern.test(errorMessage))
}

/**
 * 获取用户友好的错误信息
 */
export function getErrorMessage(error: Error | unknown): string {
  if (!(error instanceof Error)) {
    return '发生未知错误，请重试'
  }

  const message = error.message || error.toString()

  // 映射常见错误到用户友好的消息
  const errorMap: Record<string, string> = {
    timeout: '请求超时，请检查网络连接',
    network: '网络连接失败，请检查您的网络',
    ECONNREFUSED: '无法连接到服务器，请稍后重试',
    ECONNRESET: '连接已重置，请重试',
    ETIMEDOUT: '请求超时，请检查网络',
    'service unavailable': '服务暂时不可用，请稍后重试',
    '503': '服务暂时不可用',
    '429': '请求过于频繁，请稍候',
    'API': 'API 调用失败，请检查配置',
    'Invalid API key': 'API Key 无效，请重新配置',
  }

  for (const [pattern, friendlyMessage] of Object.entries(errorMap)) {
    if (message.includes(pattern)) {
      return friendlyMessage
    }
  }

  // 如果是自定义错误信息，直接返回
  if (message.length < 100 && !message.includes('at ')) {
    return message
  }

  // 默认消息
  return '操作失败，请重试'
}

/**
 * 日志错误（便于调试）
 */
export function logError(
  error: Error | unknown,
  context?: string,
  retryCount?: number
): void {
  const timestamp = new Date().toISOString()
  const contextStr = context ? ` [${context}]` : ''
  const retryStr = retryCount !== undefined ? ` [重试 ${retryCount}]` : ''

  console.error(
    `[${timestamp}]${contextStr}${retryStr}:`,
    error instanceof Error ? error.message : String(error)
  )

  // 在开发环境中记录完整堆栈
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    console.error('堆栈:', error.stack)
  }
}
