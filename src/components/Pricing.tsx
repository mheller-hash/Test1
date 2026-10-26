import React, { useState } from 'react';
import { Check, Coins, Zap } from 'lucide-react';
import { UserProfile } from '../types';

interface PricingProps {
  user: UserProfile;
  authUser?: any;
  onUpdatePlan: (plan: 'free' | 'creator' | 'pro', additionalCredits: number) => void;
  onOpenAuthModal?: () => void;
}

export const Pricing: React.FC<PricingProps> = ({ user, authUser, onUpdatePlan, onOpenAuthModal }) => {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [notification, setNotification] = useState<string | null>(null);

  const plans = [
    {
      id: 'free' as const,
      name: 'Free Starter',
      subtitle: 'Für Einsteiger & Content-Experimente',
      priceMonthly: 0,
      priceAnnual: 0,
      creditsMonthly: 30,
      features: [
        '30 Credits pro Monat (~2 fertige Videos)',
        'Zugriff auf Standard-Templates',
        '720p Video-Auflösung',
        'Standard-Warteschlange',
        'Dezentes Veyro.ai Wasserzeichen',
      ],
      ctaLabel: 'Aktueller Plan',
      isPopular: false,
    },
    {
      id: 'creator' as const,
      name: 'Creator',
      subtitle: 'Für regelmäßige TikTok-, Shorts- & Reels-Publisher',
      priceMonthly: 19,
      priceAnnual: 15,
      creditsMonthly: 180,
      features: [
        '180 Credits pro Monat (~12 bis 15 Shorts)',
        'Zugriff auf alle Trending & Viral Templates',
        '1080x1920 Full HD ohne Wasserzeichen',
        'Priorisierte Schnell-Generierung (< 30s)',
        'Expressive AI-Synchronstimmen',
        'Dynamische virale Untertitel-Stile',
      ],
      ctaLabel: user.plan === 'creator' ? 'Aktiver Plan' : 'Auf Creator upgraden',
      isPopular: true,
    },
    {
      id: 'pro' as const,
      name: 'Pro Studio',
      subtitle: 'Für Theme-Page Betreiber, Agenturen & Power-User',
      priceMonthly: 49,
      priceAnnual: 39,
      creditsMonthly: 600,
      features: [
        '600 Credits pro Monat (~40 bis 50 Shorts)',
        'Alle bestehenden & wöchentlich neuen Templates',
        '4K Ultra HD Exportqualität',
        'Höchste Priorität in der Render-Pipeline',
        'Eigene Custom-Voice Clones & freie Prompt-Wünsche',
        'Volle kommerzielle Verwertungsrechte',
      ],
      ctaLabel: user.plan === 'pro' ? 'Aktiver Plan' : 'Auf Pro Studio upgraden',
      isPopular: false,
    },
  ];

  const handleSelectPlan = (planId: 'free' | 'creator' | 'pro', credits: number) => {
    if (!authUser) {
      onOpenAuthModal?.();
      return;
    }
    // Secure Architecture: Direct frontend plan/credit modification is prohibited
    setNotification(`Abrechnungssystem in Vorbereitung. Plan-Upgrades für "${planId.toUpperCase()}" werden serverseitig nach Abschluss der Zahlungsabwicklung aktiviert.`);
    setTimeout(() => setNotification(null), 3500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      
      {/* Title */}
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <span className="text-xs font-mono text-rose-500 font-semibold uppercase tracking-wider">
          Transparente Credit-Pakete
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">
          Einfache Preise. Volle Kontrolle.
        </h1>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Wähle das passende Paket für deine Content-Frequenz. Keine versteckten Kosten, jederzeit kündbar.
        </p>

        {/* Monthly / Annual Toggle */}
        <div className="pt-4 flex items-center justify-center">
          <div className="p-1 bg-zinc-900 border border-zinc-800 rounded-xl inline-flex items-center gap-1">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              Monatlich
            </button>
            <button
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                billingCycle === 'annual'
                  ? 'bg-zinc-800 text-white font-semibold shadow-xs'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              <span>Jährlich</span>
              <span className="text-[10px] bg-rose-950 text-rose-400 px-1.5 py-0.2 rounded font-bold border border-rose-900/50">
                -20%
              </span>
            </button>
          </div>
        </div>
      </div>

      {notification && (
        <div className="max-w-md mx-auto p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-900/50 text-emerald-400 text-xs text-center font-medium shadow-xs">
          {notification}
        </div>
      )}

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
        {plans.map((plan) => {
          const isCurrent = user.plan === plan.id;
          const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnual;

          return (
            <div
              key={plan.id}
              className={`rounded-3xl p-6 sm:p-8 flex flex-col justify-between border transition-all ${
                plan.isPopular
                  ? 'bg-zinc-950 border-rose-500 shadow-xl ring-2 ring-rose-500/15 relative'
                  : 'bg-zinc-950 border-zinc-800 shadow-xs'
              }`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-600 to-amber-500 text-white text-[11px] font-bold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wide">
                  Am beliebtesten
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-white text-xl">{plan.name}</h3>
                  <div className="flex items-center gap-1 text-xs text-amber-500 font-mono font-semibold bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50">
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span>{plan.creditsMonthly} Credits</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 mt-1 leading-snug">
                  {plan.subtitle}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold text-white font-mono tabular-nums">
                    {price}€
                  </span>
                  <span className="text-xs text-zinc-500">/ Monat</span>
                </div>

                {billingCycle === 'annual' && plan.priceAnnual > 0 && (
                  <div className="text-[11px] text-zinc-500 mt-1">
                    Jährlich abgerechnet ({plan.priceAnnual * 12}€/Jahr)
                  </div>
                )}

                {/* Features List */}
                <div className="mt-8 space-y-3 border-t border-zinc-800 pt-6">
                  <div className="text-xs font-semibold text-white">Enthaltene Leistungen:</div>
                  <ul className="space-y-2.5">
                    {plan.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-xs text-zinc-400">
                        <Check className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-6 border-t border-zinc-900">
                <button
                  onClick={() => handleSelectPlan(plan.id, plan.creditsMonthly)}
                  disabled={isCurrent}
                  className={`w-full py-3 px-4 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isCurrent
                      ? 'bg-zinc-900 text-zinc-600 cursor-default border border-zinc-800'
                      : plan.isPopular
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-500/25'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  {isCurrent ? (
                    <span>Aktueller Plan</span>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>{plan.ctaLabel}</span>
                    </>
                  )}
                </button>
              </div>

            </div>
          );
        })}
      </div>

      {/* Credit Top-up FAQ */}
      <div className="p-6 rounded-2xl bg-zinc-950 border border-zinc-800 max-w-3xl mx-auto space-y-3 shadow-xs">
        <h4 className="font-bold text-white text-sm">Wie funktioniert das Credit-System?</h4>
        <div className="text-xs text-zinc-400 space-y-2 leading-relaxed">
          <p>
            Jedes Video verbraucht je nach Format und Dauer zwischen 10 und 20 Credits (z.B. 15s Video = 10 Credits, 30s Video = 15 Credits).
          </p>
          <p>
            Vor jeder Generierung siehst du transparent die genauen Kosten. Nicht verbrauchte Monats-Credits verfallen nicht, solange dein Abo aktiv ist.
          </p>
        </div>
      </div>

    </div>
  );
};
