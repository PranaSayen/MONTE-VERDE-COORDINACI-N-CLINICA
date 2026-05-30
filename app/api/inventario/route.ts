export const runtime = 'nodejs';

import { getSql, initDb } from '@/lib/db';

export async function GET() {
  await initDb();
  const sql = getSql();
  const rows = await sql`SELECT * FROM inventario ORDER BY id_interno`;
  return Response.json(rows);
}
