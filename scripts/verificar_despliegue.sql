-- Verificación de despliegue completa (Fases 0.1, 0.2 y 1.2).
-- Pegar en el SQL Editor de Supabase DESPUÉS de ejecutar setup-camperocasion.sql.
-- Si todas las filas salen con ✅, no falta nada por aplicar.
--
-- Ojo: para funciones hay que usar to_regprocedure('... (tipos)'), porque
-- to_regclass() solo mira relaciones (tablas, índices, vistas) y devuelve NULL
-- aunque la función exista.

with checks(nombre, ok) as (
  -- Fase 0.1 — filtros técnicos (columnas e índice de la migración 025)
  select 'Fase 0.1 · columna productos.especificaciones',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'especificaciones')
  union all
  select 'Fase 0.1 · índice GIN productos_especificaciones_idx',
         exists (select 1 from pg_indexes where indexname = 'productos_especificaciones_idx')

  -- Fase 0.2 — expediente de homologación
  union all
  select 'Fase 0.2 · tabla documentos_vehiculo',
         to_regclass('public.documentos_vehiculo') is not null
  union all
  select 'Fase 0.2 · función fn_es_dueno_del_anuncio(uuid)',
         to_regprocedure('public.fn_es_dueno_del_anuncio(uuid)') is not null
  union all
  select 'Fase 0.2 · trigger de inmutabilidad del propietario',
         exists (select 1 from pg_trigger
                  where tgname = 'trg_documentos_vehiculo_user_id_inmutable'
                    and not tgisinternal)
  union all
  select 'Fase 0.2 · columna productos.verificacion_homologacion',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'verificacion_homologacion')
  union all
  select 'Fase 0.2 · bucket documentos-vehiculo',
         exists (select 1 from storage.buckets where id = 'documentos-vehiculo')

  -- Fase 1.2 — reserva con señal (confirmación del vendedor)
  union all
  select 'Fase 1.2 · tabla reservas',
         to_regclass('public.reservas') is not null
  union all
  select 'Fase 1.2 · columna productos.reservado',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'reservado')
  union all
  select 'Fase 1.2 · columna productos.reservado_hasta',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'reservado_hasta')
  union all
  select 'Fase 1.2 · índice único reservas_producto_activa_key (una reserva activa)',
         exists (select 1 from pg_indexes where indexname = 'reservas_producto_activa_key')
  union all
  select 'Fase 1.2 · índice único reservas_solicitud_unica_key',
         exists (select 1 from pg_indexes where indexname = 'reservas_solicitud_unica_key')
  union all
  select 'Fase 1.2 · check de estados (solicitada → activa → …)',
         exists (select 1 from pg_constraint
                  where conname = 'reservas_estado_check' and contype = 'c')
  union all
  select 'Fase 1.2 · función fn_propagar_reserva()',
         to_regprocedure('public.fn_propagar_reserva()') is not null
  union all
  select 'Fase 1.2 · función fn_completar_reservas_al_vender()',
         to_regprocedure('public.fn_completar_reservas_al_vender()') is not null
  union all
  select 'Fase 1.2 · trigger trg_propagar_reserva',
         exists (select 1 from pg_trigger
                  where tgname = 'trg_propagar_reserva' and not tgisinternal)
  union all
  select 'Fase 1.2 · trigger trg_completar_reservas_al_vender',
         exists (select 1 from pg_trigger
                  where tgname = 'trg_completar_reservas_al_vender' and not tgisinternal)
  union all
  select 'Fase 1.2 · RLS activada en reservas',
         exists (select 1 from pg_class
                  where oid = to_regclass('public.reservas') and relrowsecurity)
  union all
  select 'Fase 1.2 · políticas RLS de reservas (partes + admin)',
         (select count(*) from pg_policies
           where schemaname = 'public' and tablename = 'reservas') >= 2
  union all
  select 'Fase 1.2 · sin bucket de comprobantes (modelo nuevo)',
         not exists (select 1 from storage.buckets where id = 'comprobantes-reserva')

  -- Plan §4 — inspección precompra + gestoría (202609170002)
  union all
  select 'Fase §4 · tabla solicitudes_inspeccion',
         to_regclass('public.solicitudes_inspeccion') is not null
  union all
  select 'Fase §4 · índice único solicitudes_inspeccion_viva_key',
         exists (select 1 from pg_indexes where indexname = 'solicitudes_inspeccion_viva_key')
  union all
  select 'Fase §4 · RLS activada en solicitudes_inspeccion',
         exists (select 1 from pg_class
                  where oid = to_regclass('public.solicitudes_inspeccion') and relrowsecurity)
  union all
  select 'Fase §4 · tabla solicitudes_gestoria',
         to_regclass('public.solicitudes_gestoria') is not null
  union all
  select 'Fase §4 · RLS activada en solicitudes_gestoria',
         exists (select 1 from pg_class
                  where oid = to_regclass('public.solicitudes_gestoria') and relrowsecurity)
  union all
  select 'Fase §4 · políticas RLS de inspección y gestoría (4)',
         (select count(*) from pg_policies
           where schemaname = 'public'
             and tablename in ('solicitudes_inspeccion', 'solicitudes_gestoria')) >= 4

  -- Fase 0.1 (cierre) — rangos numéricos del catálogo (202609170003)
  union all
  select 'Rangos · función fn_espec_numero(text)',
         to_regprocedure('public.fn_espec_numero(text)') is not null
  union all
  select 'Rangos · columna productos.espec_km',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'espec_km')
  union all
  select 'Rangos · columna productos.espec_anio',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'espec_anio')
  union all
  select 'Rangos · columna productos.espec_placa_w',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'espec_placa_w')
  union all
  select 'Rangos · columna productos.espec_inversor_w',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'productos'
                    and column_name = 'espec_inversor_w')
  union all
  select 'Rangos · índices espec_km / espec_anio / espec_placa_w / espec_inversor_w',
         (select count(*) from pg_indexes
           where indexname in ('productos_espec_km_idx', 'productos_espec_anio_idx',
                               'productos_espec_placa_w_idx', 'productos_espec_inversor_w_idx')) = 4
)
select case when ok then '✅ OK' else '❌ FALTA' end as estado, nombre
from checks
order by ok asc, nombre;
