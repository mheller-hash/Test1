import React from 'react';
import { ArrowRight, Play, Zap, Layers, Flame, Clock, Sparkles } from 'lucide-react';
import { VIDEO_TEMPLATES } from '../data/templates';
import { VideoTemplate } from '../types';

interface LandingPageProps {
  onSelectTemplate: (template: VideoTemplate) => void;
  onExploreLibrary: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectTemplate,
  onExploreLibrary,
}) => {
  const featuredTemplates = VIDEO_TEMPLATES.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      
      {/* Hero Section */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-rose-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        <div className="text-center max-w-3xl mx-auto">
          {/* Natural kicker */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold mb-6">
            <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-600" />
            <span>Das neue KI-Shorts Template-Betriebssystem</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 mb-6 leading-[1.15]" style={{ textWrap: 'balance' }}>
            Create viral AI videos from <span className="bg-gradient-to-r from-rose-600 to-amber-500 bg-clip-text text-transparent">ready-to-use templates</span>.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed" style={{ textWrap: 'balance' }}>
            Erstelle virale Kurzvideos für TikTok, Instagram Reels und YouTube Shorts, ohne komplizierte Prompts zu tippen oder Videos mühsam schneiden zu müssen.
          </p>

          {/* Simple 3-Step Flow banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-white border border-slate-200/90 rounded-2xl max-w-2xl mx-auto mb-10 text-left shadow-sm">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-rose-100 text-rose-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                1
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-900">Choose a template</div>
                <div className="text-[11px] text-slate-500">Fruit Drama, ASMR, Story...</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                2
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-900">Customize it</div>
                <div className="text-[11px] text-slate-500">Charaktere, Ort & Handlung</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                3
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-900">Generate video</div>
                <div className="text-[11px] text-slate-500">Fertig mit Voice & Untertiteln</div>
              </div>
            </div>
          </div>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExploreLibrary}
              className="w-full sm:w-auto px-7 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-rose-500/25 cursor-pointer"
            >
              <span>Explore Templates</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onSelectTemplate(VIDEO_TEMPLATES[0])}
              className="w-full sm:w-auto px-6 py-3.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <Play className="w-4 h-4 text-rose-600 fill-rose-600" />
              <span>Try Fruit Drama (Demo)</span>
            </button>
          </div>

          {/* Social Proof strip */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-500 border-t border-slate-200 pt-8">
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">2.4M+</span>
              <span>Shorts generiert</span>
            </div>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">18,500+</span>
              <span>Content Creator</span>
            </div>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <div className="flex items-center gap-2">
              <span className="font-mono tabular-nums font-bold text-slate-900 text-sm">4.9 / 5</span>
              <span>Durchschnittliche Bewertung</span>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Showcase Section: Real Template Previews */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-semibold tracking-wider text-rose-600 uppercase">Aktuelle Video-Formate</span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
              Beliebte virale Templates entdecken
            </h2>
            <p className="text-sm text-slate-600 mt-2 max-w-xl">
              Jedes Template liefert eine bewährte virale Struktur. Wähle ein Format und passe es mit 3 Klicks an.
            </p>
          </div>

          <button
            onClick={onExploreLibrary}
            className="text-sm font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1.5 self-start md:self-auto cursor-pointer"
          >
            <span>Alle 24 Templates ansehen</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* 4-column vertical card showcase */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="group cursor-pointer rounded-2xl bg-white border border-slate-200 overflow-hidden hover:border-rose-400 hover:shadow-xl transition-all flex flex-col shadow-xs"
            >
              {/* Vertical 9:16 Thumbnail Container */}
              <div className="relative aspect-[9/16] w-full bg-slate-100 overflow-hidden">
                <img
                  src={template.thumbnailUrl}
                  alt={template.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Scrim overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Badge top-right */}
                {template.badge && (
                  <div className="absolute top-3 right-3 text-[11px] font-semibold font-mono tracking-tight text-white bg-rose-600/90 backdrop-blur-sm px-2.5 py-1 rounded-md shadow-md">
                    {template.badge}
                  </div>
                )}

                {/* Duration indicator bottom-left */}
                <div className="absolute bottom-3 left-3 text-xs font-mono text-slate-200 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  <span>{template.defaultDurationSec}s</span>
                </div>

                {/* Hover Play Button */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Card Footer details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                    <span className="capitalize">{template.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-800">{template.creditCost} Credits</span>
                  </div>
                  <h3 className="font-bold text-slate-900 text-base group-hover:text-rose-600 transition-colors">
                    {template.title}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">
                    {template.tagline}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Klick zum Anpassen</span>
                  <span className="text-xs font-semibold text-rose-600 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    Template wählen →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why Templates vs Generic Prompting */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-200">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            Warum Templates jedem Prompting-Tool überlegen sind
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Spare dir stundenlanges Prompt-Engineering, Schnittprogramme und Inkonsistenzen.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Konsistente Charaktere</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Kein Morphing oder veränderte Gesichter zwischen den Szenen. Die Charaktere bleiben von Szene 1 bis zum Finale 100% konsistent.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Fertiger Multi-Szenen Schnitt</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Die Plattform erzeugt automatisch 3 bis 5 zusammenhängende Szenen mit passenden Schnitten, Kamerafahrten und Szenenübergängen.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900 mb-2">Voiceover & Virale Untertitel</h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Jedes Video wird komplett mit passenden Stimmen und den typischen, dynamisch aufspringenden TikTok-Untertiteln synchronisiert.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-white to-slate-100 border border-slate-200 text-center relative overflow-hidden shadow-sm">
          <div className="absolute top-0 right-1/4 w-72 h-72 bg-rose-500/10 rounded-full blur-[80px] pointer-events-none" />
          
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-4">
            Bereit für dein erstes virales Video?
          </h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Wähle ein Template und erstelle dein erstes fertiges Short in unter 60 Sekunden.
          </p>

          <button
            onClick={onExploreLibrary}
            className="px-8 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-rose-500/25 inline-flex items-center gap-2 cursor-pointer"
          >
            <span>Jetzt Templates entdecken</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800">ShortsCraft AI</span>
            <span>· Das Template-System für virale Kurzvideos</span>
          </div>
          <div>© {new Date().getFullYear()} ShortsCraft AI. Alle Rechte vorbehalten.</div>
        </div>
      </footer>

    </div>
  );
};
