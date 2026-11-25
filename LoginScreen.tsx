import React, { useState } from 'react';
import { Cloud, Lock, Smartphone } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { BrandWordmark, PWAInstallButton } from '../common/UIPrimitives';

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle } = useAppData();
  const [signingIn, setSigningIn] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await loginWithGoogle();
    } catch {
      // Handled by toast
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] grid lg:grid-cols-12 items-stretch">
      {/* Left editorial showcase */}
      <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden bg-[#1F3D2B]">
        {!imgFailed ? (
          <img
            src="/src/assets/images/login_editorial_curtains_1795615683327.jpg"
            alt="Gorden custom linen dan blackout Harmony Interior"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1F3D2B] via-[#2D4F3B] to-[#172F21]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#16291D]/90 via-[#16291D]/35 to-transparent flex flex-col justify-between p-10">
          <BrandWordmark light />
          <div className="max-w-md text-[#F8F7F4]">
            <p className="text-xs tracking-wide text-[#E5D3B3] mb-2">
              Custom Curtain &amp; Window Treatment Operations
            </p>
            <h2 className="font-display text-3xl font-semibold leading-snug text-balance">
              Kelola survey, penawaran, pengadaan bahan, dan pemasangan dalam satu alur kerja rapi.
            </h2>
            <p className="mt-3 text-sm text-[#F8F7F4]/80 leading-relaxed">
              Dirancang khusus untuk operasional made-to-order tanpa kerumitan gudang stok, tersinkronisasi realtime antara smartphone dan komputer Anda.
            </p>
          </div>
        </div>
      </div>

      {/* Right login form panel */}
      <div className="lg:col-span-6 flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden mb-8">
            <BrandWordmark />
          </div>

          <p className="text-xs font-medium text-[#846838] mb-2">
            Harmony Interior Business Management System
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-[#1F2421] tracking-tight text-balance">
            Masuk ke Ruang Kerja Operasional
          </h1>
          <p className="mt-3 text-sm text-[#5A635D] leading-relaxed">
            Gunakan akun Google Anda untuk mengakses data pelanggan, quotation, order, purchase order supplier, jadwal pemasangan, dan laporan keuangan secara realtime.
          </p>

          <div className="mt-8 bg-white border border-[#E5E2DA] rounded-xl p-6">
            <button
              type="button"
              onClick={handleLogin}
              disabled={signingIn}
              className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-lg bg-[#1F3D2B] text-white text-sm font-medium hover:bg-[#172F21] transition-colors disabled:opacity-60"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M21.35 11.1h-9.18v2.92h5.27c-.23 1.48-1.71 4.35-5.27 4.35-3.17 0-5.76-2.63-5.76-5.87s2.59-5.87 5.76-5.87c1.81 0 3.01.77 3.7 1.43l2.52-2.44C16.77 4.1 14.68 3.2 12.17 3.2 7.1 3.2 3 7.3 3 12.5s4.1 9.3 9.17 9.3c5.29 0 8.8-3.72 8.8-8.97 0-.6-.06-1.06-.16-1.73z"
                />
              </svg>
              <span>{signingIn ? 'Menghubungkan akun...' : 'Masuk dengan Google'}</span>
            </button>

            <div className="mt-5 pt-5 border-t border-[#E5E2DA] space-y-3 text-xs text-[#5A635D]">
              <div className="flex items-start gap-2.5">
                <Cloud className="w-4 h-4 text-[#1F3D2B] shrink-0 mt-0.5" />
                <span>Database Cloud Firestore aktif — satu akun langsung sinkron antar HP, tablet, dan desktop.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Lock className="w-4 h-4 text-[#1F3D2B] shrink-0 mt-0.5" />
                <span>Data bisnis privat dan dilindungi autentikasi serta Firestore Security Rules.</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Smartphone className="w-4 h-4 text-[#1F3D2B] shrink-0 mt-0.5" />
                <span>Mendukung Progressive Web App (PWA) untuk akses cepat dari layar utama ponsel.</span>
              </div>
            </div>

            <div className="mt-4">
              <PWAInstallButton />
            </div>
          </div>

          <p className="mt-6 text-xs text-[#5A635D]">
            Zona waktu operasional: Asia/Jakarta · Format mata uang: Rupiah (IDR) · Format tanggal: DD/MM/YYYY
          </p>
        </div>
      </div>
    </div>
  );
};
