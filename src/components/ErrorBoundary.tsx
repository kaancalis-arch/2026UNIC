import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

function ErrorFallback({ error }: { error?: Error }) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur">
          <div className="relative overflow-hidden px-8 py-10 md:px-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(248,113,113,0.2),_transparent_35%),radial-gradient(circle_at_bottom_left,_rgba(59,130,246,0.18),_transparent_35%)]" />
            <div className="relative space-y-6">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20">
                <AlertTriangle className="h-7 w-7" />
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-300/80">
                  Uygulama Hatasi
                </p>
                <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
                  Sayfa beklenmeyen bir hatayla durdu
                </h1>
                <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                  Bu hata yakalandi ve uygulamanin tamamen beyaz sayfaya dusmesi engellendi. Sayfayi yenileyerek guvenli duruma donebilirsin.
                </p>
              </div>

              {error?.message && (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Hata Mesaji
                  </p>
                  <p className="mt-2 break-words font-mono text-sm text-slate-200">
                    {error.message}
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  Sayfayi Yenile
                </button>
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/5"
                >
                  Ana Sayfaya Don
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled React render error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
