import React, { useState } from 'react';
import { MOCK_USERS } from '../services/mockData';
import { SystemUser } from '../types';

interface LoginProps {
  onLogin: (user: SystemUser) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find user by email (mock authentication)
    const user = MOCK_USERS.find(u => u.email === email);
    
    // For demo purposes, accept any non-empty password
    if (user && password) {
      onLogin(user);
    } else {
      setError('E-posta veya şifre hatalı. Lütfen tekrar deneyin.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Sol Taraf - Logo Alanı */}
      <div className="w-1/2 bg-black relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-50 scale-110"></div>

        <div className="relative z-10 text-center">
          <img
            src="https://qwualszqafxjorumgttv.supabase.co/storage/v1/object/public/Unic_Main/UNIC%20The%20Uni%20Counsllor%20Logo.png"
            alt="UNIC Logo"
            className="h-48 w-auto mx-auto mb-8"
          />
          <h1 className="text-5xl font-bold text-white tracking-wide"
            style={{ 
              fontFamily: "'Pacifico', cursive",
              textShadow: '0 0 30px rgba(220, 38, 38, 0.8), 0 0 60px rgba(220, 38, 38, 0.4)',
              color: '#fca5a5'
            }}>
            Dream it, Wish it, Do it
          </h1>
        </div>
      </div>

      {/* Sağ Taraf - Giriş Ekranı */}
      <div className="w-1/2 bg-slate-100 flex flex-col items-center justify-center p-8">
        {/* Login Card */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
            <h2 className="text-2xl font-semibold text-slate-800 mb-6 text-center">
              Giriş Yap
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                  placeholder="ornek@unic.com"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-2">
                  Şifre
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                  placeholder="••••••••"
                  required
                  disabled={isLoading}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Giriş yapılıyor...
                  </>
                ) : (
                  'Giriş Yap'
                )}
              </button>
            </form>

            {/* Demo Users Hint */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-500 text-center">
                Demo kullanıcıları için rastgele şifre girin
              </p>
              <div className="mt-3 space-y-2">
                {MOCK_USERS.slice(0, 3).map((user) => (
                  <div key={user.id} className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-lg">
                    <span className="font-medium">{user.role}:</span>
                    <span>{user.email}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
