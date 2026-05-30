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

  if (!['aprobado', 'rechazado', 'completado'].includes(status)) {
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

  // Handle 'completado': bodega manually confirms all items delivered → set to 'aprobado'
  if (status === 'completado') {
    const rows = await sql`
      UPDATE pedidos SET status = 'aprobado', missing_items = NULL
      WHERE id = ${id}
      RETURNING *
    `;
    if (rows.length === 0) {
      return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
    }
    return Response.json(rows[0]);
  }

  // For 'rechazado', just update directly
  if (status === 'rechazado') {
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

  // status === 'aprobado': run stock check logic
  // First fetch the pedido to get items
  const pedidoRows = await sql`SELECT * FROM pedidos WHERE id = ${id}`;
  if (pedidoRows.length === 0) {
    return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }
  const pedido = pedidoRows[0];

  let parsedItems: Array<{ id: string; name: string; unit: string; qty: number }> = [];
  try {
    parsedItems = JSON.parse(pedido.items);
  } catch {
    // If parsing fails, treat as no items
  }

  const outOfStockItems: string[] = [];
  for (const item of parsedItems) {
    if (item.qty > 0) {
      const inv = await sql`SELECT stock, nombre FROM inventario WHERE nombre = ${item.name}`;
      if (inv.length > 0 && Number(inv[0].stock) === 0) {
        outOfStockItems.push(item.name);
      }
    }
  }

  // Deduct stock for items that DO have stock
  for (const item of parsedItems) {
    if (item.qty > 0) {
      const inv = await sql`SELECT id, stock FROM inventario WHERE nombre = ${item.name}`;
      if (inv.length > 0 && Number(inv[0].stock) > 0) {
        const invId = inv[0].id;
        await sql`
          UPDATE inventario
          SET stock = GREATEST(0, stock - ${item.qty})
          WHERE id = ${invId}
        `;
      }
    }
  }

  const finalStatus = outOfStockItems.length > 0 ? 'en_proceso' : 'aprobado';
  const missingItemsVal = outOfStockItems.length > 0 ? JSON.stringify(outOfStockItems) : null;

  const rows = await sql`
    UPDATE pedidos
    SET status = ${finalStatus}, observation = ${obsVal}, missing_items = ${missingItemsVal}
    WHERE id = ${id}
    RETURNING *
  `;

  if (rows.length === 0) {
    return Response.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  return Response.json(rows[0]);
}
