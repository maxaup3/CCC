/**
 * useKeyboardShortcuts Hook
 * 处理全局键盘快捷键，包括撤销/重做、删除等
 */

import { useEffect, useCallback } from 'react'
import { Editor, TLShapeId } from 'tldraw'

export interface KeyboardShortcutsOptions {
  editor: Editor | null
  onUndo?: () => void
  onRedo?: () => void
  onDelete?: () => void
  onDuplicate?: () => void
  enabled?: boolean
}

export function useKeyboardShortcuts({
  editor,
  onUndo,
  onRedo,
  onDelete,
  onDuplicate,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled || !editor) return

    // 检测是否在输入框中（避免快捷键干扰输入）
    const isInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)
    if (isInput) return

    const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
    const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey

    // Ctrl/Cmd + Z: 撤销
    if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey) {
      e.preventDefault()
      onUndo?.()
      editor.undo()
    }

    // Ctrl/Cmd + Shift + Z: 重做
    if (isCtrlOrCmd && e.key === 'z' && e.shiftKey) {
      e.preventDefault()
      onRedo?.()
      editor.redo()
    }

    // Ctrl/Cmd + Y: 重做（备选快捷键）
    if (isCtrlOrCmd && e.key === 'y') {
      e.preventDefault()
      onRedo?.()
      editor.redo()
    }

    // Delete 或 Backspace: 删除选中的形状
    if ((e.key === 'Delete' || e.key === 'Backspace') && !isInput) {
      e.preventDefault()
      const selectedIds = editor.getSelectedShapeIds()
      if (selectedIds.length > 0) {
        editor.deleteShapes(selectedIds)
        onDelete?.()
      }
    }

    // Ctrl/Cmd + D: 复制（仅当有选中内容时）
    if (isCtrlOrCmd && e.key === 'd') {
      e.preventDefault()
      const selectedIds = editor.getSelectedShapeIds()
      if (selectedIds.length > 0) {
        // 获取选中的形状
        const selectedShapes = selectedIds.map(id => editor.getShape(id as TLShapeId)).filter(Boolean)
        if (selectedShapes.length > 0) {
          // 复制选中的形状
          editor.duplicateShapes(selectedIds)
          onDuplicate?.()
        }
      }
    }
  }, [editor, enabled, onUndo, onRedo, onDelete, onDuplicate])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * 获取快捷键列表（用于帮助/教程显示）
 */
export function getKeyboardShortcutsList() {
  const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
  const ctrl = isMac ? '⌘' : 'Ctrl'

  return [
    { key: `${ctrl}+Z`, description: '撤销' },
    { key: `${ctrl}+Shift+Z`, description: '重做' },
    { key: `${ctrl}+Y`, description: '重做（备选）' },
    { key: 'Delete / Backspace', description: '删除选中的项' },
    { key: `${ctrl}+D`, description: '复制选中的项' },
    { key: `${ctrl}++`, description: '放大' },
    { key: `${ctrl}+−`, description: '缩小' },
  ]
}
