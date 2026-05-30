import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { PRODUCTOS_SEED } from '@/lib/constants';

let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada.');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

export async function initDb() {
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      staff_name TEXT NOT NULL,
      items TEXT NOT NULL,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'pendiente',
      observation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      week_number INTEGER NOT NULL,
      year INTEGER NOT NULL
    )
  `;

  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS missing_items TEXT`;
  await sql`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS day_reason TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS inventario (
      id SERIAL PRIMARY KEY,
      id_interno TEXT UNIQUE,
      categoria TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      marca TEXT,
      presentacion TEXT,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      stock INTEGER NOT NULL DEFAULT 0,
      ubicacion TEXT DEFAULT 'Bodega'
    )
  `;

  // Migrate old schema: add missing columns if they don't exist
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS id_interno TEXT`;
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS categoria TEXT`;
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS descripcion TEXT`;
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS marca TEXT`;
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS presentacion TEXT`;
  await sql`ALTER TABLE inventario ADD COLUMN IF NOT EXISTS ubicacion TEXT DEFAULT 'Bodega'`;

  // Add unique constraint on id_interno if missing (ignore error if already exists)
  try {
    await sql`ALTER TABLE inventario ADD CONSTRAINT inventario_id_interno_key UNIQUE (id_interno)`;
  } catch { /* constraint already exists */ }

  // Seed if id_interno is not populated (old data or empty table)
  const check = await sql`SELECT COUNT(*) as count FROM inventario WHERE id_interno IS NOT NULL`;
  if (Number(check[0].count) === 0) {
    // Clear old data and re-seed with full catalog
    await sql`DELETE FROM inventario`;
    // Bulk insert all products in a single query using unnest
    const ids         = PRODUCTOS_SEED.map(p => p.id_interno);
    const categorias  = PRODUCTOS_SEED.map(p => p.categoria);
    const nombres     = PRODUCTOS_SEED.map(p => p.nombre);
    const descs       = PRODUCTOS_SEED.map(p => p.descripcion);
    const marcas      = PRODUCTOS_SEED.map(p => p.marca);
    const presens     = PRODUCTOS_SEED.map(p => p.presentacion);
    const unidades    = PRODUCTOS_SEED.map(p => p.unidad);
    const stocks      = PRODUCTOS_SEED.map(p => p.stock);
    const ubicaciones = PRODUCTOS_SEED.map(p => p.ubicacion);

    await sql(
      `INSERT INTO inventario (id_interno, categoria, nombre, descripcion, marca, presentacion, unidad, stock, ubicacion)
       SELECT unnest($1::text[]), unnest($2::text[]), unnest($3::text[]), unnest($4::text[]),
              unnest($5::text[]), unnest($6::text[]), unnest($7::text[]), unnest($8::int[]), unnest($9::text[])
       ON CONFLICT (id_interno) DO NOTHING`,
      [ids, categorias, nombres, descs, marcas, presens, unidades, stocks, ubicaciones]
    );
  }
}

export function getISOWeek(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}
