/**
 * Claude Code CLI 中继服务
 * 零依赖 Node 原生 http 服务，端口 3001
 * POST /api/chat  — 接收 { message } → spawn claude CLI → SSE 流式返回
 * GET  /api/health — 健康检查
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'

const PORT = 3001
const CLAUDE_BIN = '/opt/homebrew/bin/claude'

// 读取 canvas system prompt
const __dirname = dirname(fileURLToPath(import.meta.url))
const SYSTEM_PROMPT = readFileSync(join(__dirname, 'canvas-system-prompt.md'), 'utf-8')

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const server = createServer((req, res) => {
  setCors(res)

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }

  // Chat endpoint
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let message, canvasContext, files, spatialTools
      try {
        const parsed = JSON.parse(body)
        message = parsed.message
        canvasContext = parsed.canvasContext || ''
        // 向后兼容：优先用 files，fallback 到 images
        files = parsed.files || parsed.images || [] // Array of { name, dataUrl, fileType? }
        spatialTools = parsed.spatialTools || false
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      if (!message) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing message field' }))
        return
      }

      // 将 base64 文件写入临时目录，供 Claude Read 工具读取
      const tmpFileDir = join(tmpdir(), 'canvas-agent-files')
      const tmpFiles = []
      let fileContext = ''

      if (files.length > 0) {
        try { mkdirSync(tmpFileDir, { recursive: true }) } catch { /* exists */ }

        for (const f of files) {
          // 从 data URL 提取 MIME type 和 base64 数据
          const match = f.dataUrl.match(/^data:([^;]+);base64,(.+)$/)
          if (!match) continue

          const mimeType = match[1]
          const base64Data = match[2]

          // 根据 MIME type 决定文件扩展名
          let ext = 'bin'
          if (mimeType === 'text/markdown') ext = 'md'
          else if (mimeType === 'application/pdf') ext = 'pdf'
          else if (mimeType === 'image/jpeg') ext = 'jpg'
          else if (mimeType === 'image/png') ext = 'png'
          else if (mimeType === 'image/gif') ext = 'gif'
          else if (mimeType === 'image/webp') ext = 'webp'
          else if (mimeType === 'image/svg+xml') ext = 'svg'
          else if (mimeType.startsWith('image/')) ext = mimeType.split('/')[1]

          const fileName = `canvas-${Date.now()}-${tmpFiles.length}.${ext}`
          const filePath = join(tmpFileDir, fileName)

          writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
          tmpFiles.push(filePath)

          const label = f.name || `文件 ${tmpFiles.length}`
          const isDoc = ext === 'md' || ext === 'pdf'
          const typeLabel = isDoc ? '文档' : '图片'
          fileContext += `\n画布上的${typeLabel}「${label}」: ${filePath}`
        }

        console.log(`[chat] wrote ${tmpFiles.length} temp files`)
      }

      // 根据 spatialTools 开关决定是否包含空间工具段
      let systemPrompt = SYSTEM_PROMPT
      if (!spatialTools) {
        systemPrompt = systemPrompt.replace(
          /<!-- SPATIAL_TOOLS_START -->[\s\S]*?<!-- SPATIAL_TOOLS_END -->/,
          ''
        )
      }

      // 组装完整 prompt：system prompt + 画布上下文 + 文件引用 + 用户消息
      let fullPrompt = systemPrompt + '\n\n---\n\n'
      if (canvasContext) {
        fullPrompt += canvasContext + '\n\n'
      }
      if (fileContext) {
        fullPrompt += `[画布上的文件]${fileContext}\n\n请使用 Read 工具读取上面的文件来查看内容。\n\n`
      }
      fullPrompt += '---\n\n'
      fullPrompt += `用户的请求：${message}`

      const hasFiles = tmpFiles.length > 0
      console.log(`[chat] prompt length: ${fullPrompt.length} chars (context: ${canvasContext ? 'yes' : 'no'}, files: ${tmpFiles.length})`)

      // SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      // 如果有文件（图片/文档），需要允许 Read 工具来读取文件
      const cliArgs = [
        '-p', fullPrompt,
        '--output-format', 'stream-json',
        '--verbose',
        '--dangerously-skip-permissions',
      ]
      if (hasFiles) {
        cliArgs.push('--allowedTools', 'Read')
      }

      const child = spawn(CLAUDE_BIN, cliArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
      })

      console.log(`[chat] spawned claude pid=${child.pid}`)

      let buffer = ''
      let gotData = false

      child.stdout.on('data', (data) => {
        gotData = true
        buffer += data.toString()
        const lines = buffer.split('\n')
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          res.write(`data: ${trimmed}\n\n`)
        }
      })

      child.stderr.on('data', (data) => {
        console.log(`[chat] stderr: ${data.toString().slice(0, 200)}`)
      })

      child.on('close', (code, signal) => {
        console.log(`[chat] close code=${code} signal=${signal} gotData=${gotData}`)
        responseDone = true
        // Flush remaining buffer
        if (buffer.trim()) {
          res.write(`data: ${buffer.trim()}\n\n`)
        }
        res.write(`data: {"type":"done"}\n\n`)
        res.end()

        // 清理临时文件
        for (const f of tmpFiles) {
          try { unlinkSync(f) } catch { /* already removed */ }
        }
        if (tmpFiles.length > 0) {
          console.log(`[chat] cleaned up ${tmpFiles.length} temp files`)
        }
      })

      child.on('error', (err) => {
        console.log(`[chat] error: ${err.message}`)
        res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`)
        res.end()
      })

      // Kill child process group if client disconnects early
      let responseDone = false
      res.on('close', () => {
        if (!responseDone && !child.killed) {
          console.log(`[chat] client disconnected, killing child`)
          try { process.kill(-child.pid, 'SIGTERM') } catch { /* already exited */ }
        }
      })

      // Unref so the server doesn't wait for detached children to exit
      child.unref()
    })
    return
  }

  // Brainstorm endpoint — 短调用，返回 JSON
  if (req.method === 'POST' && req.url === '/api/brainstorm') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let message, canvasContext, systemPrompt
      try {
        const parsed = JSON.parse(body)
        message = parsed.message
        canvasContext = parsed.canvasContext || ''
        systemPrompt = parsed.systemPrompt || ''
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      let fullPrompt = systemPrompt
      if (canvasContext) fullPrompt += '\n\n' + canvasContext
      fullPrompt += '\n\n用户的请求：' + message

      console.log(`[brainstorm] prompt length: ${fullPrompt.length}`)

      const child = spawn(CLAUDE_BIN, [
        '-p', fullPrompt,
        '--output-format', 'json',
        '--max-turns', '1',
        '--dangerously-skip-permissions',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      child.stdout.on('data', (data) => { stdout += data.toString() })
      child.stderr.on('data', (data) => {
        console.log(`[brainstorm] stderr: ${data.toString().slice(0, 200)}`)
      })

      child.on('close', (code) => {
        console.log(`[brainstorm] close code=${code}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          const parsed = JSON.parse(stdout)
          const text = parsed.result || ''
          res.end(JSON.stringify({ text }))
        } catch {
          res.end(JSON.stringify({ text: stdout }))
        }
      })

      child.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      })
    })
    return
  }

  // Suggest next step endpoint — 短调用，返回 JSON
  if (req.method === 'POST' && req.url === '/api/suggest') {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => {
      let completedTask, canvasContext, systemPrompt
      try {
        const parsed = JSON.parse(body)
        completedTask = parsed.completedTask
        canvasContext = parsed.canvasContext || ''
        systemPrompt = parsed.systemPrompt || ''
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid JSON' }))
        return
      }

      let fullPrompt = systemPrompt
      if (canvasContext) fullPrompt += '\n\n' + canvasContext
      fullPrompt += '\n\n刚完成的任务：' + completedTask

      console.log(`[suggest] prompt length: ${fullPrompt.length}`)

      const child = spawn(CLAUDE_BIN, [
        '-p', fullPrompt,
        '--output-format', 'json',
        '--max-turns', '1',
        '--dangerously-skip-permissions',
      ], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      child.stdout.on('data', (data) => { stdout += data.toString() })
      child.stderr.on('data', (data) => {
        console.log(`[suggest] stderr: ${data.toString().slice(0, 200)}`)
      })

      child.on('close', (code) => {
        console.log(`[suggest] close code=${code}`)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        try {
          const parsed = JSON.parse(stdout)
          const text = parsed.result || ''
          res.end(JSON.stringify({ text }))
        } catch {
          res.end(JSON.stringify({ text: stdout }))
        }
      })

      child.on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      })
    })
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`Claude relay server running on http://localhost:${PORT}`)
  console.log(`  POST /api/chat   — send { message } to Claude CLI`)
  console.log(`  GET  /api/health — health check`)
})
