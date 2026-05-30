export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { getSql, initDb, seedInventario } from '@/lib/db';

export async function GET() {
  try {
    const sql = getSql();

    // Drop inventario to force clean recreation
    await sql`DROP TABLE IF EXISTS inventario`;

    // Recreate all tables
    await initDb();

    // Seed products
    await seedInventario(sql);

    const count = await sql`SELECT COUNT(*) as count FROM inventario`;

    return Response.json({
      ok: true,
      productos_cargados: Number(count[0].count),
      mensaje: `Inventario listo con ${count[0].count} productos.`,
    });
  } catch (err) {
    return Response.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
