export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { sql, initDb } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  await initDb();
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

  return Response.json(rows[0]);
}
