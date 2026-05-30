export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getDb, getISOWeek } from '@/lib/db';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const staffName = searchParams.get('staff_name');
  const status = searchParams.get('status');
  const currentWeek = searchParams.get('current_week');

  if (status === 'pendiente') {
    const rows = db.prepare(
      "SELECT * FROM pedidos WHERE status = 'pendiente' ORDER BY created_at ASC"
    ).all();
    return Response.json(rows);
  }

  if (staffName && currentWeek === '1') {
    const { week, year } = getISOWeek(new Date());
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM pedidos WHERE staff_name = ? AND week_number = ? AND year = ?'
    ).get(staffName, week, year) as { count: number };
    return Response.json({ count: row.count });
  }

  if (staffName) {
    const rows = db.prepare(
      'SELECT * FROM pedidos WHERE staff_name = ? ORDER BY created_at DESC LIMIT 20'
    ).all(staffName);
    return Response.json(rows);
  }

  // Bodega historial
  const rows = db.prepare(
    "SELECT * FROM pedidos WHERE status != 'pendiente' ORDER BY created_at DESC LIMIT 20"
  ).all();
  return Response.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { staff_name, items, reason } = body;

  if (!staff_name || !items || !Array.isArray(items)) {
    return Response.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const hasItems = items.some((i: { qty: number }) => i.qty > 0);
  if (!hasItems) {
    return Response.json({ error: 'Debes solicitar al menos un insumo.' }, { status: 400 });
  }

  // Monday check (server-side)
  const today = new Date();
  if (today.getDay() !== 1) {
    return Response.json({ error: 'Los pedidos solo se pueden hacer los lunes.' }, { status: 400 });
  }

  const db = getDb();
  const { week, year } = getISOWeek(today);

  // Check second request
  const existing = db.prepare(
    'SELECT COUNT(*) as count FROM pedidos WHERE staff_name = ? AND week_number = ? AND year = ?'
  ).get(staff_name, week, year) as { count: number };

  if (existing.count >= 1 && !reason?.trim()) {
    return Response.json(
      { error: 'Este es tu segundo pedido de la semana. Debes indicar una razón.' },
      { status: 400 }
    );
  }

  const result = db.prepare(
    'INSERT INTO pedidos (staff_name, items, reason, week_number, year) VALUES (?, ?, ?, ?, ?)'
  ).run(staff_name, JSON.stringify(items), reason?.trim() || null, week, year);

  const pedido = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(result.lastInsertRowid);
  return Response.json(pedido, { status: 201 });
}
