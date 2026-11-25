import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tidak terduga pada sistem.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Harmony Interior ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyText = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed.error) {
          friendlyText = `${parsed.error} (${parsed.operationType || 'operasi'} pada ${parsed.path || 'database'})`;
        }
      } catch {
        // Plain message
      }

      return (
        <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-[#E5E2DA] rounded-xl p-8 text-center">
            <div className="w-12 h-12 mx-auto rounded-lg bg-[#FDF2F2] text-[#B53939] flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="font-display text-2xl font-semibold text-[#1F2421]">
              Terjadi Gangguan Sistem
            </h1>
            <p className="mt-2 text-sm text-[#5A635D] leading-relaxed">
              Sistem menangkap kesalahan saat memproses permintaan Anda. Data di database tetap aman.
            </p>
            <div className="mt-4 p-3 rounded-lg bg-[#F8F7F4] border border-[#E5E2DA] text-left text-xs font-mono text-[#5A635D] break-words">
              {friendlyText}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="mt-6 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
