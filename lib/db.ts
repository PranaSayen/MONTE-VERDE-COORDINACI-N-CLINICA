import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { INSUMOS } from '@/lib/constants';

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
      id INTEGER PRIMARY KEY,
      nombre TEXT NOT NULL,
      unidad TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0
    )
  `;

  const count = await sql`SELECT COUNT(*) as count FROM inventario`;
  if (Number(count[0].count) === 0) {
    for (let i = 0; i < INSUMOS.length; i++) {
      const insumo = INSUMOS[i];
      await sql`
        INSERT INTO inventario (id, nombre, unidad, stock)
        VALUES (${i + 1}, ${insumo.name}, ${insumo.unit}, 20)
        ON CONFLICT (id) DO NOTHING
      `;
    }
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
