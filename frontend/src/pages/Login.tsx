import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) {
    return null;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-body overflow-hidden">

      {/* ══ ═  LEFT: Brand / Visual Section (7/12 — Happy Car Wash Gold Obsidian Design) ══ ═  */}
      <div className="hidden lg:flex w-7/12 bg-[#1C1917] relative overflow-hidden items-center justify-center">
        {/* Tonal Depth Overlay */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#1C1917] via-[#292524]/70 to-[#1C1917]/90" />
          {/* Subtle abstract golden shapes */}
          <div className="absolute top-20 -left-20 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" />
        </div>

        {/* Brand Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 p-16 w-full max-w-2xl"
        >
          <div className="space-y-8">
            {/* Brand Identity */}
            <div className="flex flex-col gap-1">
              <h1 className="text-amber-400 font-headline font-extrabold text-4xl tracking-widest uppercase">HAPPY CAR WASH</h1>
              <p className="text-amber-300/80 font-headline font-semibold tracking-widest text-sm uppercase">Spa · Coating · Accessories</p>
            </div>

            <div className="h-1 w-24 bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" />

            <div className="space-y-6">
              <h2 className="text-white font-headline text-5xl font-bold leading-tight">
                Engineering the Future of{' '}
                <span className="text-amber-400">Car Detailing ERP.</span>
              </h2>
              <p className="text-stone-300 text-xl font-light leading-relaxed max-w-lg">
                Access the high-performance dashboard designed for operators who demand surgical precision in every job card.
              </p>
            </div>

            {/* Security Badge — Glass Panel */}
            <div className="inline-flex items-center gap-4 px-6 py-4 rounded-xl border border-amber-500/20 mt-12 bg-[#292524]/70 backdrop-blur-md">
              <span className="material-symbols-outlined text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <div>
                <p className="text-white font-semibold text-sm">Enterprise Security</p>
                <p className="text-stone-400 text-xs">AES-256 Bit Encrypted Terminal</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Speedometer Geometry */}
        <div className="absolute bottom-[-100px] right-[-100px] w-96 h-96 border-4 border-amber-500/20 rounded-full opacity-20 pointer-events-none" />
        <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 border-4 border-amber-500/40 rounded-full opacity-10 pointer-events-none" />
      </div>

      {/* ══ ═  RIGHT: Login Form Section (5/12) ══ ═  */}
      <div className="w-full lg:w-5/12 bg-white flex items-center justify-center p-8 relative">
        {/* Top-right utility actions */}
        <div className="absolute top-8 right-8 flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
            Secure Session
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="mb-10 lg:hidden">
            <h1 className="text-stone-900 font-headline font-extrabold text-2xl tracking-widest uppercase">HAPPY CAR WASH</h1>
            <p className="text-amber-600 font-headline font-semibold text-xs uppercase tracking-wider">Spa · Coating · Accessories</p>
          </div>

          <div className="space-y-2 mb-10">
            <h3 className="text-stone-900 font-headline text-3xl font-bold tracking-tight">Operator Login</h3>
            <p className="text-stone-500 text-sm">Enter your credentials to access the terminal.</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2 border border-red-200"
              >
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </motion.div>
            )}

            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400 group-focus-within:text-amber-600 transition-colors">
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                  className="block w-full pl-12 pr-4 py-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all font-medium text-sm"
                  placeholder="mechanic_id_77"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="block text-xs font-bold text-stone-600 uppercase tracking-wider">Password</label>
                <a className="text-xs font-semibold text-amber-600 hover:underline transition-all" href="#">Forgot Password?</a>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400 group-focus-within:text-amber-600 transition-colors">
                  <span className="material-symbols-outlined text-xl">lock</span>
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  className="block w-full pl-12 pr-12 py-4 bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 focus:bg-white transition-all font-medium text-sm"
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-stone-400 hover:text-amber-600 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
              </div>
            </div>

            {/* Remember */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-amber-600 bg-stone-50 border border-stone-300 rounded focus:ring-amber-500/20 cursor-pointer"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-stone-600 cursor-pointer select-none">Remember this terminal for 30 days</label>
            </div>

            {/* Submit */}
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98, y: 2 }}
              type="submit"
              disabled={loading}
              className="w-full text-stone-950 font-headline font-extrabold py-4 rounded-lg shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)' }}
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Authenticating...
                </>
              ) : (
                <>
                  Authenticate Operator
                  <span className="material-symbols-outlined">arrow_forward</span>
                </>
              )}
            </motion.button>

          </form>

          {/* Footer */}
          <div className="mt-12 flex flex-col items-center gap-6">
            <div className="flex items-center gap-4 w-full">
              <div className="h-px flex-grow bg-slate-200" />
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Secure Access</span>
              <div className="h-px flex-grow bg-slate-200" />
            </div>
            <div className="flex items-center gap-2 text-slate-400">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="text-[10px] font-bold uppercase tracking-widest">End-to-End Encrypted</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

