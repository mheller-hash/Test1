import React, { useState } from 'react';
import { Search, Flame, Play, Clock, Sparkles } from 'lucide-react';
import { VIDEO_TEMPLATES } from '../data/templates';
import { VideoTemplate, TemplateCategory } from '../types';

interface DiscoverProps {
  onSelectTemplate: (template: VideoTemplate) => void;
  onGoToCreate?: () => void;
}

export const Discover: React.FC<DiscoverProps> = ({ onSelectTemplate, onGoToCreate }) => {
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: { id: TemplateCategory; label: string }[] = [
    { id: 'all', label: 'Alle Formate' },
    { id: 'trending', label: 'Trending' },
    { id: 'characters', label: 'Characters' },
    { id: 'stories', label: 'Stories' },
    { id: 'satisfying', label: 'Satisfying' },
    { id: 'asmr', label: 'ASMR' },
    { id: 'comedy', label: 'Comedy' },
    { id: 'cinematic', label: 'Cinematic' },
    { id: 'experimental', label: 'Experimental' },
  ];

  // Filtering logic
  const filteredTemplates = VIDEO_TEMPLATES.filter((tpl) => {
    const matchesCategory =
      selectedCategory === 'all'
        ? true
        : selectedCategory === 'trending'
        ? tpl.badge === 'Trending' || tpl.badge === 'Viral'
        : tpl.category === selectedCategory;

    const matchesSearch =
      tpl.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tpl.tagline.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  // Spotlight trending template
  const trendingHero = VIDEO_TEMPLATES.find((t) => t.id === 'fruit-drama') || VIDEO_TEMPLATES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Template Library
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Wähle ein virales Format oder erstelle ein komplett eigenes Video mit dem strukturierten Veo Studio.
          </p>
        </div>

        {/* Search bar & Create button */}
        <div className="flex items-center gap-3 w-full sm:w-auto">
          {onGoToCreate && (
            <button
              onClick={onGoToCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Eigenes Video erstellen</span>
            </button>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Template suchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Prominenter Trending Hero Bereich (Helles Design) */}
      {selectedCategory === 'all' && !searchQuery && (
        <div className="relative rounded-3xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
            
            {/* Left Info Column */}
            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-950/30 border border-rose-900/50 text-rose-400 text-xs font-semibold mb-4">
                  <Flame className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                  <span>Trending #1 auf TikTok & Shorts</span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  {trendingHero.title}
                </h2>

                <p className="text-sm sm:text-base text-zinc-400 mt-3 max-w-xl leading-relaxed">
                  {trendingHero.description}
                </p>

                {/* Metadata details */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 mt-6 pt-6 border-t border-zinc-900">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-zinc-500" />
                    <span>Dauer: ca. {trendingHero.defaultDurationSec}s</span>
                  </div>
                  <span aria-hidden="true" className="text-zinc-800">·</span>
                  <div>
                    <span>Verbrauch: </span>
                    <span className="font-mono tabular-nums font-semibold text-white">{trendingHero.creditCost} Credits</span>
                  </div>
                  <span aria-hidden="true" className="text-zinc-800">·</span>
                  <div>
                    <span>Format: </span>
                    <span className="font-semibold text-white">9:16 Vertikal</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <div className="mt-8 flex items-center gap-4">
                <button
                  onClick={() => onSelectTemplate(trendingHero)}
                  className="px-6 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center gap-2 shadow-md shadow-rose-500/20 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Create Video now</span>
                </button>
                <button
                  onClick={() => onSelectTemplate(trendingHero)}
                  className="px-4 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-medium rounded-xl text-sm transition-colors cursor-pointer border border-zinc-800"
                >
                  Vorschau ansehen
                </button>
              </div>
            </div>

            {/* Right Visual 9:16 Showcase Preview */}
            <div className="lg:col-span-5 bg-zinc-900 relative min-h-[300px] lg:min-h-full flex items-center justify-center p-6 border-t lg:border-t-0 lg:border-l border-zinc-800">
              <div className="relative aspect-[9/16] w-full max-w-[240px] rounded-2xl overflow-hidden shadow-xl border border-zinc-800 group">
                <img
                  src={trendingHero.thumbnailUrl}
                  alt={trendingHero.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute bottom-3 left-3 right-3 text-left">
                  <div className="text-[11px] font-mono text-rose-300 uppercase font-semibold">Live Preview</div>
                  <div className="text-xs font-bold text-white truncate">Erdbeere vs. Banane Mafia</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Category Filter Buttons */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-rose-600 text-white font-semibold shadow-xs'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Templates Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs text-zinc-500 font-medium">
            <span>{filteredTemplates.length} Templates verfügbar</span>
            {selectedCategory !== 'all' && (
              <span> in <strong className="text-white capitalize">{selectedCategory}</strong></span>
            )}
          </div>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="text-center py-16 bg-zinc-950 rounded-2xl border border-zinc-800">
            <p className="text-zinc-500 text-sm">Keine Templates für diese Suchanfrage gefunden.</p>
            <button
              onClick={() => { setSelectedCategory('all'); setSearchQuery(''); }}
              className="mt-3 text-xs text-rose-600 font-semibold hover:underline cursor-pointer"
            >
              Filter zurücksetzen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="group rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden hover:border-rose-500 hover:shadow-2xl hover:shadow-rose-500/10 transition-all flex flex-col shadow-sm"
              >
                {/* 9:16 Video Thumbnail */}
                <div
                  onClick={() => onSelectTemplate(template)}
                  className="relative aspect-[9/16] w-full bg-zinc-900 cursor-pointer overflow-hidden"
                >
                  <img
                    src={template.thumbnailUrl}
                    alt={template.title}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  {/* Gradient Scrim */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                  {/* Badge top-right */}
                  {template.badge && (
                    <div className="absolute top-3 right-3 text-[11px] font-semibold font-mono tracking-tight text-white bg-rose-600/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-md">
                      {template.badge}
                    </div>
                  )}

                  {/* Duration bottom-left */}
                  <div className="absolute bottom-3 left-3 text-xs font-mono text-slate-200 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    <span>{template.defaultDurationSec}s</span>
                  </div>

                  {/* Hover Overlay Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                    <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transform scale-90 group-hover:scale-100 transition-transform">
                      <Play className="w-5 h-5 fill-white ml-0.5" />
                    </div>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                      <span className="capitalize">{template.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-300">{template.creditCost} Credits</span>
                    </div>

                    <h3
                      onClick={() => onSelectTemplate(template)}
                      className="font-bold text-white text-base group-hover:text-rose-500 transition-colors cursor-pointer"
                    >
                      {template.title}
                    </h3>

                    <p className="text-xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                      {template.tagline}
                    </p>
                  </div>

                  {/* Create Button */}
                  <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                    <button
                      onClick={() => onSelectTemplate(template)}
                      className="w-full py-2 px-3 text-xs font-semibold text-zinc-300 bg-zinc-900 hover:bg-rose-600 hover:text-white rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Create Video</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
