"use client"
import { formatPrecio } from '@/lib/precio'

import LocalLink from '@/components/LocalLink'
import { Heart, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { productUrl } from '@/lib/product-url'
import Image from 'next/image'

export default function TabFavoritos({ favoritos }: { favoritos: any[] }) {
  if (favoritos.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
        <Heart size={48} className="text-gray-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-800 mb-2">Tus favoritos</h3>
        <p className="text-gray-500">Guarda publicaciones que te interesen para verlas después.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-bold text-lg mb-4">Mis favoritos ({favoritos.length})</h3>
      <div className="space-y-3">
        {favoritos.map((fav: any) => {
          const p = fav.productos
          return (
            <div key={fav.producto_id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 border border-gray-100 transition">
              <LocalLink href={productUrl(p)} className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-16 h-16 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden">
                  {p.imagen_url ? (
                    <Image src={p.imagen_url} alt={p.titulo} className="w-full h-full object-cover" fill sizes="100px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">Sin foto</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-800 truncate">{p.titulo}</h4>
                  <p className="text-sm text-brand-primary font-bold">{formatPrecio(p.precio_usd || 0)}</p>
                  {p.ubicacion_ciudad && <p className="text-xs text-gray-500">{p.ubicacion_ciudad}</p>}
                </div>
              </LocalLink>
              <button onClick={async () => { await supabase.from('favoritos').delete().eq('producto_id', p.id); window.location.reload() }} className="p-2 hover:bg-red-50 rounded-lg transition text-red-500" title="Quitar de favoritos">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
