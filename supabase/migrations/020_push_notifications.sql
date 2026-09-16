-- Cola de notificaciones push pendientes
CREATE TABLE IF NOT EXISTS notificaciones_push (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo text NOT NULL,
    titulo text NOT NULL,
    cuerpo text NOT NULL,
    click_url text DEFAULT '/',
    procesada boolean DEFAULT false,
    creado_en timestamptz DEFAULT now()
);

CREATE INDEX idx_notificaciones_push_pending ON notificaciones_push (target_user_id, procesada) WHERE procesada = false;
