-- ═══════════════════════════════════════════════════════════════════════════
-- 202609180002 — El registro hereda el tipo de vendedor elegido al crear cuenta
--
-- El formulario de registro pregunta "¿Qué tipo de vendedor eres?" y el valor
-- viaja en `user_metadata` (generateLink → auth.users.raw_user_meta_data).
-- El trigger `crear_perfil()` (ON auth.users AFTER INSERT) ahora lo copia a
-- `perfiles.tipo_vendedor`, validado contra los tres valores permitidos:
-- cualquier otra cosa (o ausencia) cae en 'particular'.
--
-- Requiere 202609180001 (perfiles.tipo_vendedor).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfiles (id, nombre, telefono, estado, ciudad, tipo_vendedor)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'telefono', ''),
    coalesce(new.raw_user_meta_data->>'estado', ''),
    coalesce(new.raw_user_meta_data->>'ciudad', ''),
    case
      when new.raw_user_meta_data->>'tipo_vendedor'
        in ('particular', 'camperizador', 'profesional')
      then new.raw_user_meta_data->>'tipo_vendedor'
      else 'particular'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
