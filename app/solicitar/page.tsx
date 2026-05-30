'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { INSUMOS } from '@/lib/constants';
import Link from 'next/link';

interface Session {
  role: string;
  name: string;
}

interface ItemQty {
  id: string;
  name: string;
  unit: string;
  qty: number;
}

interface InventarioItem {
  id: number;
  nombre: string;
  unidad: string;
  stock: number;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function SolicitarPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isMonday, setIsMonday] = useState(true);
  const [todayName, setTodayName] = useState('');
  const [weekCount, setWeekCount] = useState(0);
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(INSUMOS.map((i) => [i.id, 0]))
  );
  const [reason, setReason] = useState('');
  const [dayReason, setDayReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem('session');
    if (!raw) {
      router.replace('/');
      return;
    }
    try {
      const parsed: Session = JSON.parse(raw);
      if (parsed.role !== 'staff') {
        router.replace('/');
        return;
      }
      setSession(parsed);

      const today = new Date();
      const day = today.getDay();
      setIsMonday(day === 1);
      setTodayName(DAY_NAMES[day]);

      // Fetch week count and inventario in parallel
      Promise.all([
        fetch(`/api/pedidos?staff_name=${encodeURIComponent(parsed.name)}&current_week=1`).then((r) => r.json()),
        fetch('/api/inventario').then((r) => r.json()),
      ])
        .then(([countData, invData]) => {
          setWeekCount(countData.count ?? 0);
          if (Array.isArray(invData)) setInventario(invData);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      localStorage.removeItem('session');
      router.replace('/');
    }
  }, [router]);

  const handleQtyChange = (id: string, value: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(0, Math.min(99, value)) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isMonday && !dayReason.trim()) {
      setError('Debes indicar el motivo para solicitar fuera del lunes.');
      return;
    }

    const items: ItemQty[] = INSUMOS.filter((i) => quantities[i.id] > 0).map((i) => ({
      id: i.id,
      name: i.name,
      unit: i.unit,
      qty: quantities[i.id],
    }));

    if (items.length === 0) {
      setError('Debes seleccionar al menos un insumo con cantidad mayor a 0.');
      return;
    }

    if (weekCount >= 1 && !reason.trim()) {
      setError('Debes ingresar una razón para el segundo pedido de la semana.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_name: session?.name,
          items,
          reason: reason.trim() || null,
          day_reason: isMonday ? null : dayReason.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Error al enviar el pedido.');
        setSubmitting(false);
        return;
      }

      setSuccessMsg('¡Pedido enviado correctamente! Bodega lo revisará pronto.');
      setQuantities(Object.fromEntries(INSUMOS.map((i) => [i.id, 0])));
      setReason('');
      setDayReason('');
      setWeekCount((c) => c + 1);
    } catch {
      setError('Error de conexión. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('session');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-emerald-600 text-lg">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="bg-emerald-600 rounded-2xl p-4 text-white flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Clínica Monte Verde</h1>
            <p className="text-emerald-100 text-sm">Hola, {session?.name} — {todayName}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/estado"
              className="bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            >
              Mis pedidos
            </Link>
            <button
              onClick={handleLogout}
              className="bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
            >
              Salir
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-emerald-800 mb-2">Solicitar Insumos</h2>
        <p className="text-gray-500 text-sm mb-4">
          Selecciona los insumos que necesitas y las cantidades.
        </p>

        {/* Non-Monday warning */}
        {!isMonday && (
          <div className="bg-yellow-50 border border-yellow-400 rounded-2xl p-4 mb-4">
            <p className="text-yellow-800 font-semibold text-sm">
              ⚠️ Estás haciendo un pedido fuera del lunes. Debes indicar el motivo.
            </p>
          </div>
        )}

        {weekCount >= 1 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-6">
            <p className="text-yellow-800 font-medium text-sm">
              ⚠️ Ya realizaste {weekCount} pedido{weekCount > 1 ? 's' : ''} esta semana. Este será
              un pedido adicional y requiere una razón obligatoria.
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Items grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {INSUMOS.map((insumo) => {
              const invItem = inventario.find((i) => i.nombre === insumo.name);
              const stock = invItem?.stock ?? null;
              let stockBadge: React.ReactNode = null;
              if (stock !== null) {
                if (stock === 0) {
                  stockBadge = (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                      Sin stock
                    </span>
                  );
                } else if (stock <= 5) {
                  stockBadge = (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      Stock bajo: {stock}
                    </span>
                  );
                } else {
                  stockBadge = (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                      Stock: {stock}
                    </span>
                  );
                }
              }
              return (
              <div
                key={insumo.id}
                className="bg-white rounded-2xl shadow-md p-4 flex flex-col gap-3"
              >
                <div>
                  <p className="font-semibold text-gray-800 text-sm leading-tight">{insumo.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Unidad: {insumo.unit}</p>
                  {stockBadge && <div className="mt-1">{stockBadge}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQtyChange(insumo.id, quantities[insumo.id] - 1)}
                    className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-xl text-xl font-bold text-gray-600 flex items-center justify-center transition-colors"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={quantities[insumo.id]}
                    onChange={(e) => handleQtyChange(insumo.id, parseInt(e.target.value) || 0)}
                    className="flex-1 border border-gray-300 rounded-xl text-center py-2 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleQtyChange(insumo.id, quantities[insumo.id] + 1)}
                    className="w-10 h-10 bg-emerald-100 hover:bg-emerald-200 rounded-xl text-xl font-bold text-emerald-700 flex items-center justify-center transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              );
            })}
          </div>

          {/* Day reason field (mandatory if not Monday) */}
          {!isMonday && (
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="day_reason">
                Razón para solicitar fuera del lunes <span className="text-red-500">*</span>
              </label>
              <textarea
                id="day_reason"
                value={dayReason}
                onChange={(e) => setDayReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none"
                placeholder="Explica por qué necesitas hacer el pedido hoy..."
                required
              />
            </div>
          )}

          {/* Reason field (mandatory on second request) */}
          {weekCount >= 1 && (
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="reason">
                Razón del pedido adicional <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Explica por qué necesitas un pedido adicional esta semana..."
                required
              />
            </div>
          )}

          {/* Optional reason for first request on Monday */}
          {weekCount === 0 && isMonday && (
            <div className="bg-white rounded-2xl shadow-md p-4 mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="reason">
                Razón o comentario (opcional)
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                placeholder="Comentario adicional (opcional)..."
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-300 text-emerald-700 rounded-xl px-4 py-3 text-sm mb-4 font-medium">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-2xl py-4 min-h-12 text-lg transition-colors"
          >
            {submitting ? 'Enviando...' : 'Enviar Pedido'}
          </button>
        </form>
      </div>
    </div>
  );
}
