'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { STAFF_PIN, BODEGA_PIN } from '@/lib/constants';

export default function LoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect
    const session = localStorage.getItem('session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.role === 'staff') router.replace('/solicitar');
        else if (parsed.role === 'bodega') router.replace('/bodega');
      } catch {
        localStorage.removeItem('session');
      }
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (pin === BODEGA_PIN) {
      localStorage.setItem('session', JSON.stringify({ role: 'bodega', name: 'Bodega' }));
      router.push('/bodega');
      return;
    }

    if (pin === STAFF_PIN) {
      if (!name.trim()) {
        setError('Por favor ingresa tu nombre.');
        setLoading(false);
        return;
      }
      localStorage.setItem('session', JSON.stringify({ role: 'staff', name: name.trim() }));
      router.push('/solicitar');
      return;
    }

    setError('PIN incorrecto. Inténtalo de nuevo.');
    setLoading(false);
    setPin('');
  };

  const showNameField = pin.length > 0 && pin !== BODEGA_PIN;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center mb-3">
          <div className="bg-emerald-600 rounded-full p-4 shadow-lg">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-emerald-800">Clínica Monte Verde</h1>
        <p className="text-emerald-600 mt-1 text-sm">Sistema de Pedidos de Insumos</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">Iniciar Sesión</h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="pin">
              PIN de acceso
            </label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ''));
                setError('');
              }}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-2xl tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              placeholder="••••"
              autoFocus
              required
            />
          </div>

          {showNameField && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">
                Tu nombre completo
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                placeholder="Ej: María González"
                required
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || pin.length !== 4}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 min-h-12 transition-colors duration-200"
          >
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-6">
          Personal: PIN 1234 · Bodega: PIN 9999
        </p>
      </div>
    </div>
  );
}
