'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Pedido {
  id: number;
  staff_name: string;
  items: string;
  reason: string | null;
  status: string;
  observation: string | null;
  created_at: string;
  week_number: number;
  year: number;
}

interface ParsedItem {
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

export default function BodegaPage() {
  const router = useRouter();
  const [pending, setPending] = useState<Pedido[]>([]);
  const [historial, setHistorial] = useState<Pedido[]>([]);
  const [inventario, setInventario] = useState<InventarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [observation, setObservation] = useState('');
  const [obsError, setObsError] = useState('');
  const [processing, setProcessing] = useState<number | null>(null);
  const [stockInputs, setStockInputs] = useState<Record<number, string>>({});
  const [stockUpdating, setStockUpdating] = useState<number | null>(null);

  const fetchInventario = useCallback(async () => {
    try {
      const res = await fetch('/api/inventario');
      const data = await res.json();
      if (Array.isArray(data)) {
        setInventario(data);
        setStockInputs((prev) => {
          const next: Record<number, string> = { ...prev };
          for (const item of data as InventarioItem[]) {
            if (!(item.id in next)) {
              next[item.id] = String(item.stock);
            }
          }
          return next;
        });
      }
    } catch {
      // silent fail
    }
  }, []);

  const fetchPedidos = useCallback(async () => {
    try {
      const [pendRes, histRes] = await Promise.all([
        fetch('/api/pedidos?status=pendiente'),
        fetch('/api/pedidos'),
      ]);
      const pendData = await pendRes.json();
      const histData = await histRes.json();
      setPending(Array.isArray(pendData) ? pendData : []);
      setHistorial(Array.isArray(histData) ? histData.filter((p: Pedido) => p.status !== 'pendiente') : []);
    } catch {
      // silent fail on refresh
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem('session');
    if (!raw) {
      router.replace('/');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (parsed.role !== 'bodega') {
        router.replace('/');
        return;
      }
    } catch {
      localStorage.removeItem('session');
      router.replace('/');
      return;
    }
    fetchPedidos();
    fetchInventario();
    const interval = setInterval(() => {
      fetchPedidos();
      fetchInventario();
    }, 30000);
    return () => clearInterval(interval);
  }, [router, fetchPedidos, fetchInventario]);

  const handleApprove = async (id: number) => {
    setProcessing(id);
    try {
      await fetch(`/api/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'aprobado' }),
      });
      await fetchPedidos();
      await fetchInventario();
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectConfirm = async (id: number) => {
    if (!observation.trim()) {
      setObsError('La observación es obligatoria para rechazar.');
      return;
    }
    setProcessing(id);
    try {
      await fetch(`/api/pedidos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rechazado', observation: observation.trim() }),
      });
      setRejectId(null);
      setObservation('');
      setObsError('');
      await fetchPedidos();
    } finally {
      setProcessing(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('session');
    router.push('/');
  };

  const handleStockUpdate = async (item: InventarioItem) => {
    const newStock = parseInt(stockInputs[item.id] ?? String(item.stock));
    if (isNaN(newStock) || newStock < 0) return;
    setStockUpdating(item.id);
    try {
      await fetch(`/api/inventario/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stock: newStock }),
      });
      await fetchInventario();
    } finally {
      setStockUpdating(null);
    }
  };

  const parseItems = (itemsJson: string): ParsedItem[] => {
    try {
      return JSON.parse(itemsJson);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const outOfStock = inventario.filter((i) => i.stock === 0);

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
            <p className="text-emerald-100 text-sm">Panel de Bodega</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-emerald-800 hover:bg-emerald-700 text-white text-sm font-medium px-3 py-2 rounded-xl transition-colors"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Stock Alert Banner */}
        {outOfStock.length > 0 && (
          <div className="bg-red-50 border-2 border-red-500 rounded-xl p-4 mb-6">
            <p className="font-bold text-red-700 text-base mb-2">
              ⚠️ PRODUCTOS SIN STOCK — REABASTECER CON PRIORIDAD
            </p>
            <p className="text-red-600 text-sm font-semibold mb-2">Reabastecer antes de aprobar</p>
            <ul className="space-y-1">
              {outOfStock.map((item) => (
                <li key={item.id} className="text-red-700 text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" />
                  {item.nombre}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending count badge */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-2xl font-bold text-emerald-800">Pedidos Pendientes</h2>
          {pending.length > 0 && (
            <span className="bg-yellow-400 text-yellow-900 font-bold text-sm px-3 py-1 rounded-full">
              {pending.length}
            </span>
          )}
        </div>

        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-8 text-center text-gray-500 mb-8">
            No hay pedidos pendientes en este momento.
          </div>
        ) : (
          <div className="space-y-4 mb-10">
            {pending.map((pedido) => {
              const items = parseItems(pedido.items);
              const isRejecting = rejectId === pedido.id;

              return (
                <div key={pedido.id} className="bg-white rounded-2xl shadow-md p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-bold text-gray-800 text-lg">{pedido.staff_name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{formatDate(pedido.created_at)}</p>
                    </div>
                    <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">
                      Pendiente
                    </span>
                  </div>

                  {/* Items list */}
                  <ul className="space-y-1 mb-3">
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="w-2 h-2 bg-emerald-500 rounded-full flex-shrink-0" />
                        <span className="font-medium">{item.qty}</span>
                        <span>{item.unit}{item.qty > 1 ? 's' : ''}</span>
                        <span className="text-gray-500">de {item.name}</span>
                      </li>
                    ))}
                  </ul>

                  {pedido.reason && (
                    <div className="bg-gray-50 rounded-xl px-3 py-2 mb-4 text-sm text-gray-600">
                      <span className="font-semibold text-gray-700">Razón: </span>
                      {pedido.reason}
                    </div>
                  )}

                  {/* Action buttons */}
                  {!isRejecting && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApprove(pedido.id)}
                        disabled={processing === pedido.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-2.5 min-h-12 transition-colors"
                      >
                        {processing === pedido.id ? 'Procesando...' : '✓ Aprobar'}
                      </button>
                      <button
                        onClick={() => {
                          setRejectId(pedido.id);
                          setObservation('');
                          setObsError('');
                        }}
                        disabled={processing === pedido.id}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-2.5 min-h-12 transition-colors"
                      >
                        ✗ Rechazar
                      </button>
                    </div>
                  )}

                  {/* Rejection form */}
                  {isRejecting && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">
                          Observación del rechazo <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          value={observation}
                          onChange={(e) => {
                            setObservation(e.target.value);
                            setObsError('');
                          }}
                          rows={3}
                          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                          placeholder="Explica el motivo del rechazo..."
                          autoFocus
                        />
                        {obsError && (
                          <p className="text-red-600 text-xs mt-1">{obsError}</p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleRejectConfirm(pedido.id)}
                          disabled={processing === pedido.id}
                          className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white font-semibold rounded-xl py-2.5 transition-colors"
                        >
                          {processing === pedido.id ? 'Rechazando...' : 'Confirmar rechazo'}
                        </button>
                        <button
                          onClick={() => {
                            setRejectId(null);
                            setObservation('');
                            setObsError('');
                          }}
                          className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl py-2.5 transition-colors"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Historial */}
        <h2 className="text-xl font-bold text-emerald-800 mb-4">Historial Reciente</h2>
        {historial.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center text-gray-500">
            No hay pedidos procesados aún.
          </div>
        ) : (
          <div className="space-y-3 mb-10">
            {historial.map((pedido) => {
              const items = parseItems(pedido.items);
              const isApproved = pedido.status === 'aprobado';

              return (
                <div key={pedido.id} className="bg-white rounded-2xl shadow-md p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-800">{pedido.staff_name}</p>
                      <p className="text-gray-400 text-xs">{formatDate(pedido.created_at)}</p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {isApproved ? '✓ Aprobado' : '✗ Rechazado'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => (
                      <span
                        key={item.id}
                        className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-lg"
                      >
                        {item.qty} {item.unit} {item.name}
                      </span>
                    ))}
                  </div>
                  {!isApproved && pedido.observation && (
                    <p className="text-xs text-red-600 mt-2">
                      <span className="font-semibold">Obs: </span>
                      {pedido.observation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Gestionar Stock */}
        <h2 className="text-xl font-bold text-emerald-800 mb-4">Gestionar Stock</h2>
        {inventario.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-6 text-center text-gray-500">
            Cargando inventario...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            {inventario.map((item) => {
              const isZero = item.stock === 0;
              return (
                <div
                  key={item.id}
                  className={`rounded-2xl shadow-md p-4 flex flex-col gap-3 ${
                    isZero ? 'bg-red-50' : 'bg-emerald-50'
                  }`}
                >
                  <div>
                    <p className="font-semibold text-gray-800 text-sm leading-tight">{item.nombre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Unidad: {item.unidad}</p>
                    <p className={`text-sm font-bold mt-1 ${isZero ? 'text-red-600' : 'text-emerald-700'}`}>
                      Stock actual: {item.stock}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      value={stockInputs[item.id] ?? String(item.stock)}
                      onChange={(e) =>
                        setStockInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                      }
                      className="flex-1 border border-gray-300 rounded-xl text-center py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      onClick={() => handleStockUpdate(item)}
                      disabled={stockUpdating === item.id}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white text-sm font-semibold px-3 py-2 rounded-xl transition-colors whitespace-nowrap"
                    >
                      {stockUpdating === item.id ? '...' : 'Actualizar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
