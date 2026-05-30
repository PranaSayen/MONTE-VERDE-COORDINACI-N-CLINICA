'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Item {
  id: string;
  name: string;
  unit: string;
  qty: number;
}

interface Pedido {
  id: number;
  staff_name: string;
  items: string;
  reason: string | null;
  status: 'pendiente' | 'aprobado' | 'rechazado' | 'en_proceso';
  observation: string | null;
  created_at: string;
  missing_items: string | null;
}

export default function EstadoPage() {
  const router = useRouter();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPedidos = useCallback(async (name: string) => {
    const res = await fetch(`/api/pedidos?staff_name=${encodeURIComponent(name)}`);
    setPedidos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('session');
    if (!session) { router.replace('/'); return; }
    try {
      const parsed = JSON.parse(session);
      if (parsed.role !== 'staff') { router.replace('/'); return; }
      setStaffName(parsed.name);
      fetchPedidos(parsed.name);
    } catch {
      router.replace('/');
    }
  }, [router, fetchPedidos]);

  const logout = () => {
    localStorage.removeItem('session');
    router.push('/');
  };

  const parseItems = (raw: string): Item[] => {
    try { return JSON.parse(raw); } catch { return []; }
  };

  const formatDate = (dt: string) =>
    new Date(dt).toLocaleDateString('es-CL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-emerald-600 text-lg">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-emerald-600 text-white px-4 py-4 flex items-center justify-between shadow">
        <div>
          <h1 className="text-xl font-bold">Mis Pedidos</h1>
          <p className="text-emerald-100 text-xs">{staffName}</p>
        </div>
        <button onClick={logout} className="text-emerald-100 text-sm underline">
          Salir
        </button>
      </div>

      <div className="max-w-md mx-auto px-4 mt-6 space-y-4">
        <Link
          href="/solicitar"
          className="block text-center bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold rounded-xl py-3 hover:bg-emerald-100 transition-colors"
        >
          ← Volver a solicitar
        </Link>

        {pedidos.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-6 text-center text-gray-400">
            No tienes pedidos registrados.
          </div>
        )}

        {pedidos.map((p) => {
          let missingItems: string[] = [];
          try { missingItems = p.missing_items ? JSON.parse(p.missing_items) : []; } catch { missingItems = []; }

          return (
          <div key={p.id} className="bg-white rounded-2xl shadow-md overflow-hidden">
            {p.status === 'aprobado' && (
              <div className="bg-emerald-500 text-white text-center py-3 px-4 animate-pulse">
                <p className="text-lg font-bold tracking-wide">✓ LISTO PARA RETIRAR</p>
              </div>
            )}

            {p.status === 'en_proceso' && (
              <div className="bg-amber-400 text-amber-900 text-center py-2 px-4">
                <p className="text-sm font-bold">⏳ En proceso — esperando insumos</p>
              </div>
            )}

            <div className="p-5 space-y-3">
              <div className="flex justify-between items-start">
                <p className="text-xs text-gray-400">{formatDate(p.created_at)}</p>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  p.status === 'aprobado'
                    ? 'bg-emerald-100 text-emerald-800'
                    : p.status === 'rechazado'
                    ? 'bg-red-100 text-red-800'
                    : p.status === 'en_proceso'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {p.status === 'aprobado' ? 'Aprobado'
                    : p.status === 'rechazado' ? 'Rechazado'
                    : p.status === 'en_proceso' ? 'En proceso'
                    : 'En revisión'}
                </span>
              </div>

              <ul className="space-y-1">
                {parseItems(p.items).filter(i => i.qty > 0).map((i) => (
                  <li key={i.id} className="flex justify-between text-sm text-gray-700">
                    <span>{i.name}</span>
                    <span className="font-medium">{i.qty} {i.unit}</span>
                  </li>
                ))}
              </ul>

              {p.reason && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2 text-sm text-yellow-800">
                  <span className="font-semibold">Razón: </span>{p.reason}
                </div>
              )}

              {p.status === 'en_proceso' && missingItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-sm text-amber-800">
                  <span className="font-semibold">Falta: </span>{missingItems.join(', ')}
                </div>
              )}

              {p.status === 'rechazado' && p.observation && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-800">
                  <span className="font-semibold">Observación bodega: </span>{p.observation}
                </div>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
