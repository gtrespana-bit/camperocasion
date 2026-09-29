'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gift, Ticket, Users } from 'lucide-react'
import { Badge, Button, Card, Loading, RefreshButton, SearchInput, formatDate, formatDateTime } from './AdminUi'
import { apiJson, type Perfil } from './admin-utils'
import RegalarPlanModal from './RegalarPlanModal'
import { diasRestantesDePlan, etiquetaPlan, planVigente } from '@/lib/planes-regalo'

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

type PackActivo = {
  id: string
  nombre: string
  email: string | null
  plan: string
  planEtiqueta: string
  planHasta: string | null
  diasRestantes: number | null
  tipoVendedor: string | null
  creadoEn: string | null
}

type RegaloPlan = {
  id: string
  userId: string
  nombre: string
  email: string | null
  plan: string
  planEtiqueta: string
  dias: number
  modo: string
  motivo: string | null
  planHasta: string | null
  adminEmail: string | null
  creadoEn: string | null
}

type PacksInfo = {
  ok: boolean
  resumen: { starter: number; plus: number; unlimited: number; total: number }
  packs: PackActivo[]
  regalos: RegaloPlan[]
}

const TONO_PACK: Record<string, 'blue' | 'brand' | 'purple' | 'gray'> = {
  starter: 'blue',
  plus: 'brand',
  unlimited: 'purple',
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

  // Regalo directo de packs (no pasa por cupones).
  const [usuarios, setUsuarios] = useState<Perfil[]>([])
  const [busqueda, setBusqueda] = useState('')
  const [packsInfo, setPacksInfo] = useState<PacksInfo | null>(null)
  const [regalo, setRegalo] = useState<Perfil | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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

  const loadPacks = useCallback(async () => {
    try {
      const res = await apiJson<PacksInfo>('/api/admin/regalar-plan')
      setPacksInfo(res)
    } catch {
      // La pestaña sigue siendo útil sin el resumen de packs.
      setPacksInfo(null)
    }
  }, [])

  const loadUsuarios = useCallback(async () => {
    try {
      const res = await apiJson<{ ok: boolean; usuarios: Perfil[] }>('/api/admin/usuarios')
      setUsuarios(res.usuarios || [])
    } catch {
      setUsuarios([])
    }
  }, [])

  useEffect(() => {
    load()
    loadPacks()
    loadUsuarios()
  }, [load, loadPacks, loadUsuarios])

  const usuariosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return usuarios.slice(0, 8)
    return usuarios
      .filter((u) =>
        [u.nombre, u.email, u.ciudad, u.telefono]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(q)),
      )
      .slice(0, 12)
  }, [usuarios, busqueda])

  async function refrescarTodo() {
    setRefreshing(true)
    await Promise.all([load(), loadPacks(), loadUsuarios()])
    setRefreshing(false)
  }

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

  if (loading) return <Loading label="Cargando planes y cupones…" />

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-black text-gray-900">Planes, regalos y cupones</h2>
          <p className="text-sm text-gray-500">
            Packs de pago, mes de prueba global, cupones y regalos directos de tiempo gratis a un usuario.
          </p>
        </div>
        <RefreshButton onClick={refrescarTodo} loading={refreshing} />
      </div>

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

      {/* ── Regalo directo de pack ─────────────────────────────── */}
      <Card className="border-brand-primary/30">
        <h3 className="mb-1 flex items-center gap-2 font-bold text-gray-900">
          <Gift size={18} className="text-brand-primary" /> Regalar pack a un usuario
        </h3>
        <p className="mb-4 text-sm text-gray-500">
          Días de Starter, Plus o Unlimited gratis para una cuenta concreta, sin cupón y sin Stripe. El usuario recibe
          un email de aviso y el regalo queda anotado en la bitácora de abajo.
        </p>

        <SearchInput
          value={busqueda}
          onChange={setBusqueda}
          placeholder="Buscar por nombre, email, ciudad o teléfono…"
          className="w-full sm:max-w-md"
        />

        <div className="mt-3 divide-y divide-gray-50">
          {usuariosFiltrados.length === 0 && (
            <p className="py-4 text-sm text-gray-500">
              {usuarios.length === 0 ? 'No se pudo cargar la lista de usuarios.' : 'Sin resultados para esa búsqueda.'}
            </p>
          )}
          {usuariosFiltrados.map((u) => {
            const vigente = planVigente(u.plan_anuncios, u.plan_hasta)
            const restantes = diasRestantesDePlan(u.plan_hasta)
            return (
              <div key={u.id} className="flex items-center gap-3 py-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
                  {u.nombre?.slice(0, 1) || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">{u.nombre || 'Sin nombre'}</p>
                  <p className="truncate text-xs text-gray-500">{u.email || u.telefono || '—'}</p>
                </div>
                {vigente ? (
                  <Badge tone={TONO_PACK[u.plan_anuncios || ''] || 'gray'}>
                    {etiquetaPlan(u.plan_anuncios)}
                    {restantes != null ? ` · ${restantes} d` : ''}
                  </Badge>
                ) : (
                  <span className="hidden text-xs text-gray-400 sm:block">Sin pack</span>
                )}
                <Button size="xs" variant={vigente ? 'outline' : 'primary'} onClick={() => setRegalo(u)}>
                  <Gift size={13} /> Regalar
                </Button>
              </div>
            )
          })}
        </div>
        {!busqueda && usuarios.length > 8 && (
          <p className="mt-2 text-xs text-gray-400">
            Mostrando los 8 usuarios más recientes. Escribe para buscar entre los {usuarios.length} cargados.
          </p>
        )}
      </Card>

      {packsInfo && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-bold text-gray-900">
            <Users size={18} className="text-brand-primary" /> Packs activos ahora mismo
          </h3>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Starter', valor: packsInfo.resumen.starter, tone: 'blue' as const },
              { label: 'Plus', valor: packsInfo.resumen.plus, tone: 'brand' as const },
              { label: 'Unlimited', valor: packsInfo.resumen.unlimited, tone: 'purple' as const },
              { label: 'Total con pack', valor: packsInfo.resumen.total, tone: 'gray' as const },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                <p className="text-2xl font-black text-gray-900">{kpi.valor}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                  <Badge tone={kpi.tone}>{kpi.label}</Badge>
                </p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2">Usuario</th>
                  <th>Pack</th>
                  <th>Activo hasta</th>
                  <th>Restan</th>
                  <th>Tipo de cuenta</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {packsInfo.packs.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-2">
                      <p className="font-semibold text-gray-800">{p.nombre}</p>
                      <p className="text-xs text-gray-400">{p.email || '—'}</p>
                    </td>
                    <td><Badge tone={TONO_PACK[p.plan] || 'gray'}>{p.planEtiqueta}</Badge></td>
                    <td className="text-xs text-gray-500">{formatDate(p.planHasta)}</td>
                    <td className="text-xs font-semibold text-gray-700">
                      {p.diasRestantes != null ? `${p.diasRestantes} días` : '—'}
                    </td>
                    <td className="text-xs text-gray-500">
                      {p.tipoVendedor === 'camperizador' ? 'Camperizador' : p.tipoVendedor === 'profesional' ? 'Profesional' : 'Particular'}
                    </td>
                    <td className="text-right">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          setRegalo({
                            id: p.id,
                            nombre: p.nombre,
                            email: p.email,
                            plan_anuncios: p.plan,
                            plan_hasta: p.planHasta,
                            tipo_vendedor: p.tipoVendedor,
                          })
                        }
                      >
                        <Gift size={13} /> Ajustar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {packsInfo.packs.length === 0 && (
              <p className="py-4 text-sm text-gray-500">Nadie tiene pack de pago todavía (ni regalado).</p>
            )}
          </div>

          <h4 className="mb-2 mt-6 text-sm font-bold text-gray-900">Últimos regalos hechos desde el panel</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-2">Cuándo</th>
                  <th>Usuario</th>
                  <th>Regalo</th>
                  <th>Hasta</th>
                  <th>Motivo</th>
                  <th>Admin</th>
                </tr>
              </thead>
              <tbody>
                {packsInfo.regalos.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100">
                    <td className="py-2 text-xs text-gray-500">{formatDateTime(r.creadoEn)}</td>
                    <td className="text-xs">
                      <p className="font-semibold text-gray-800">{r.nombre}</p>
                      <p className="text-gray-400">{r.email || '—'}</p>
                    </td>
                    <td className="text-xs">
                      {r.plan === 'gratis' ? (
                        <Badge tone="red">Retirado</Badge>
                      ) : (
                        <>
                          <Badge tone={TONO_PACK[r.plan] || 'gray'}>{r.planEtiqueta}</Badge>
                          <span className="ml-2 text-gray-500">{r.dias} días</span>
                        </>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">{formatDate(r.planHasta)}</td>
                    <td className="max-w-[220px] truncate text-xs text-gray-500" title={r.motivo || ''}>
                      {r.motivo || '—'}
                    </td>
                    <td className="text-xs text-gray-400">{r.adminEmail || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {packsInfo.regalos.length === 0 && (
              <p className="py-4 text-sm text-gray-500">Aún no has regalado ningún pack.</p>
            )}
          </div>
        </Card>
      )}

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
        <p className="mt-2 text-xs text-gray-400">
          El cupón lo canjea el propio usuario desde su panel y exige cuenta profesional. Para dárselo tú directamente, usa
          «Regalar pack a un usuario».
        </p>
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

      <RegalarPlanModal
        usuario={regalo}
        onClose={() => setRegalo(null)}
        onDone={() => {
          loadPacks()
          loadUsuarios()
        }}
        notify={notify}
      />
    </div>
  )
}
