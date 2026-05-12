"use client"

import * as React from "react"

type Slide = string

interface FilmSlideshowProps {
  slides: Slide[]
  intervalMs?: number
  showBadge?: boolean
  onIndexChange?: (index: number) => void
}

export function FilmSlideshow({
  slides,
  intervalMs = 5000,
  showBadge = true,
  onIndexChange,
}: FilmSlideshowProps) {
  const [index, setIndex] = React.useState(0)

  React.useEffect(() => {
    onIndexChange?.(index)
  }, [index, onIndexChange])

  React.useEffect(() => {
    if (!slides?.length) return
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length)
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [slides, intervalMs])

  if (!slides?.length) return null

  return (
    <div className="relative w-full h-full">
      <img
        src={slides[index]}
        alt={`Slide ${index + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />

      {showBadge && (
        <div className="absolute top-2 left-2 rounded bg-background/70 px-2 py-1 text-xs font-mono text-foreground backdrop-blur">
          {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
        </div>
      )}
    </div>
  )
}
