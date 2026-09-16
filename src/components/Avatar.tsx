'use client'

import Image from 'next/image'

interface AvatarProps {
  nombre: string
  fotoUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeMap = {
  sm: { w: 8, h: 8, text: 'text-sm' },
  md: { w: 12, h: 12, text: 'text-lg' },
  lg: { w: 16, h: 16, text: 'text-2xl' },
  xl: { w: 24, h: 24, text: 'text-4xl' },
}

export default function Avatar({ nombre, fotoUrl, size = 'md', className = '' }: AvatarProps) {
  const s = sizeMap[size]
  const initials = nombre ? nombre.charAt(0).toUpperCase() : '?'
  const bgColors = [
    'bg-brand-primary', 'bg-green-600', 'bg-purple-600',
    'bg-orange-500', 'bg-pink-600', 'bg-teal-600', 'bg-indigo-600',
  ]
  const colorIndex = (nombre || '').charCodeAt(0) % bgColors.length
  const bgColor = bgColors[colorIndex]

  if (!fotoUrl) {
    return (
      <div
        className={`rounded-full ${bgColor} text-white flex items-center justify-center font-bold ${s.text} flex-shrink-0 ${className}`}
        style={{ width: `${s.w * 4}px`, height: `${s.h * 4}px` }}
      >
        {initials}
      </div>
    )
  }

  return (
    <div
      className={`rounded-full overflow-hidden flex-shrink-0 relative ${className}`}
      style={{ width: `${s.w * 4}px`, height: `${s.h * 4}px` }}
    >
      <Image
        src={fotoUrl}
        alt={nombre || 'Avatar'}
        fill
        className="object-cover"
        onError={(e) => {
          // ✅ CORREGIDO: Fallback a iniciales con flag para prevenir loops
          const target = e.target as HTMLImageElement

          // Si ya procesamos el error, no hacer nada (prevenir loops)
          if (target.dataset.errorHandled === 'true') return
          target.dataset.errorHandled = 'true'

          target.style.display = 'none'
          const parent = target.parentElement
          if (parent) {
            parent.classList.add(bgColor, 'text-white', 'flex', 'items-center', 'justify-center', 'font-bold', s.text)
            parent.innerHTML = initials
          }
        }}
      />
    </div>
  )
}