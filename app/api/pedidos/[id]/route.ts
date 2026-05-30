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
  const { status, observation } = body;

  if (!['aprobado', 'rechazado'].includes(status)) {
    return Response.json({ error: 'Estado inválido' }, { status: 400 });
  }

  if (status === 'rechazado' && !observation?.trim()) {
    return Response.json(
      { error: 'La observación es obligatoria al rechazar un pedido.' },
      { status: 400 }
    );
  }

  const id = Number(params.id);
  const obsVal = observation?.trim() || null;

  const rows = await sql`
    UPDATE pedidos SET status = ${status}, observation = ${obsVal}
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0) {
    return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  // Deduct stock when approving
  if (status === 'aprobado') {
    try {
      const parsedItems: Array<{ id: string; name: string; unit: string; qty: number }> = JSON.parse(rows[0].items);
      for (const item of parsedItems) {
        if (item.qty > 0) {
          const inv = await sql`SELECT id FROM inventario WHERE nombre = ${item.name}`;
          if (inv.length > 0) {
            const invId = inv[0].id;
            await sql`
              UPDATE inventario
              SET stock = GREATEST(0, stock - ${item.qty})
              WHERE id = ${invId}
            `;
          }
        }
      }
    } catch {
      // If items parsing fails, skip stock deduction silently
    }
  }

  return Response.json(rows[0]);
}
