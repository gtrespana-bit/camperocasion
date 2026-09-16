-- ============================================
-- MIGRACIÓN: Sistema "Marcar como Vendido"
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Agregar columnas a la tabla productos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS vendido BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vendido_en TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS comprador_id UUID DEFAULT NULL REFERENCES auth.users(id);

-- 2. Índice para buscar productos vendidos
CREATE INDEX IF NOT EXISTS idx_productos_vendido ON productos(vendido) WHERE vendido = TRUE;

-- Optional: Comentario para documentar
COMMENT ON COLUMN productos.vendido IS 'Indica si el producto fue vendido';
COMMENT ON COLUMN productos.vendido_en IS 'Dónde se vendió: "plataforma", "otra_pagina", "no_especificado"';
COMMENT ON COLUMN productos.comprador_id IS 'ID del comprador (usuario que compró a través de la plataforma)';
