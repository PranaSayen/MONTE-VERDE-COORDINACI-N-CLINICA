export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const db = getDb();
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

  const result = db.prepare(
    'UPDATE pedidos SET status = ?, observation = ? WHERE id = ?'
  ).run(status, observation?.trim() || null, params.id);

  if (result.changes === 0) {
    return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(params.id);
  return Response.json(pedido);
}
