import * as dotenv from 'dotenv'
import * as path from 'path'

// Cargar .env.local para tests de integración (necesitan Supabase real)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('⚠️  Tests de integración requieren NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local')
}
