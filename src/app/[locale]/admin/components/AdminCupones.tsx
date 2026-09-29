'use client'

import { useCallback, useEffect, useState } from 'react'
import { Ticket } from 'lucide-react'
import { Button, Card, Loading } from './AdminUi'
import { apiJson } from './admin-utils'

type Cupon = {
  id: string
  codigo: string
  tipo: string
  activo: boolean
  max_usos: number | null
  usos: number
  valido_desde: string | null
  valido_hasta: string | null
  dias: number | null
  plan: string | null
  porcentaje: number | null
  meses_descuento: number | null
  stripe_coupon_id: string | null
  notas: string | null
}

export default function AdminCupones({ notify }: { notify: (msg: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [cupones, setCupones] = useState<Cupon[]>([])
  const [mesGratis, setMesGratis] = useState(true)
  const [diasGratis, setDiasGratis] = useState(30)
  const [tipo, setTipo] = useState<'regalo_dias' | 'descuento'>('regalo_dias')
  const [codigo, setCodigo] = useState('')
  const [dias, setDias] = useState(30)
  const [plan, setPlan] = useState('plus')
  const [maxUsos, setMaxUsos] = useState('100')
  const [porcentaje, setPorcentaje] = useState(20)
  const [meses, setMeses] = useState(3)
  const [hasta, setHasta] = useState('')
  const [desde, setDesde] = useState('')
  const [notas, setNotas] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiJson<{ cupones: Cupon[]; ajustes: { mesGratisActivo: boolean; diasGratis: number } }>(
        '/api/admin/cupones',
      )
      setCupones(res.cupones || [])
      if (res.ajustes) {
        setMesGratis(res.ajustes.mesGratisActivo)
        setDiasGratis(res.ajustes.diasGratis)
      }
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
    setLoading(false)
  }, [notify])

  useEffect(() => { load() }, [load])

  async function guardarAjustes() {
    try {
      await apiJson('/api/admin/cupones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ajustes: { mesGratisActivo: mesGratis, diasGratis } }),
      })
      notify('Mes de prueba actualizado')
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
  }

  async function crear() {
    try {
      const res = await apiJson<{ cupon: Cupon }>('/api/admin/cupones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          codigo: codigo || undefined,
          dias,
          plan,
          maxUsos: maxUsos === '' ? null : Number(maxUsos),
          porcentaje,
          mesesDescuento: meses,
          validoDesde: desde || null,
          validoHasta: hasta || null,
          notas,
        }),
      })
      notify('Cupón ' + res.cupon.codigo + ' creado')
      setCodigo('')
      load()
    } catch (e: any) {
      notify('❌ ' + e.message)
    }
  }

  async function desactivar(id: string) {
    await apiJson('/api/admin/cupones', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, activo: false }),
    })
    load()
  }

  if (loading) return <Loading label="Cargando cupones…" />

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="font-bold text-gray-900 mb-1">Mes gratis al registrarse</h3>
        <p className="text-sm text-gray-500 mb-4">
          Si está activo, cada profesional/camperizador nuevo tiene {diasGratis} días con el pack Plus
          desde la fecha de alta. Apágalo cuando quieras cortar la promo (afecta también a quien aún estuviera en prueba).
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={mesGratis} onChange={e => setMesGratis(e.target.checked)} />
            Promo activa
          </label>
          <label className="text-sm">
            Días
            <input
              type="number"
              min={1}
              max={365}
              value={diasGratis}
              onChange={e => setDiasGratis(Number(e.target.value))}
              className="ml-2 w-20 border rounded-lg px-2 py-1"
            />
          </label>
          <Button onClick={guardarAjustes}>Guardar</Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Ticket size={18} /> Nuevo cupón</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <label className="block">
            Tipo
            <select value={tipo} onChange={e => setTipo(e.target.value as any)} className="mt-1 w-full border rounded-lg px-3 py-2">
              <option value="regalo_dias">Regalo de días de pack</option>
              <option value="descuento">Descuento % en Stripe</option>
            </select>
          </label>
          <label className="block">
            Código (vacío = se genera)
            <input value={codigo} onChange={e => setCodigo(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="MAYO-20" />
          </label>
          <label className="block">
            Pack
            <select value={plan} onChange={e => setPlan(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2">
              <option value="starter">Starter</option>
              <option value="plus">Plus</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </label>
          <label className="block">
            Usos máximos (vacío = ilimitado)
            <input value={maxUsos} onChange={e => setMaxUsos(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          {tipo === 'regalo_dias' ? (
            <label className="block">
              Días de pack
              <input type="number" value={dias} onChange={e => setDias(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2" />
            </label>
          ) : (
            <>
              <label className="block">
                % descuento
                <input type="number" value={porcentaje} onChange={e => setPorcentaje(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
              <label className="block">
                Meses con descuento
                <input type="number" value={meses} onChange={e => setMeses(Number(e.target.value))} className="mt-1 w-full border rounded-lg px-3 py-2" />
              </label>
            </>
          )}
          <label className="block">
            Válido desde
            <input type="datetime-local" value={desde} onChange={e => setDesde(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <label className="block">
            Válido hasta
            <input type="datetime-local" value={hasta} onChange={e => setHasta(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" />
          </label>
          <label className="block sm:col-span-2">
            Notas internas
            <input value={notas} onChange={e => setNotas(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2" placeholder="Oferta mayo 20% tres primeros meses" />
          </label>
        </div>
        <Button className="mt-4" onClick={crear}>Generar cupón</Button>
      </Card>

      <Card>
        <h3 className="font-bold mb-3">Cupones</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2">Código</th>
                <th>Tipo</th>
                <th>Detalle</th>
                <th>Usos</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cupones.map(c => (
                <tr key={c.id} className="border-b border-gray-100">
                  <td className="py-2 font-mono font-bold">{c.codigo}</td>
                  <td>{c.tipo === 'descuento' ? 'Descuento' : 'Regalo'}</td>
                  <td>
                    {c.tipo === 'descuento'
                      ? `${c.porcentaje}% × ${c.meses_descuento} mes(es) ${c.plan || 'cualquier pack'}`
                      : `${c.dias} días de ${c.plan}`}
                  </td>
                  <td>{c.usos}{c.max_usos != null ? ` / ${c.max_usos}` : ''}</td>
                  <td>{c.activo ? 'Activo' : 'Off'}</td>
                  <td>
                    {c.activo && (
                      <button className="text-red-600 text-xs" onClick={() => desactivar(c.id)}>Desactivar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cupones.length === 0 && <p className="text-sm text-gray-500 py-4">Aún no hay cupones.</p>}
        </div>
      </Card>
    </div>
  )
}
