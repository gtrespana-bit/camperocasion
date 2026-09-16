-- Añadir columna seller_telefono y seller_nombre a productos si no existen
ALTER TABLE productos ADD COLUMN IF NOT EXISTS seller_telefono text;
