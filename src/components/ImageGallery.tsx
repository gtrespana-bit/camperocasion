'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react'

interface ImageGalleryProps {
  images: string[]
  alt: string
}

const FALLBACK_IMAGE = '/placeholder-product.webp'
const BLUR_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAADAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k='

export default function ImageGallery({ images, alt }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  const goNext = useCallback(() => {
    setActiveIndex(i => (i + 1) % images.length)
  }, [images.length])

  const goPrev = useCallback(() => {
    setActiveIndex(i => (i - 1 + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!lightboxOpen) return

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext()
      else if (e.key === 'ArrowLeft') goPrev()
      else if (e.key === 'Escape') setLightboxOpen(false)
    }

    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [lightboxOpen, goNext, goPrev])

  const openLightbox = (index: number) => {
    setActiveIndex(index)
    setLightboxOpen(true)
  }

  // ✅ Handler defensivo para prevenir loops
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const target = e.target as HTMLImageElement
    if (!target.src.includes(FALLBACK_IMAGE)) {
      target.src = FALLBACK_IMAGE
    }
  }

  if (images.length === 0) return null

  return (
    <>
      {/* ====== Main image ====== */}
      <div
        className="aspect-square md:aspect-[16/10] bg-gray-100 relative cursor-pointer group"
        onClick={() => openLightbox(activeIndex)}
      >
        <Image
          src={images[activeIndex]}
          alt={alt}
          width={800}
          height={600}
          sizes="(max-width: 1024px) 100vw, 66vw"
          className="w-full h-full object-cover"
          priority={activeIndex === 0}
          fetchPriority={activeIndex === 0 ? 'high' : undefined}
          decoding="async"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          onError={handleImageError}
        />

        {images.length > 1 && (
          <>
            <button
              onClick={e => { e.stopPropagation(); goPrev() }}
              aria-label="Imagen anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 hover:bg-white transition"
            >
              <ChevronLeft size={20} className="text-gray-800" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); goNext() }}
              aria-label="Siguiente imagen"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 hover:bg-white transition"
            >
              <ChevronRight size={20} className="text-gray-800" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setActiveIndex(i) }}
                aria-label={`Imagen ${i + 1} de ${images.length}`}
                className={`w-2 h-2 rounded-full transition ${
                    i === activeIndex ? 'bg-white scale-110' : 'bg-white/40'
                  }`}
              />
              ))}
            </div>
          </>
        )}

        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition">
          <ZoomIn size={16} className="text-white" />
        </div>
      </div>

      {/* ====== Thumbnails ====== */}
      {images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto hide-scrollbar">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                i === activeIndex ? 'border-brand-accent shadow-sm' : 'border-transparent hover:border-gray-300'
              }`}
            >
              <Image
                src={img}
                alt=""
                width={80}
                height={80}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
                onError={handleImageError}
              />
            </button>
          ))}
        </div>
      )}

      {/* ====== Lightbox Modal ====== */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center animate-fadeIn"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            aria-label="Cerrar visor de imágenes"
            className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition"
          >
            <X size={20} className="text-white" />
          </button>

          <div className="absolute top-5 left-5 text-white/70 text-sm font-medium">
            {activeIndex + 1} / {images.length}
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={e => { e.stopPropagation(); goPrev() }}
                aria-label="Imagen anterior"
                className="absolute left-4 z-10 w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition"
              >
                <ChevronLeft size={24} className="text-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); goNext() }}
                aria-label="Siguiente imagen"
                className="absolute right-4 z-10 w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center hover:bg-white/20 transition"
              >
                <ChevronRight size={24} className="text-white" />
              </button>
            </>
          )}

          <div
            className="relative max-w-[95vw] max-h-[90vh] flex items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={images[activeIndex]}
              alt={alt}
              width={1600}
              height={1200}
              sizes="(max-width: 768px) 95vw, 80vw"
              className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain"
              quality={90}
              decoding="async"
              onError={handleImageError}
            />
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] py-2">
              {images.map((img, i) => (
              <button
                key={i}
                onClick={e => { e.stopPropagation(); setActiveIndex(i) }}
                aria-label={`Ver imagen ${i + 1}`}
                className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                    i === activeIndex ? 'border-brand-accent' : 'border-transparent opacity-50 hover:opacity-100'
                  }`}
                >
                  <Image
                    src={img}
                    alt=""
                    width={64}
                    height={64}
                    className="w-full h-full object-cover"
                    onError={handleImageError}
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}