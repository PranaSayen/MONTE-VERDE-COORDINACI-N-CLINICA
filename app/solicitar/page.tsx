'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORIAS } from '@/lib/constants';
import Link from 'next/link';

interface Session {
  role: string;
  name: string;
}

interface InventarioItem {
  id: number;
  id_interno: string;
  categoria: string;
  nombre: string;
  descripcion: string;
  marca: string;
  presentacion: string;
  unidad: string;
  stock: number;
  ubicacion: string;
}

interface CartItem {
  id_interno: string;
  nombre: string;
  unidad: string;
  qty: number;
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function stockBadge(stock: number) {
  if (stock === 0) {
    return (
      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
        Sin stock
      </span>
    );
  } else if (stock <= 5) {
    return (
      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
        Stock bajo: {stock}
      </span>
    );
  }
  return (
    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
      Stock: {stock}
    </span>
  );
}

export default function SolicitarPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isMonday, setIsMonday] = useState(true);
  const [todayName, setTodayName] = useState('');
  const [weekCount, setWeekCount] = useState(0);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [dayReason, setDayReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const [busqueda, setBusqueda] = useState('');

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

      Promise.all([
        fetch(`/api/pedidos?staff_name=${encodeURIComponent(parsed.name)}&current_week=1`).then((r) => r.json()),
        fetch('/api/inventario').then((r) => r.json()),
      ])
        .then(([countData, invData]) => {
          setWeekCount(countData.count ?? 0);
          if (Array.isArray(invData)) {
            setInventario(invData);
            const initQty: Record<string, number> = {};
            for (const item of invData as InventarioItem[]) {
              initQty[item.id_interno] = 0;
            }
            setQuantities(initQty);
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } catch {
      localStorage.removeItem('session');
      router.replace('/');
    }
  }, [router]);

  const handleQtyChange = (id_interno: string, value: number) => {
    setQuantities((prev) => ({ ...prev, [id_interno]: Math.max(0, Math.min(99, value)) }));
  };

  const productosFiltrados = useMemo(() => {
    let lista = inventario;
    if (categoriaFiltro !== 'Todos') {
      lista = lista.filter((i) => i.categoria === categoriaFiltro);
    }
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase();
      lista = lista.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          i.descripcion.toLowerCase().includes(q) ||
          i.marca.toLowerCase().includes(q)
      );
    }
    return lista;
  }, [inventario, categoriaFiltro, busqueda]);

  const selectedCount = useMemo(
    () => Object.values(quantities).filter((q) => q > 0).length,
    [quantities]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isMonday && !dayReason.trim()) {
      setError('Debes indicar el motivo para solicitar fuera del lunes.');
      return;
    }

    const items: CartItem[] = inventario
      .filter((i) => (quantities[i.id_interno] ?? 0) > 0)
      .map((i) => ({
        id_interno: i.id_interno,
        nombre: i.nombre,
        unidad: i.unidad,
        qty: quantities[i.id_interno],
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
      setQuantities((prev) => {
        const reset: Record<string, number> = {};
        for (const k of Object.keys(prev)) reset[k] = 0;
        return reset;
      });
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
    <div className="min-h-screen p-4 pb-32">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-4">
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
        <h2 className="text-2xl font-bold text-emerald-800 mb-1">Solicitar Insumos</h2>
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
          <div className="bg-yellow-50 border border-yellow-300 rounded-2xl p-4 mb-4">
            <p className="text-yellow-800 font-medium text-sm">
              ⚠️ Ya realizaste {weekCount} pedido{weekCount > 1 ? 's' : ''} esta semana. Este será
              un pedido adicional y requiere una razón obligatoria.
            </p>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, descripción o marca..."
          className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />

        {/* Category filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
          {['Todos', ...CATEGORIAS].map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoriaFiltro(cat)}
              className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
                categoriaFiltro === cat
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-emerald-400'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Product list */}
          <div className="space-y-2 mb-6">
            {productosFiltrados.length === 0 && (
              <div className="text-center text-gray-400 py-8 text-sm">
                No se encontraron productos.
              </div>
            )}
            {productosFiltrados.map((item) => {
              const qty = quantities[item.id_interno] ?? 0;
              const isSelected = qty > 0;
              return (
                <div
                  key={item.id_interno}
                  className={`rounded-2xl border p-4 flex items-center gap-3 transition-colors ${
                    isSelected
                      ? 'bg-emerald-50 border-emerald-400 shadow-sm'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{item.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{item.descripcion}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.presentacion}</p>
                    <div className="mt-1">{stockBadge(item.stock)}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id_interno, qty - 1)}
                      className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg text-lg font-bold text-gray-600 flex items-center justify-center transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={qty}
                      onChange={(e) => handleQtyChange(item.id_interno, parseInt(e.target.value) || 0)}
                      className="w-12 border border-gray-300 rounded-lg text-center py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id_interno, qty + 1)}
                      className="w-8 h-8 bg-emerald-100 hover:bg-emerald-200 rounded-lg text-lg font-bold text-emerald-700 flex items-center justify-center transition-colors"
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

      {/* Sticky cart summary */}
      {selectedCount > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-50 max-w-2xl mx-auto">
          <div className="bg-emerald-700 text-white rounded-2xl px-5 py-3 flex items-center justify-between shadow-lg">
            <span className="font-semibold text-sm">
              {selectedCount} producto{selectedCount > 1 ? 's' : ''} seleccionado{selectedCount > 1 ? 's' : ''}
            </span>
            <span className="text-emerald-200 text-xs">Desplázate al final para enviar</span>
          </div>
        </div>
      )}
    </div>
  );
}
