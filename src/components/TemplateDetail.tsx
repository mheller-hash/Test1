import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Clock, Coins, Play, Check, Wand2, Info, MessageSquare } from 'lucide-react';
import { VideoTemplate } from '../types';

interface TemplateDetailProps {
  template: VideoTemplate;
  userCredits: number;
  isLoggedIn?: boolean;
  onBack: () => void;
  onStartGeneration: (template: VideoTemplate, settings: Record<string, any>, customPrompt: string) => void;
  onOpenCreditsModal: () => void;
  onOpenAuthModal?: () => void;
}

export const TemplateDetail: React.FC<TemplateDetailProps> = ({
  template,
  userCredits,
  isLoggedIn = false,
  onBack,
  onStartGeneration,
  onOpenCreditsModal,
  onOpenAuthModal,
}) => {
  // Initialize settings from template defaults
  const [formSettings, setFormSettings] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    template.customizableFields.forEach((field) => {
      initial[field.id] = field.defaultValue;
    });
    return initial;
  });

  const [customPrompt, setCustomPrompt] = useState('');
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');

  // Dynamic credit cost calculation (based on duration)
  const currentDuration = formSettings.duration || template.defaultDurationSec;
  const calculatedCredits = currentDuration <= 20 ? 10 : currentDuration <= 35 ? 15 : 20;

  const hasEnoughCredits = userCredits >= calculatedCredits;

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormSettings((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    setActivePresetIndex(null);
  };

  const handleApplyPreset = (preset: typeof template.presetScenarios[0], index: number) => {
    setActivePresetIndex(index);
    setFormSettings((prev) => ({
      ...prev,
      ...preset.config,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasEnoughCredits) {
      onOpenCreditsModal();
      return;
    }
    onStartGeneration(template, { ...formSettings, aspectRatio }, customPrompt);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top back navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Zurück zur Template Library</span>
        </button>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">Verfügbare Credits:</span>
          <span className="font-mono tabular-nums font-bold text-amber-400 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50">
            {userCredits}
          </span>
        </div>
      </div>

      {/* Main Grid: Left large preview / Right customization form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Visual 9:16 Preview & Storyboard Sample (4 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="sticky top-20">
            <div className="rounded-3xl bg-zinc-950 border border-zinc-800 p-4 overflow-hidden shadow-sm">
              
              {/* Vertical 9:16 Preview Box */}
              <div className="relative aspect-[9/16] w-full max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 group shadow-md">
                <img
                  src={template.thumbnailUrl}
                  alt={template.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />

                {/* Scrim Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

                {/* Simulated TikTok-like Subtitles Overlay in Preview */}
                <div className="absolute bottom-6 left-4 right-4 text-center pointer-events-none">
                  <span className="inline-block bg-black/80 backdrop-blur-md px-3.5 py-1.5 rounded-lg text-xs font-black tracking-wide text-white border border-white/10 shadow-lg">
                    {formSettings.subtitles ? (
                      <>
                        <span className="text-amber-400 uppercase">„</span>
                        <span>{formSettings.storyTopic || formSettings.theme || 'Die Wahrheit kommt ans Licht...'}</span>
                        <span className="text-amber-400 uppercase">“</span>
                      </>
                    ) : (
                      <span className="text-slate-300 font-normal">Untertitel deaktiviert</span>
                    )}
                  </span>
                </div>

                {/* Format watermark */}
                <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md text-[11px] font-mono font-medium text-slate-200">
                  9:16 Shorts
                </div>

                <div className="absolute top-4 right-4 bg-rose-600 px-2 py-0.5 rounded text-[11px] font-mono font-bold text-white shadow-md">
                  {template.badge || 'Viral'}
                </div>
              </div>

              {/* Template summary */}
              <div className="mt-4 px-2">
                <h3 className="font-bold text-white text-lg">{template.title}</h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {template.tagline}
                </p>
                <div className="flex items-center gap-3 text-xs text-zinc-500 mt-3 pt-3 border-t border-zinc-900">
                  <span className="capitalize">{template.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums font-semibold text-zinc-300">{calculatedCredits} Credits</span>
                  <span aria-hidden="true">·</span>
                  <span>{currentDuration} Sek.</span>
                </div>
              </div>

            </div>

            {/* Quick Sample Dialogue Preview */}
            {template.sampleScriptPreview && template.sampleScriptPreview.length > 0 && (
              <div className="mt-4 p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xs">
                <div className="text-xs font-semibold text-white mb-2.5 flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-rose-500" />
                  <span>Beispielhafter Szenen-Ablauf</span>
                </div>
                <div className="space-y-2 text-xs">
                  {template.sampleScriptPreview.map((sc, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
                      <span className="font-semibold text-white">{sc.character}: </span>
                      <span className="italic text-zinc-400">„{sc.line}“</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Intuitive Customization Controls (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Header */}
          <div>
            <span className="text-xs font-mono text-rose-500 font-semibold uppercase tracking-wider">
              Template Konfiguration
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
              Passe dein Video an
            </h1>
            <p className="text-sm text-zinc-400 mt-1.5">
              Wähle einfache Einstellungen. Unsere Plattform übernimmt Drehbuch, Bildgenerierung, Voiceover und Schnitt automatisch.
            </p>
          </div>

          {/* Quick Presets (One-click inspiration) */}
          {template.presetScenarios && template.presetScenarios.length > 0 && (
            <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Fertige Preset-Szenarien (Schnellstart)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {template.presetScenarios.map((preset, idx) => {
                  const isSelected = activePresetIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset, idx)}
                      className={`text-left p-3 rounded-xl border text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-rose-950/30 border-rose-900 text-white'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <div className="font-semibold text-white flex items-center justify-between">
                        <span>{preset.title}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-rose-500" />}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-1 leading-snug">
                        {preset.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customization Form */}
          <form onSubmit={handleSubmit} className="space-y-6 bg-zinc-950 border border-zinc-800 p-6 sm:p-7 rounded-3xl shadow-sm">
            
            {/* AI Engine & Aspect Ratio Header */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-rose-950/30 via-amber-950/10 to-zinc-900 border border-rose-900/50 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-white">KI-Videomodell: Google Veo 3.1 Lite</span>
                </div>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-rose-900/50 text-rose-300 w-fit border border-rose-800/50">
                  veo-3.1-fast-generate-preview
                </span>
              </div>

              {/* Aspect Ratio Selector: 9:16 vs 16:9 */}
              <div className="pt-1">
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                  Video-Format (Seitenverhältnis):
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAspectRatio('9:16')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                      aspectRatio === '9:16'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span>📱 9:16 Portrait</span>
                    <span className="text-[10px] opacity-80">(TikTok, Reels, Shorts)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAspectRatio('16:9')}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                      aspectRatio === '16:9'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <span>🖥️ 16:9 Landscape</span>
                    <span className="text-[10px] opacity-80">(YouTube, Desktop)</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              {template.customizableFields.map((field) => {
                const val = formSettings[field.id];

                if (field.type === 'select' && field.options) {
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-300">
                        {field.label}
                      </label>
                      <select
                        value={val || field.defaultValue}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        className="w-full bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all cursor-pointer"
                      >
                        {field.options.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-zinc-900 text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {field.description && (
                        <p className="text-[11px] text-zinc-500">{field.description}</p>
                      )}
                    </div>
                  );
                }

                if (field.type === 'slider') {
                  return (
                    <div key={field.id} className="space-y-2 p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-zinc-300">{field.label}</span>
                        <span className="font-mono tabular-nums font-bold text-rose-500">
                          {val} {field.unit || 's'}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={field.min || 15}
                        max={field.max || 60}
                        step={field.step || 5}
                        value={val || field.defaultValue}
                        onChange={(e) => handleFieldChange(field.id, parseInt(e.target.value, 10))}
                        className="w-full accent-rose-600 cursor-pointer"
                      />
                      <div className="flex justify-between text-[10px] text-zinc-500 font-mono">
                        <span>{field.min || 15}s (Quick Short)</span>
                        <span>{field.max || 60}s (Deep Story)</span>
                      </div>
                    </div>
                  );
                }

                if (field.type === 'toggle') {
                  return (
                    <div key={field.id} className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-900 border border-zinc-800">
                      <div>
                        <div className="text-xs font-semibold text-zinc-300">{field.label}</div>
                        {field.description && (
                          <div className="text-[11px] text-zinc-500 mt-0.5">{field.description}</div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(field.id, !val)}
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                          val ? 'bg-rose-600 justify-end' : 'bg-zinc-700 justify-start'
                        }`}
                      >
                        <div className="w-4 h-4 rounded-full bg-white shadow-sm" />
                      </button>
                    </div>
                  );
                }

                if (field.type === 'text') {
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="block text-xs font-semibold text-zinc-300">
                        {field.label}
                      </label>
                      <input
                        type="text"
                        value={val || ''}
                        onChange={(e) => handleFieldChange(field.id, e.target.value)}
                        placeholder="Kurze Handlungsidee eingeben..."
                        className="w-full bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all"
                      />
                      {field.description && (
                        <p className="text-[11px] text-zinc-500">{field.description}</p>
                      )}
                    </div>
                  );
                }

                return null;
              })}

              {/* Optional Custom Free Text Wish */}
              <div className="space-y-1.5 pt-2 border-t border-zinc-900">
                <label className="block text-xs font-semibold text-zinc-300">
                  Besonderer Wunsch / Eigene Ergänzung (Optional)
                </label>
                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="z.B. Lass am Ende einen lustigen Cliffhanger einbauen oder erwähne den Rabattcode SHORTS50..."
                  className="w-full bg-zinc-900 hover:bg-zinc-800 focus:bg-zinc-800 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all resize-none"
                />
              </div>
            </div>

            {/* Cost Transparency Bar */}
            <div className="pt-4 border-t border-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-zinc-400">
                  Dieses Video benötigt <strong className="text-white font-mono font-bold">{calculatedCredits} Credits</strong>
                </span>
                {!isLoggedIn ? (
                  <span className="text-xs text-rose-600 font-semibold">(Anmeldung erforderlich)</span>
                ) : !hasEnoughCredits ? (
                  <span className="text-xs text-rose-600 font-semibold">(Nicht genügend Credits)</span>
                ) : null}
              </div>

              {/* Action Button */}
              {!isLoggedIn ? (
                <button
                  type="button"
                  onClick={onOpenAuthModal}
                  className="w-full sm:w-auto px-7 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Anmelden, um Video zu erstellen</span>
                </button>
              ) : hasEnoughCredits ? (
                <button
                  type="submit"
                  className="w-full sm:w-auto px-7 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Video jetzt erstellen ({calculatedCredits} Credits)</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenCreditsModal}
                  className="w-full sm:w-auto px-7 py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Coins className="w-4 h-4" />
                  <span>Credits aufladen</span>
                </button>
              )}
            </div>

          </form>

        </div>

      </div>

    </div>
  );
};
