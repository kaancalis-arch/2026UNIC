import { FormEvent, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { authService } from '../services/authService';
import { getPublicStorageUrl } from '../services/supabaseClient';

const UNIC_LOGO_URL = getPublicStorageUrl('Unic_Main', 'UNIC The Uni Counsllor Logo.png');

const ResetPassword = () => {
  const navigate = useNavigate();
  const { session, isLoading: isAuthLoading, isPasswordRecovery, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);

  const handleReturnToLogin = async () => {
    try {
      await signOut();
    } catch {
      // Navigation must continue even when the expired session cannot be revoked remotely.
    } finally {
      navigate('/', { replace: true });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || !session || !isPasswordRecovery) return;

    if (password.length < 8) {
      setError('Yeni şifre en az 8 karakter olmalıdır.');
      return;
    }

    if (password !== passwordConfirmation) {
      setError('Şifreler eşleşmiyor.');
      return;
    }

    submitLock.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      await authService.updatePassword(password);
    } catch {
      setError('Şifre güncellenemedi. Lütfen bağlantınızı kontrol edip tekrar deneyin.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      await signOut();
    } catch {
      // The recovery page must not retain or expose sign-out implementation errors.
    } finally {
      navigate('/', { replace: true });
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-slate-600" role="status">
          <span className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />
          Bağlantı doğrulanıyor...
        </div>
      </div>
    );
  }

  if (!session || !isPasswordRecovery) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-slate-100 text-center">
          <h1 className="text-2xl font-semibold text-slate-800 mb-3">Bağlantı Geçersiz</h1>
          <p className="text-sm leading-6 text-slate-600 mb-6">
            Bu şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş olabilir. Giriş ekranından yeni bir bağlantı isteyin.
          </p>
          <button
            type="button"
            onClick={() => void handleReturnToLogin()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            Giriş Ekranına Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="min-h-[240px] lg:min-h-screen lg:w-1/2 bg-black relative flex items-center justify-center overflow-hidden px-6 py-10">
        <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-50 scale-110" />
        <div className="relative z-10 text-center">
          <img
            src={UNIC_LOGO_URL}
            alt="UNIC Logo"
            className="h-28 sm:h-36 lg:h-48 w-auto mx-auto mb-6 lg:mb-8"
          />
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-wide"
            style={{
              fontFamily: "'Pacifico', cursive",
              textShadow: '0 0 30px rgba(220, 38, 38, 0.8), 0 0 60px rgba(220, 38, 38, 0.4)',
              color: '#fca5a5',
            }}
          >
            Dream it, Wish it, Do it
          </h1>
        </div>
      </div>

      <div className="flex-1 lg:w-1/2 bg-slate-100 flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100">
          <h2 className="text-2xl font-semibold text-slate-800 mb-2 text-center">Yeni Şifre Belirle</h2>
          <p className="text-sm text-slate-500 mb-6 text-center">En az 8 karakterden oluşan yeni şifrenizi girin.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-slate-700 mb-2">
                Yeni şifre
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-700"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={showPassword}
                  disabled={isSubmitting}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="password-confirmation" className="block text-sm font-medium text-slate-700 mb-2">
                Yeni şifre tekrar
              </label>
              <div className="relative">
                <input
                  id="password-confirmation"
                  type={showConfirmation ? 'text' : 'password'}
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-700"
                  aria-label={showConfirmation ? 'Şifre tekrarını gizle' : 'Şifre tekrarını göster'}
                  aria-pressed={showConfirmation}
                  disabled={isSubmitting}
                >
                  {showConfirmation ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm" role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              )}
              {isSubmitting ? 'Şifre güncelleniyor...' : 'Şifreyi Güncelle'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
