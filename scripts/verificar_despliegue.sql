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

  -- Fase 1.2 — reserva con señal
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
  select 'Fase 1.2 · índice único reservas_producto_viva_key (una reserva viva)',
         exists (select 1 from pg_indexes where indexname = 'reservas_producto_viva_key')
  union all
  select 'Fase 1.2 · función fn_propagar_reserva()',
         to_regprocedure('public.fn_propagar_reserva()') is not null
  union all
  select 'Fase 1.2 · función fn_completar_reservas_al_vender()',
         to_regprocedure('public.fn_completar_reservas_al_vender()') is not null
  union all
  select 'Fase 1.2 · función fn_soy_parte_de_la_reserva(uuid)',
         to_regprocedure('public.fn_soy_parte_de_la_reserva(uuid)') is not null
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
  select 'Fase 1.2 · bucket comprobantes-reserva',
         exists (select 1 from storage.buckets where id = 'comprobantes-reserva')
  union all
  select 'Fase 1.2 · políticas de storage del comprobante (5)',
         (select count(*) from pg_policies
           where schemaname = 'storage' and tablename = 'objects'
             and policyname like 'comprobantes-reserva:%') >= 5
)
select case when ok then '✅ OK' else '❌ FALTA' end as estado, nombre
from checks
order by ok asc, nombre;
