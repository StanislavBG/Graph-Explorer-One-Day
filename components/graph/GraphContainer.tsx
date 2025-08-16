// Graph Container - SVG container and layout management
import React, { useRef, useEffect, useState } from 'react'
import { GraphLayout } from '@/types/graph'

interface GraphContainerProps {
  layout: GraphLayout
  children: React.ReactNode
  onEmptyAreaClick?: () => void
}

export function GraphContainer({ layout, children, onEmptyAreaClick }: GraphContainerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [svgSize, setSvgSize] = useState({ width: layout.width, height: layout.height })

  useEffect(() => {
    function updateSize() {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setSvgSize({ width: rect.width, height: rect.height })
      }
    }
    
    updateSize()
    window.addEventListener("resize", updateSize)
    return () => window.removeEventListener("resize", updateSize)
  }, [layout])

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        className="cursor-crosshair w-full h-full"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="xMidYMid meet"
        suppressHydrationWarning
        onClick={(e) => {
          // Only clear selection if the click target is the SVG itself (not a node or edge)
          if (e.target === svgRef.current && onEmptyAreaClick) {
            onEmptyAreaClick()
          }
        }}
      >
        {/* SVG Filters for visual effects */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {children}
      </svg>
    </div>
  )
} 