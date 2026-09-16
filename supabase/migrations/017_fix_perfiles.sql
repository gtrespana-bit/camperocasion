-- Migration 017: Fix trigger crear_perfil para que lea metadata del registro
-- y guarde nombre, telefono, estado, ciudad

CREATE OR REPLACE FUNCTION crear_perfil()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (id, nombre, telefono, estado, ciudad)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'telefono', ''),
    COALESCE(NEW.raw_user_meta_data->>'estado', ''),
    COALESCE(NEW.raw_user_meta_data->>'ciudad', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't block registration
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger if it doesn't already exist
DROP TRIGGER IF EXISTS crear_perfil_trigger ON auth.users;
CREATE TRIGGER crear_perfil_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION crear_perfil();
