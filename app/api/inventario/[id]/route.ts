export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getSql, initDb } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await initDb();
  const sql = getSql();
  const body = await req.json();
  const { stock } = body;

  if (typeof stock !== 'number' || stock < 0) {
    return Response.json({ error: 'Stock inválido. Debe ser un número >= 0.' }, { status: 400 });
  }

  const id = Number(params.id);
  const rows = await sql`
    UPDATE inventario SET stock = ${stock} WHERE id = ${id} RETURNING *
  `;

  if (rows.length === 0) {
    return Response.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  return Response.json(rows[0]);
}
