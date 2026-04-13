'use client'

import { useMemo } from 'react'
import { Star } from '@/types/navigation'
import { seededRandom } from '@/lib/seededRandom'
import { useIsMobile } from '@/hooks/useIsMobile'

const TOTAL_STARS = 350
const MOBILE_STARS = 180
// TODO: cambiar por user_id para que cada usuario tenga su propio fondo de estrellas
const SEED = 6011997

export const StarBackground = () => {
  const isMobile = useIsMobile()

  const stars : Star[] = useMemo(() => {
    const random = seededRandom(SEED)

    return Array.from({ length: TOTAL_STARS }, (_, i) => ({
      id: i,
      x: random() * 100,
      y: random() * 100,
      size: random() * 2 + 1,
      animationOffset: random() * 3,
    }))
  }, [])

  const visibleStars = isMobile
    ? stars.slice(0, MOBILE_STARS)
    : stars

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {visibleStars.map(star => (
        <div
          key={star.id}
          className="absolute rounded-full bg-gray-300 animate-twinkle"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDelay: `-${star.animationOffset}s`,
          }}
        />
      ))}
    </div>
  )
}
