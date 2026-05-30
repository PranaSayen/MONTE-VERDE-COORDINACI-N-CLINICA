export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getSql, initDb, getISOWeek } from '@/lib/db';

export async function GET(req: NextRequest) {
  await initDb();
  const sql = getSql();
  const { searchParams } = new URL(req.url);
  const staffName = searchParams.get('staff_name');
  const status = searchParams.get('status');
  const currentWeek = searchParams.get('current_week');

  if (status === 'pendiente') {
    const rows = await sql`
      SELECT * FROM pedidos WHERE status = 'pendiente' ORDER BY created_at ASC
    `;
    return Response.json(rows);
  }

  if (status === 'en_proceso') {
    const rows = await sql`
      SELECT * FROM pedidos WHERE status = 'en_proceso' ORDER BY created_at ASC
    `;
    return Response.json(rows);
  }

  if (staffName && currentWeek === '1') {
    const { week, year } = getISOWeek(new Date());
    const rows = await sql`
      SELECT COUNT(*) as count FROM pedidos
      WHERE staff_name = ${staffName} AND week_number = ${week} AND year = ${year}
    `;
    return Response.json({ count: Number(rows[0].count) });
  }

  if (staffName) {
    const rows = await sql`
      SELECT * FROM pedidos WHERE staff_name = ${staffName}
      ORDER BY created_at DESC LIMIT 20
    `;
    return Response.json(rows);
  }

  const rows = await sql`
    SELECT * FROM pedidos WHERE status != 'pendiente'
    ORDER BY created_at DESC LIMIT 20
  `;
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  await initDb();
  const sql = getSql();
  const body = await req.json();
  const { staff_name, items, reason, day_reason } = body;

  if (!staff_name || !items || !Array.isArray(items)) {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const hasItems = items.some((i: { qty: number }) => i.qty > 0);
  if (!hasItems) {
    return Response.json({ error: 'Debes solicitar al menos un insumo.' }, { status: 400 });
  }

  const today = new Date();
  const isMonday = today.getDay() === 1;

  if (!isMonday && !day_reason?.trim()) {
    return Response.json(
      { error: 'Debes indicar el motivo para solicitar fuera del lunes.' },
      { status: 400 }
    );
  }

  const { week, year } = getISOWeek(today);

  const existing = await sql`
    SELECT COUNT(*) as count FROM pedidos
    WHERE staff_name = ${staff_name} AND week_number = ${week} AND year = ${year}
  `;

  if (Number(existing[0].count) >= 1 && !reason?.trim()) {
    return Response.json(
      { error: 'Este es tu segundo pedido de la semana. Debes indicar una razón.' },
      { status: 400 }
    );
  }

  const itemsJson = JSON.stringify(items);
  const reasonVal = reason?.trim() || null;
  const dayReasonVal = isMonday ? null : (day_reason?.trim() || null);

  const rows = await sql`
    INSERT INTO pedidos (staff_name, items, reason, day_reason, week_number, year)
    VALUES (${staff_name}, ${itemsJson}, ${reasonVal}, ${dayReasonVal}, ${week}, ${year})
    RETURNING *
  `;

  // Check for stock alerts on requested items
  const requestedItems = items.filter((i: { qty: number }) => i.qty > 0);
  const stockAlerts: string[] = [];
  for (const item of requestedItems) {
    const inv = await sql`SELECT stock, nombre FROM inventario WHERE nombre = ${item.name}`;
    if (inv.length > 0 && Number(inv[0].stock) === 0) {
      stockAlerts.push(item.name);
    }
  }

  const responseBody: Record<string, unknown> = { ...rows[0] };
  if (stockAlerts.length > 0) {
    responseBody.stock_alerts = stockAlerts;
  }

  return Response.json(responseBody, { status: 201 });
}
