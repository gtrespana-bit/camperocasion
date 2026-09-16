'use client'

import { useState } from 'react'

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
      <div className="aspect-square bg-gray-100">
        <div className="w-full h-full skeleton"></div>
      </div>
      <div className="p-4 space-y-2">
        <div className="h-4 skeleton skeleton-title"></div>
        <div className="h-7 skeleton skeleton-price"></div>
        <div className="h-3 skeleton w-1/2"></div>
      </div>
    </div>
  )
}

export function SkeletonSearch() {
  return (
    <div className="space-y-2 p-4 bg-white border-b">
      <div className="h-4 skeleton skeleton-text w-3/4"></div>
      <div className="h-3 skeleton skeleton-text w-1/2"></div>
    </div>
  )
}
