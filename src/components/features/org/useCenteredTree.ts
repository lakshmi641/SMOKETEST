import { useState, useLayoutEffect, useRef, RefObject } from 'react'

interface Dimensions {
  width: number
  height: number
}

interface Translate {
  x: number
  y: number
}

/**
 * Custom hook to calculate centered tree dimensions and translate
 * for react-d3-tree to properly center the org chart
 */
export function useCenteredTree(): [Dimensions, Translate, RefObject<HTMLDivElement>] {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<Dimensions>({ width: 0, height: 0 })
  const [translate, setTranslate] = useState<Translate>({ x: 0, y: 50 })

  useLayoutEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect()
        // Use container dimensions if available, otherwise fallback to window
        const finalWidth = width > 0 ? width : window.innerWidth - 48 // Account for padding
        const finalHeight = height > 0 ? height : window.innerHeight - 200 // Account for header
        
        // Only update if we have valid dimensions
        if (finalWidth > 0 && finalHeight > 0) {
          setDimensions({ width: finalWidth, height: finalHeight })
          // Center horizontally, offset vertically for header space
          setTranslate({ x: finalWidth / 2, y: 80 })
        }
      } else {
        // Fallback to window dimensions if container ref isn't ready
        const width = window.innerWidth - 48
        const height = window.innerHeight - 200
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
          setTranslate({ x: width / 2, y: 80 })
        }
      }
    }

    // Initial measurement - use requestAnimationFrame to ensure DOM is ready
    const rafId1 = requestAnimationFrame(() => {
      updateDimensions()
    })

    // Also try after a small delay to catch any async layout
    const timeoutId1 = setTimeout(() => {
      updateDimensions()
    }, 0)

    // Another attempt after a slightly longer delay to ensure parent containers are laid out
    const timeoutId2 = setTimeout(() => {
      updateDimensions()
    }, 100)

    window.addEventListener('resize', updateDimensions)

    // Use ResizeObserver for better performance
    let resizeObserver: ResizeObserver | null = null
    if (containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateDimensions()
      })
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      cancelAnimationFrame(rafId1)
      clearTimeout(timeoutId1)
      clearTimeout(timeoutId2)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      window.removeEventListener('resize', updateDimensions)
    }
  }, [])

  return [dimensions, translate, containerRef]
}
