/**
 * useCanvasPersistence Hook
 * Automatically saves canvas state on changes with debounce
 * Loads saved state when component mounts
 */

import { useEffect, useRef, useCallback } from 'react'
import { Editor, TLShapeId } from 'tldraw'
import { saveProjectSnapshot, loadProjectSnapshot, ProjectSnapshot } from '../utils/projectPersistence'

const SAVE_DEBOUNCE_MS = 2000 // Auto-save after 2 seconds of inactivity

interface UseCanvasPersistenceOptions {
  projectId: string
  projectName?: string
  enabled?: boolean
}

export function useCanvasPersistence(
  editor: Editor | null,
  options: UseCanvasPersistenceOptions
) {
  const { projectId, projectName = 'Untitled Project', enabled = true } = options
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hasLoadedRef = useRef(false)

  /**
   * Create a snapshot of current canvas state
   */
  const createSnapshot = useCallback((): ProjectSnapshot | null => {
    if (!editor) return null

    try {
      const currentPageId = editor.getCurrentPageId()
      const page = editor.getPage(currentPageId)
      if (!page) return null

      // Get all shapes for current page
      const shapes = editor.getSortedChildIdsForParent(currentPageId)
        .map(id => editor.getShape(id as TLShapeId))
        .filter((s): s is any => s !== undefined)

      // Get bindings - collect from all shapes
      const bindingsSet = new Set<any>()
      for (const shape of shapes) {
        const arrowBindings = editor.getBindingsFromShape(shape.id, 'arrow')
        arrowBindings.forEach(b => bindingsSet.add(b))
      }
      const bindings = Array.from(bindingsSet)

      const camera = editor.getCamera()
      const selectedIds = editor.getSelectedShapeIds()

      const snapshot: ProjectSnapshot = {
        id: projectId,
        name: projectName,
        timestamp: Date.now(),
        shapes,
        bindings,
        camera,
        pageId: currentPageId,
        selectedIds: selectedIds as string[],
      }

      return snapshot
    } catch (error) {
      console.error('[useCanvasPersistence] Failed to create snapshot:', error)
      return null
    }
  }, [editor, projectId, projectName])

  /**
   * Save snapshot to localStorage (debounced)
   */
  const debouncedSave = useCallback(() => {
    if (!enabled) return

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      const snapshot = createSnapshot()
      if (snapshot) {
        saveProjectSnapshot(snapshot)
      }
    }, SAVE_DEBOUNCE_MS)
  }, [enabled, createSnapshot])

  /**
   * Load saved state when editor is ready
   */
  useEffect(() => {
    if (!editor || hasLoadedRef.current || !enabled) return

    try {
      const snapshot = loadProjectSnapshot(projectId)
      if (!snapshot || snapshot.shapes.length === 0) {
        console.log('[useCanvasPersistence] No saved state found, starting fresh')
        hasLoadedRef.current = true
        return
      }

      // Restore shapes
      const shapeIds = snapshot.shapes.map(shape => shape.id)
      editor.createShapes(snapshot.shapes)

      // Restore bindings
      if (snapshot.bindings.length > 0) {
        editor.createBindings(snapshot.bindings)
      }

      // Restore camera position
      editor.setCamera(snapshot.camera)

      // Restore selection
      if (snapshot.selectedIds.length > 0) {
        editor.select(...(snapshot.selectedIds as TLShapeId[]))
      }

      console.log('[useCanvasPersistence] Restored canvas state from snapshot')
      hasLoadedRef.current = true
    } catch (error) {
      console.error('[useCanvasPersistence] Failed to load snapshot:', error)
      hasLoadedRef.current = true
    }
  }, [editor, projectId, enabled])

  /**
   * Save on every editor change
   */
  useEffect(() => {
    if (!editor || !enabled) return

    const unsubscribe = editor.store.listen(
      () => {
        debouncedSave()
      },
      { source: 'all', scope: 'document' }
    )

    return () => {
      unsubscribe()
      // Save one final time on unmount
      const snapshot = createSnapshot()
      if (snapshot) {
        saveProjectSnapshot(snapshot)
      }
    }
  }, [editor, enabled, debouncedSave, createSnapshot])

  /**
   * Save on page visibility change (when user switches tabs)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Immediately save when tab loses focus
        const snapshot = createSnapshot()
        if (snapshot) {
          saveProjectSnapshot(snapshot)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [createSnapshot])

  /**
   * Save on page unload
   */
  useEffect(() => {
    const handleBeforeUnload = () => {
      const snapshot = createSnapshot()
      if (snapshot) {
        saveProjectSnapshot(snapshot)
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [createSnapshot])

  return {
    createSnapshot,
    manualSave: () => {
      const snapshot = createSnapshot()
      if (snapshot) {
        saveProjectSnapshot(snapshot)
      }
    },
  }
}
