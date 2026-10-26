import React from 'react';
import { Sparkles, ArrowRight, Check, Eye } from 'lucide-react';
import { VideoNiche } from '../types/niche';
import { getAllNiches } from '../data/niches';

interface NicheSelectorProps {
  selectedNicheId?: string;
  onSelectNiche: (niche: VideoNiche) => void;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export const NicheSelector: React.FC<NicheSelectorProps> = ({
  selectedNicheId,
  onSelectNiche,
  title = 'Wähle deine Video-Nische',
  subtitle = 'Vordefinierte, virale Formate mit maßgeschneiderten Bildstilen und Story-Mustern.',
  compact = false,
}) => {
  const niches = getAllNiches();

  return (
    <div className="space-y-6">
      {/* Section Header */}
      {!compact && (
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-2">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-950/30 text-rose-400 border border-rose-900/50 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-rose-500" />
              <span>Vorgegebene Formate</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {title}
            </h2>
            <p className="text-sm text-zinc-400 mt-1 max-w-2xl leading-relaxed">
              {subtitle}
            </p>
          </div>
          <div className="text-xs text-zinc-500 font-medium bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800 self-start sm:self-auto">
            {niches.length} kuratierte Nischen verfügbar
          </div>
        </div>
      )}

      {/* Visual Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
        {niches.map((niche) => {
          const isSelected = selectedNicheId === niche.id;

          return (
            <div
              key={niche.id}
              onClick={() => onSelectNiche(niche)}
              className={`group relative rounded-2xl bg-zinc-950 border transition-all duration-300 overflow-hidden cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-rose-500 ring-2 ring-rose-500/20 shadow-md shadow-rose-500/10'
                  : 'border-zinc-800 hover:border-zinc-700 hover:shadow-lg shadow-xs'
              }`}
            >
              {/* Card Image Banner */}
              <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-900">
                <img
                  src={niche.previewImage}
                  alt={niche.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                
                {/* Gradient Overlays for Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-zinc-950/20 to-transparent" />

                {/* Badge Overlay */}
                {niche.badge && (
                  <div className="absolute top-3 left-3">
                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-sm">
                      {niche.badge}
                    </span>
                  </div>
                )}

                {/* Active Selection Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600 text-white text-xs font-bold shadow-lg shadow-rose-600/30">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Ausgewählt</span>
                  </div>
                )}

                {/* Bottom Overlay Title & Tagline */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="flex items-center gap-2">
                    <span className="text-xl" role="img" aria-label={niche.name}>
                      {niche.accent.icon}
                    </span>
                    <h3 className="text-xl font-black tracking-tight text-white drop-shadow-sm">
                      {niche.name}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-200 mt-0.5 line-clamp-1 font-medium">
                    {niche.tagline}
                  </p>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
                  {niche.description}
                </p>

                {/* Characteristics Pills */}
                <div className="space-y-2 pt-2 border-t border-zinc-900">
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-500 font-semibold shrink-0">Stil:</span>
                    <span className="text-zinc-300 line-clamp-1 font-medium">
                      {niche.visualStyle.split(',')[0]}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-500 font-semibold shrink-0">Figuren:</span>
                    <span className="text-zinc-300 line-clamp-1 font-medium">
                      {niche.typicalCharactersAndObjects.slice(0, 2).join(' · ')}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">
                    Standard: {niche.defaultDurationSec}s · 9:16
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectNiche(niche);
                    }}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-white group-hover:bg-rose-600'
                    }`}
                  >
                    <span>{isSelected ? 'Nische aktiv' : 'Nische wählen'}</span>
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:tranzinc-x-0.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
