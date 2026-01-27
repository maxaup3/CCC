import { useState, useCallback } from 'react'

export function usePageNavigation() {
  const [showLandingPage, setShowLandingPage] = useState(false)
  const [showAllProjectsPage, setShowAllProjectsPage] = useState(false)
  const [showLoading, setShowLoading] = useState(false)
  const [isLoadingFadingOut, setIsLoadingFadingOut] = useState(false)

  const handleLoadingFadeStart = useCallback(() => setIsLoadingFadingOut(true), [])
  const handleLoadingComplete = useCallback(() => {
    setShowLoading(false)
    setIsLoadingFadingOut(false)
  }, [])

  return {
    showLandingPage, setShowLandingPage,
    showAllProjectsPage, setShowAllProjectsPage,
    showLoading, setShowLoading,
    isLoadingFadingOut,
    handleLoadingFadeStart, handleLoadingComplete,
  }
}
