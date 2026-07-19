import { FormEvent, KeyboardEvent, useRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { AuthServiceError, authService } from '../services/authService';
import { getPublicStorageUrl } from '../services/supabaseClient';

const UNIC_LOGO_URL = getPublicStorageUrl('Unic_Main', 'UNIC The Uni Counsllor Logo.png');

const Login = () => {
  const { signIn, isLoading: isAuthLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const submitLock = useRef(false);

  const handlePasswordKey = (event: KeyboardEvent<HTMLInputElement>) => {
    setIsCapsLockOn(event.getModifierState('CapsLock'));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current || isAuthLoading) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setError('');

    try {
      await signIn(email.trim().toLowerCase(), password);
    } catch (caughtError) {
      if (caughtError instanceof AuthServiceError) {
        if (caughtError.code === 'PASSIVE_ACCOUNT') {
          setError('Hesabınız pasif durumdadır. Sistem yöneticinizle iletişime geçin.');
        } else if (caughtError.code === 'PROFILE_NOT_FOUND') {
          setError('Kullanıcı profiliniz bulunamadı. Sistem yöneticinizle iletişime geçin.');
        } else {
          setError('E-posta veya şifre hatalı.');
        }
      } else {
        setError('E-posta veya şifre hatalı.');
      }
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitLock.current) return;

    submitLock.current = true;
    setIsSubmitting(true);
    setError('');
    setResetMessage('');

    try {
      await authService.resetPassword(email.trim().toLowerCase());
      setResetMessage(
        'Bu e-posta adresiyle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı gönderildi.',
      );
    } catch {
      setError('İstek şu anda tamamlanamadı. Lütfen daha sonra tekrar deneyin.');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const isBusy = isSubmitting || isAuthLoading;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <div className="min-h-[280px] lg:min-h-screen lg:w-1/2 bg-black relative flex items-center justify-center overflow-hidden px-6 py-12">
        <div className="absolute inset-0 bg-red-600 blur-[100px] opacity-50 scale-110" />

        <div className="relative z-10 text-center">
          <img
            src={UNIC_LOGO_URL}
            alt="UNIC Logo"
            className="h-28 sm:h-36 lg:h-48 w-auto mx-auto mb-6 lg:mb-8"
          />
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wide"
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

      <div className="flex-1 lg:w-1/2 bg-slate-100 flex flex-col items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-100">
            <h2 className="text-2xl font-semibold text-slate-800 mb-2 text-center">
              {isForgotPassword ? 'Şifremi Unuttum' : 'Giriş Yap'}
            </h2>
            {isForgotPassword && (
              <p className="text-sm text-slate-500 mb-6 text-center">
                Sıfırlama bağlantısı için e-posta adresinizi girin.
              </p>
            )}

            <form
              onSubmit={isForgotPassword ? handleResetRequest : handleSubmit}
              className="space-y-5"
            >
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
                  E-posta
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                  placeholder="ornek@unic.com"
                  autoComplete="email"
                  required
                  disabled={isBusy}
                />
              </div>

              {!isForgotPassword && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                      Şifre
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError('');
                        setResetMessage('');
                      }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700"
                      disabled={isBusy}
                    >
                      Şifremi unuttum
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      onKeyDown={handlePasswordKey}
                      onKeyUp={handlePasswordKey}
                      onBlur={() => setIsCapsLockOn(false)}
                      className="w-full px-4 py-3 pr-12 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-800"
                      placeholder="Şifreniz"
                      autoComplete="current-password"
                      required
                      disabled={isBusy}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute inset-y-0 right-0 flex items-center px-4 text-slate-500 hover:text-slate-700"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      aria-pressed={showPassword}
                      disabled={isBusy}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  {isCapsLockOn && (
                    <p className="mt-2 text-sm text-amber-700" role="status">
                      Caps Lock açık.
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div
                  className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {resetMessage && (
                <div
                  className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-lg text-sm"
                  role="status"
                >
                  {resetMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy || Boolean(resetMessage)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isBusy && (
                  <span className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                )}
                {isBusy
                  ? isForgotPassword
                    ? 'Gönderiliyor...'
                    : 'Giriş yapılıyor...'
                  : isForgotPassword
                    ? 'Sıfırlama Bağlantısı Gönder'
                    : 'Giriş Yap'}
              </button>

              {isForgotPassword && (
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setError('');
                    setResetMessage('');
                  }}
                  className="w-full text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
                  disabled={isBusy}
                >
                  Giriş ekranına dön
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
