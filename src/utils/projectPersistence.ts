/**
 * Project Persistence Utilities
 * Handles saving and loading canvas state to localStorage
 */

import { TLShape, TLBinding, TLCamera, TLPage } from 'tldraw'

export interface ProjectSnapshot {
  id: string
  name: string
  timestamp: number
  shapes: TLShape[]
  bindings: TLBinding[]
  camera: TLCamera
  pageId: string
  selectedIds: string[]
}

export interface ProjectMetadata {
  id: string
  name: string
  createdAt: number
  lastModified: number
  thumbnailUrl?: string
}

const PROJECT_PREFIX = 'canvas-project-'
const PROJECT_METADATA_KEY = 'canvas-projects-metadata'
const LAST_PROJECT_KEY = 'canvas-last-project'
const TUTORIAL_SEEN_KEY = 'canvas-tutorial-seen'

/**
 * Generate unique project ID
 */
export function generateProjectId(): string {
  return `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save canvas state for a project
 */
export function saveProjectSnapshot(snapshot: ProjectSnapshot): void {
  try {
    const key = `${PROJECT_PREFIX}${snapshot.id}`
    localStorage.setItem(key, JSON.stringify(snapshot))

    // Update metadata
    const metadata = getProjectMetadata(snapshot.id) || {
      id: snapshot.id,
      name: snapshot.name,
      createdAt: snapshot.timestamp,
      lastModified: snapshot.timestamp,
    }
    metadata.lastModified = Date.now()
    metadata.name = snapshot.name

    saveProjectMetadata(metadata)

    // Save as last opened project
    localStorage.setItem(LAST_PROJECT_KEY, snapshot.id)

    console.log('[ProjectPersistence] Saved snapshot for project:', snapshot.id)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to save snapshot:', error)
  }
}

/**
 * Load canvas state for a project
 */
export function loadProjectSnapshot(projectId: string): ProjectSnapshot | null {
  try {
    const key = `${PROJECT_PREFIX}${projectId}`
    const data = localStorage.getItem(key)
    if (!data) return null

    const snapshot = JSON.parse(data) as ProjectSnapshot
    console.log('[ProjectPersistence] Loaded snapshot for project:', projectId)
    return snapshot
  } catch (error) {
    console.error('[ProjectPersistence] Failed to load snapshot:', error)
    return null
  }
}

/**
 * Get all project metadata
 */
export function getAllProjectsMetadata(): ProjectMetadata[] {
  try {
    const data = localStorage.getItem(PROJECT_METADATA_KEY)
    if (!data) return []

    const metadata = JSON.parse(data) as ProjectMetadata[]
    // Sort by lastModified descending (most recent first)
    return metadata.sort((a, b) => b.lastModified - a.lastModified)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to load projects metadata:', error)
    return []
  }
}

/**
 * Save project metadata
 */
export function saveProjectMetadata(metadata: ProjectMetadata): void {
  try {
    const allMetadata = getAllProjectsMetadata()
    const index = allMetadata.findIndex(p => p.id === metadata.id)

    if (index >= 0) {
      allMetadata[index] = metadata
    } else {
      allMetadata.push(metadata)
    }

    localStorage.setItem(PROJECT_METADATA_KEY, JSON.stringify(allMetadata))
    console.log('[ProjectPersistence] Saved metadata for project:', metadata.id)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to save project metadata:', error)
  }
}

/**
 * Get specific project metadata
 */
export function getProjectMetadata(projectId: string): ProjectMetadata | null {
  const allMetadata = getAllProjectsMetadata()
  return allMetadata.find(p => p.id === projectId) || null
}

/**
 * Delete project (both snapshot and metadata)
 */
export function deleteProject(projectId: string): void {
  try {
    const key = `${PROJECT_PREFIX}${projectId}`
    localStorage.removeItem(key)

    const allMetadata = getAllProjectsMetadata()
    const filtered = allMetadata.filter(p => p.id !== projectId)
    localStorage.setItem(PROJECT_METADATA_KEY, JSON.stringify(filtered))

    console.log('[ProjectPersistence] Deleted project:', projectId)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to delete project:', error)
  }
}

/**
 * Rename project
 */
export function renameProject(projectId: string, newName: string): void {
  try {
    const metadata = getProjectMetadata(projectId)
    if (!metadata) return

    metadata.name = newName
    metadata.lastModified = Date.now()
    saveProjectMetadata(metadata)

    // Also update name in snapshot if exists
    const snapshot = loadProjectSnapshot(projectId)
    if (snapshot) {
      snapshot.name = newName
      saveProjectSnapshot(snapshot)
    }

    console.log('[ProjectPersistence] Renamed project:', projectId, '->', newName)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to rename project:', error)
  }
}

/**
 * Get last opened project ID
 */
export function getLastProjectId(): string | null {
  return localStorage.getItem(LAST_PROJECT_KEY)
}

/**
 * Create new project
 */
export function createProject(name: string = 'New Project'): ProjectMetadata {
  const id = generateProjectId()
  const now = Date.now()

  const metadata: ProjectMetadata = {
    id,
    name,
    createdAt: now,
    lastModified: now,
  }

  saveProjectMetadata(metadata)
  console.log('[ProjectPersistence] Created new project:', id, name)

  return metadata
}

/**
 * Check if tutorial has been seen
 */
export function hasTutorialBeenSeen(): boolean {
  return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true'
}

/**
 * Mark tutorial as seen
 */
export function markTutorialAsSeen(): void {
  localStorage.setItem(TUTORIAL_SEEN_KEY, 'true')
  console.log('[ProjectPersistence] Tutorial marked as seen')
}

/**
 * Clear all project data (for testing only)
 */
export function clearAllProjectData(): void {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('[ProjectPersistence] clearAllProjectData only available in development')
    return
  }

  const keys = Object.keys(localStorage)
  keys.forEach(key => {
    if (key.startsWith(PROJECT_PREFIX) || key === PROJECT_METADATA_KEY) {
      localStorage.removeItem(key)
    }
  })
  console.log('[ProjectPersistence] Cleared all project data')
}

/**
 * Export project as JSON
 */
export function exportProject(projectId: string): string | null {
  const snapshot = loadProjectSnapshot(projectId)
  if (!snapshot) return null

  return JSON.stringify(snapshot, null, 2)
}

/**
 * Import project from JSON
 */
export function importProject(jsonData: string): ProjectMetadata | null {
  try {
    const snapshot = JSON.parse(jsonData) as ProjectSnapshot
    saveProjectSnapshot(snapshot)
    return getProjectMetadata(snapshot.id)
  } catch (error) {
    console.error('[ProjectPersistence] Failed to import project:', error)
    return null
  }
}
