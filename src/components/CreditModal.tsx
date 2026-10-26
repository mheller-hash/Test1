import React, { useState } from 'react';
import { X, Coins, Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { UserProfile } from '../types';

interface CreditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  authUser?: any;
  onAddCredits: (amount: number) => void;
  onOpenAuthModal?: () => void;
}

export const CreditModal: React.FC<CreditModalProps> = ({
  isOpen,
  onClose,
  user,
  authUser,
  onAddCredits,
  onOpenAuthModal,
}) => {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const creditPacks = [
    {
      credits: 50,
      price: '9€',
      label: 'Mini Booster',
      desc: '~3 bis 4 fertige Videos',
      popular: false,
    },
    {
      credits: 150,
      price: '19€',
      label: 'Creator Pack',
      desc: '~10 bis 12 fertige Videos',
      popular: true,
    },
    {
      credits: 400,
      price: '39€',
      label: 'Power Bundle',
      desc: '~25 bis 30 fertige Videos',
      popular: false,
    },
  ];

  const handleBuy = (amount: number) => {
    if (!authUser) {
      onClose();
      onOpenAuthModal?.();
      return;
    }
    // Secure Architecture: Direct frontend credit writes are prohibited
    setSuccessMsg(`Zahlungsintegration in Vorbereitung. Im aktuellen Sicherheitsmodus können Credits nicht über das Frontend gutgeschrieben werden.`);
    setTimeout(() => {
      setSuccessMsg(null);
      onClose();
    }, 2400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative space-y-6">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-950/30 text-amber-500 flex items-center justify-center mx-auto mb-2 border border-amber-900/50">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Credits & Guthaben</h3>
          
          {authUser ? (
            <div className="space-y-1">
              <p className="text-xs text-zinc-400">
                Aktuelles Guthaben: <strong className="text-white font-mono font-bold text-sm">{user.credits} Credits</strong>
              </p>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950/30 text-emerald-400 text-[11px] font-medium border border-emerald-900/50">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Account gebunden: {user.email || authUser.email}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl text-amber-200 text-xs text-center space-y-1">
              <div className="flex items-center justify-center gap-1 font-semibold">
                <Lock className="w-3.5 h-3.5 text-amber-500" />
                <span>Nicht angemeldet</span>
              </div>
              <p className="text-[11px] text-amber-400/80">
                Melde dich an, damit deine erworbenen Credits sicher in deinem persönlichen Konto gespeichert werden.
              </p>
            </div>
          )}
        </div>

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-xs text-center font-medium shadow-xs">
            {successMsg}
          </div>
        )}

        {/* Credit Packages */}
        <div className="space-y-3">
          {creditPacks.map((pack) => (
            <div
              key={pack.credits}
              className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                pack.popular
                  ? 'bg-rose-950/20 border-rose-500 shadow-sm ring-1 ring-rose-500/30'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{pack.label}</span>
                  {pack.popular && (
                    <span className="text-[10px] font-mono bg-rose-600 text-white px-2 py-0.2 rounded font-semibold uppercase">
                      Bester Wert
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">{pack.desc}</div>
                <div className="font-mono text-xs font-semibold text-amber-600 mt-1">
                  +{pack.credits} Credits
                </div>
              </div>

              <button
                onClick={() => handleBuy(pack.credits)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-colors shrink-0 flex items-center gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
              >
                <span>{pack.price}</span>
                <span>{authUser ? 'Aufladen' : 'Anmelden & Laden'}</span>
              </button>
            </div>
          ))}
        </div>

        {/* Quick Free Test Credit Top-Up */}
        <div className="pt-2 border-t border-zinc-800 flex flex-col items-center gap-2 text-center">
          <button
            onClick={() => handleBuy(50)}
            className="text-xs text-zinc-400 hover:text-rose-500 transition-colors inline-flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Kostenlose Test-Credits anfordern (+50 Credits)</span>
          </button>
          
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3 h-3 text-zinc-600" />
            <span>Verschlüsselt über Firebase Firestore • Verfällt niemals</span>
          </div>
        </div>

      </div>
    </div>
  );
};
