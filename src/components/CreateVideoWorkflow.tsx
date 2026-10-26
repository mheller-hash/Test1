import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Users,
  MapPin,
  Clapperboard,
  Palette,
  Video,
  Volume2,
  CheckCircle2,
  Plus,
  Trash2,
  Copy,
  Check,
  Edit3,
  HelpCircle,
  Coins,
  ShieldCheck,
  AlertCircle,
  Clock,
  Layers,
  Sliders,
  ChevronRight,
  RefreshCw,
  X,
  Loader2,
  Bot,
  Eye,
  Film,
  Lightbulb,
} from 'lucide-react';
import {
  CharacterOrObject,
  EnvironmentConfig,
  SceneConfig,
  VisualStyleType,
  CameraMovementType,
  AudioConfig,
  VideoSettingsConfig,
  CreateVideoFormState,
} from '../types/workflow';
import { generateVeoPrompt } from '../lib/promptEngine';
import { UserProfile } from '../types';
import { getNicheById, getAllNiches } from '../data/niches';
import { VideoNiche, NichePromptPlan } from '../types/niche';
import { NicheSelector } from './NicheSelector';
import { authFetch } from '../lib/authFetch';

interface CreateVideoWorkflowProps {
  userCredits: number;
  isLoggedIn: boolean;
  initialNicheId?: string;
  onBackToDiscover: () => void;
  onOpenCreditsModal: () => void;
  onOpenAuthModal: () => void;
  onStartGeneration: (payload: {
    prompt: string;
    aspectRatio: '9:16' | '16:9';
    resolution: '720p' | '1080p';
    durationSec: number;
    model: string;
    title: string;
    nicheId?: string;
    promptPlan?: NichePromptPlan;
  }) => void;
}

const INITIAL_FORM_STATE: CreateVideoFormState = {
  idea: '',
  characters: [],
  environment: {
    location: '',
    timeOfDay: '',
    weatherOrAtmosphere: '',
  },
  scenes: [],
  style: 'cinematic',
  customStyleInstructions: '',
  camera: 'auto',
  customCameraInstructions: '',
  audio: {
    enableAudio: false,
    dialogue: '',
    soundEffects: '',
    ambientSound: '',
    musicMood: '',
  },
  settings: {
    aspectRatio: '9:16',
    durationSec: 15,
    resolution: '720p',
    model: 'veo-3.1-fast-generate-preview',
  },
};

interface PresetCharacter {
  id: string;
  name: string;
  appearance?: string;
  personality?: string;
  clothing?: string;
}

interface IdeaPreset {
  title: string;
  desc: string;
  characters: PresetCharacter[];
  location: string;
  time: string;
  atmosphere: string;
  style: VisualStyleType;
}

const IDEA_PRESETS: IdeaPreset[] = [
  {
    title: 'Fruit Racing Championship',
    desc: 'A vibrant strawberry and a cocky banana race through a supermarket checkout aisle.',
    characters: [
      { id: 'c1', name: 'Strawberry Speedster', appearance: 'Bright red, gold stripes', personality: 'Determined underdog' },
      { id: 'c2', name: 'Banana Turbo', appearance: 'Aerodynamic yellow peel', personality: 'Flashy veteran' },
    ],
    location: 'Modern Supermarket Aisle',
    time: 'Night after closing',
    atmosphere: 'Energetic, playful, vibrant lighting',
    style: '3d-animation',
  },
  {
    title: 'Cyberpunk Ramen Chef',
    desc: 'A cyborg street chef crafts glowing futuristic ramen noodles under pouring neon rain.',
    characters: [
      { id: 'c1', name: 'Chef Ren', appearance: 'Chrome cybernetic arm, steam goggles', clothing: 'Weathered dark apron' },
    ],
    location: 'Neo-Tokyo Alleyway',
    time: 'Midnight rain',
    atmosphere: 'Atmospheric, cinematic, volumetric steam',
    style: 'cinematic',
  },
  {
    title: 'Satisfying Kinetic Machine',
    desc: 'Intricate brass and crystal gears rolling glowing marble orbs through a mesmerizing clockwork maze.',
    characters: [],
    location: 'Victorian Clockmaker Laboratory',
    time: 'Golden Hour sunlight rays',
    atmosphere: 'Hypnotic, relaxing, macro precision',
    style: 'photorealistic',
  },
];

const STYLE_OPTIONS: { id: VisualStyleType; label: string; desc: string; icon: string }[] = [
  { id: 'cinematic', label: 'Cinematic', desc: '35mm Film-Look, Tiefenschärfe, edle Lichtreflexe', icon: '🎬' },
  { id: 'photorealistic', label: 'Photorealistic', desc: 'Detailreiche Texturen, lebensechte Physik, 8K Optik', icon: '📸' },
  { id: '3d-animation', label: '3D Animation', desc: 'Pixar/DreamWorks Stil, lebendige Shader & Mimik', icon: '✨' },
  { id: 'cartoon', label: 'Cartoon', desc: 'Ausdrucksstarke Outlines, dynamische Übertreibung', icon: '🎨' },
  { id: 'anime', label: 'Anime', desc: 'Shinkai/Ghibli Ästhetik, emotionale Lichtstimmung', icon: '🌸' },
  { id: 'stylized', label: 'Stylized', desc: 'Künstlerische Farbpalette, experimentelles Grafikdesign', icon: '🔮' },
  { id: 'custom', label: 'Custom', desc: 'Individuelle stilistische Vorgaben nach eigenem Wunsch', icon: '⚙️' },
];

const CAMERA_OPTIONS: { id: CameraMovementType; label: string; desc: string }[] = [
  { id: 'auto', label: 'Auto (Empfohlen)', desc: 'Optimale Kamerawahl passend zur Szenenhandlung' },
  { id: 'cinematic', label: 'Cinematic Flow', desc: 'Sanfter Dolly-Push-in und kinoreife Schwenks' },
  { id: 'close-up', label: 'Close-up', desc: 'Nahaufnahme auf Mimik, Details und Emotionen' },
  { id: 'medium-shot', label: 'Medium Shot', desc: 'Ausgewogene Halbtotale (Figur & Umgebung)' },
  { id: 'wide-shot', label: 'Wide Shot', desc: 'Totale Übersicht über Schauplatz & Szenerie' },
  { id: 'tracking-shot', label: 'Tracking Shot', desc: 'Fließende Verfolgungskamera mit hoher Dynamik' },
  { id: 'pov', label: 'POV', desc: 'Ego-Perspektive aus Sicht des Protagonisten' },
  { id: 'custom', label: 'Custom', desc: 'Eigene Kameraparameter eingeben' },
];

export const CreateVideoWorkflow: React.FC<CreateVideoWorkflowProps> = ({
  userCredits,
  isLoggedIn,
  initialNicheId,
  onBackToDiscover,
  onOpenCreditsModal,
  onOpenAuthModal,
  onStartGeneration,
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedNicheId, setSelectedNicheId] = useState<string>(initialNicheId || 'fruit-stories');
  const [isNicheModalOpen, setIsNicheModalOpen] = useState<boolean>(false);
  const currentNiche = useMemo(() => getNicheById(selectedNicheId), [selectedNicheId]);

  const [form, setForm] = useState<CreateVideoFormState>(INITIAL_FORM_STATE);
  const [manualPromptOverride, setManualPromptOverride] = useState<string>('');
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Gemini Niche Prompt Director state
  const [promptPlan, setPromptPlan] = useState<NichePromptPlan | null>(null);
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [optimizationError, setOptimizationError] = useState<string | null>(null);
  const [planNeedsUpdate, setPlanNeedsUpdate] = useState<boolean>(false);
  const [activeSpecTab, setActiveSpecTab] = useState<'overview' | 'characters' | 'timeline' | 'audio' | 'avoid'>('overview');

  // Track if user modified inputs since last Gemini plan
  useEffect(() => {
    if (promptPlan) {
      setPlanNeedsUpdate(true);
    }
  }, [form.idea, form.style, form.camera, form.characters, form.scenes, form.environment, form.settings, selectedNicheId]);

  // Dynamic credit cost based on duration
  const creditCost = useMemo(() => {
    const dur = form.settings.durationSec;
    return dur <= 20 ? 10 : dur <= 35 ? 15 : 20;
  }, [form.settings.durationSec]);

  // Compute structured prompt via Prompt Engine fallback
  const engineResult = useMemo(() => {
    return generateVeoPrompt(form);
  }, [form]);

  // Active prompt for generation (Gemini plan takes precedence, fallback to local engineResult)
  const activePrompt = useMemo(() => {
    if (isEditingPrompt && manualPromptOverride.trim().length > 0) {
      return manualPromptOverride.trim();
    }
    if (promptPlan?.veoPrompt) {
      return promptPlan.veoPrompt;
    }
    return engineResult.prompt;
  }, [isEditingPrompt, manualPromptOverride, promptPlan, engineResult.prompt]);

  // Trigger Gemini Prompt Director optimization
  const handleOptimizeWithGemini = async () => {
    if (!isLoggedIn) {
      onOpenAuthModal();
      return;
    }

    const userIdea = form.idea.trim() || currentNiche.tagline || currentNiche.description;
    setIsOptimizing(true);
    setOptimizationError(null);

    try {
      const res = await authFetch('/api/optimize-niche-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheId: selectedNicheId,
          userIdea,
          durationSec: form.settings.durationSec,
          aspectRatio: form.settings.aspectRatio,
          resolution: form.settings.resolution,
          userOverrides: {
            style: form.style,
            customStyle: form.customStyleInstructions,
            camera: form.camera,
            characters: form.characters,
            environment: form.environment,
          },
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Fehler bei der Prompt-Optimierung (${res.status})`);
      }

      const data = await res.json();
      if (data.plan) {
        setPromptPlan(data.plan);
        setPlanNeedsUpdate(false);
        if (!isEditingPrompt) {
          setManualPromptOverride(data.plan.veoPrompt);
        }
      }
    } catch (err: any) {
      console.error('Prompt optimization error:', err);
      setOptimizationError(err.message || 'Optimierung fehlgeschlagen.');
    } finally {
      setIsOptimizing(false);
    }
  };

  // Auto-optimize with Gemini when entering review step 6
  useEffect(() => {
    if (step === 6 && !promptPlan && !isOptimizing && isLoggedIn) {
      handleOptimizeWithGemini();
    }
  }, [step, isLoggedIn]);

  // Step 2 Character helpers
  const handleAddCharacter = () => {
    const newChar: CharacterOrObject = {
      id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: '',
      appearance: '',
      personality: '',
      clothing: '',
    };
    setForm((prev) => ({ ...prev, characters: [...prev.characters, newChar] }));
  };

  const handleUpdateCharacter = (id: string, field: keyof CharacterOrObject, val: string) => {
    setForm((prev) => ({
      ...prev,
      characters: prev.characters.map((c) => (c.id === id ? { ...c, [field]: val } : c)),
    }));
  };

  const handleRemoveCharacter = (id: string) => {
    setForm((prev) => ({
      ...prev,
      characters: prev.characters.filter((c) => c.id !== id),
    }));
  };

  // Step 4 Scene helpers
  const handleAddScene = () => {
    const newScene: SceneConfig = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sceneNumber: form.scenes.length + 1,
      description: '',
      action: '',
      dialogue: '',
    };
    setForm((prev) => ({ ...prev, scenes: [...prev.scenes, newScene] }));
  };

  const handleUpdateScene = (id: string, field: keyof SceneConfig, val: any) => {
    setForm((prev) => ({
      ...prev,
      scenes: prev.scenes.map((s) => (s.id === id ? { ...s, [field]: val } : s)),
    }));
  };

  const handleRemoveScene = (id: string) => {
    setForm((prev) => {
      const filtered = prev.scenes.filter((s) => s.id !== id);
      const renumbered = filtered.map((s, idx) => ({ ...s, sceneNumber: idx + 1 }));
      return { ...prev, scenes: renumbered };
    });
  };

  // Copy prompt helper
  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(activePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Preset loader
  const handleApplyPreset = (preset: typeof IDEA_PRESETS[0]) => {
    setForm((prev) => ({
      ...prev,
      idea: preset.desc,
      characters: preset.characters.map((c, i) => ({
        id: `c-${i + 1}`,
        name: c.name,
        appearance: c.appearance || '',
        personality: c.personality || '',
        clothing: (c as any).clothing || '',
      })),
      environment: {
        location: preset.location,
        timeOfDay: preset.time,
        weatherOrAtmosphere: preset.atmosphere,
      },
      style: preset.style,
    }));
  };

  // Submission handler
  const handleGenerateClick = () => {
    if (!isLoggedIn) {
      onOpenAuthModal();
      return;
    }
    if (userCredits < creditCost) {
      onOpenCreditsModal();
      return;
    }

    onStartGeneration({
      prompt: activePrompt,
      aspectRatio: form.settings.aspectRatio,
      resolution: form.settings.resolution,
      durationSec: form.settings.durationSec,
      model: form.settings.model,
      title: form.idea.slice(0, 40) || `${currentNiche.name} Video`,
      nicheId: currentNiche.id,
      promptPlan: promptPlan || undefined,
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans">
      
      {/* Header bar with Back button and Credits indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToDiscover}
            className="p-2 rounded-xl border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Zurück zur Übersicht"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-950/30 text-rose-400 border border-rose-900/50">
                <Sparkles className="w-3 h-3 text-rose-500" />
                Veo 3.1 Studio
              </span>
              <span className="text-xs text-zinc-500 font-medium">Schritt {step} von 6</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white mt-0.5">
              Video erstellen & strukturieren
            </h1>
          </div>
        </div>

        {/* User Balance & Cost Pill */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs">
            <span className="text-zinc-500">Kosten:</span>
            <span className="font-mono font-bold text-white">{creditCost} Credits</span>
          </div>

          <button
            onClick={onOpenCreditsModal}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-950/30 border border-amber-900/50 text-xs font-semibold text-amber-400 hover:bg-amber-900/50 transition-colors cursor-pointer"
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span>Guthaben: {isLoggedIn ? userCredits : 0} Credits</span>
          </button>
        </div>
      </div>

      {/* Prominent Active Niche Status Bar */}
      <div className="rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white border border-slate-700/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center text-2xl shrink-0 border border-white/15 shadow-inner">
            <span role="img" aria-label={currentNiche.name}>
              {currentNiche.accent.icon}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
                Ausgewählte Nische
              </span>
              {currentNiche.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white">
                  {currentNiche.badge}
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2 mt-0.5">
              <span>{currentNiche.name}</span>
            </h2>
            <p className="text-xs text-slate-300 line-clamp-1 mt-0.5 font-medium">
              {currentNiche.tagline}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNicheModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 transition-all shrink-0 cursor-pointer self-start sm:self-auto hover:border-white/40"
          title="Eine andere vorgegebene Nische auswählen"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Nische wechseln</span>
        </button>
      </div>

      {/* Progress Stepper Bar */}
      <div className="grid grid-cols-6 gap-2 text-xs">
        {[
          { num: 1, label: 'Idee', icon: Sparkles },
          { num: 2, label: 'Figuren', icon: Users },
          { num: 3, label: 'Welt', icon: MapPin },
          { num: 4, label: 'Story', icon: Clapperboard },
          { num: 5, label: 'Stil & Audio', icon: Palette },
          { num: 6, label: 'Review', icon: CheckCircle2 },
        ].map((s) => {
          const isActive = step === s.num;
          const isPassed = step > s.num;
          const Icon = s.icon;
          return (
            <button
              key={s.num}
              onClick={() => {
                // Only allow navigating backwards or to step 1 anytime
                if (s.num <= step || form.idea.trim().length > 0) {
                  setStep(s.num);
                }
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-rose-600 border-rose-600 text-white font-bold shadow-sm shadow-rose-500/20'
                  : isPassed
                  ? 'bg-emerald-950/30 border-emerald-900/50 text-emerald-400 font-semibold'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{s.label}</span>
            </button>
          );
        })}
      </div>

      {/* STEP 1: IDEA & CONCEPT */}
      {step === 1 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" />
              Was soll in deinem Video passieren?
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Beschreibe deine zentrale Idee. Es kann ein kurzer Satz oder eine ausführliche Handlungsbeschreibung sein.
            </p>
          </div>

          <div className="space-y-2">
            <textarea
              rows={4}
              placeholder="Beispiel: Eine animierte Erdbeere und eine Banane liefern sich nachts ein rasantes Wettrennen durch einen Supermarkt..."
              value={form.idea}
              onChange={(e) => setForm((prev) => ({ ...prev, idea: e.target.value }))}
              className="w-full bg-zinc-900 rounded-2xl border border-zinc-800 p-4 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition-all resize-y"
            />
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <span>Je präziser die Kernhandlung, desto besser das Veo-Ergebnis.</span>
              <span>{form.idea.length} Zeichen</span>
            </div>
          </div>

          {/* Quick Idea Presets tailored to Active Niche */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Inspirations-Ideen für Nische "{currentNiche.name}":
              </span>
              <button
                type="button"
                onClick={() => setIsNicheModalOpen(true)}
                className="text-xs text-rose-500 hover:text-rose-400 font-semibold cursor-pointer"
              >
                Nische wechseln
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {currentNiche.sampleIdeas.map((idea, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, idea: idea.promptSnippet }))}
                  className="text-left p-3.5 rounded-2xl border border-rose-900/50 bg-rose-950/20 hover:bg-rose-950/40 hover:border-rose-800 transition-all group cursor-pointer"
                >
                  <div className="font-bold text-xs text-white group-hover:text-rose-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span>{currentNiche.accent.icon}</span>
                      <span>{idea.title}</span>
                    </span>
                    <Sparkles className="w-3 h-3 text-rose-500 shrink-0" />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                    {idea.hook}
                  </p>
                </button>
              ))}
            </div>

            {/* General presets toggle */}
            <details className="text-xs text-zinc-500 group">
              <summary className="cursor-pointer font-medium hover:text-zinc-300 list-none flex items-center gap-1.5">
                <ChevronRight className="w-3.5 h-3.5 group-open:rotate-90 transition-transform" />
                <span>Weitere allgemeine Format-Vorlagen anzeigen</span>
              </summary>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                {IDEA_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className="text-left p-3 rounded-xl border border-zinc-800 hover:border-zinc-700 bg-zinc-900 hover:bg-zinc-800 transition-all cursor-pointer"
                  >
                    <div className="font-semibold text-xs text-white line-clamp-1">{preset.title}</div>
                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* Action Navigation */}
          <div className="flex justify-end pt-4 border-t border-zinc-900">
            <button
              disabled={form.idea.trim().length === 0}
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white font-semibold text-sm transition-all shadow-sm shadow-rose-600/20 cursor-pointer disabled:cursor-not-allowed"
            >
              <span>Weiter: Figuren & Objekte</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CHARACTERS / OBJECTS */}
      {step === 2 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-rose-500" />
                Hauptfiguren & Objekte definieren (Optional)
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Füge Charaktere oder zentrale Objekte hinzu, damit Veo ihr Aussehen konsistent beibehält.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddCharacter}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto border border-zinc-800"
            >
              <Plus className="w-4 h-4 text-rose-500" />
              <span>Figur hinzufügen</span>
            </button>
          </div>

          {form.characters.length === 0 ? (
            <div className="text-center py-10 px-4 rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 space-y-3">
              <Users className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                Noch keine Figuren angelegt. Veo nutzt automatisch die in deiner Idee genannten Subjekte, oder du fügst hier feste Figuren hinzu.
              </p>
              <button
                type="button"
                onClick={handleAddCharacter}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-rose-500/50 text-xs font-semibold text-zinc-300 shadow-2xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-rose-500" />
                <span>Erste Figur anlegen</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {form.characters.map((char, index) => (
                <div
                  key={char.id}
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-3 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-rose-950 text-rose-400 text-[10px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      {char.name ? char.name : `Figur #${index + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCharacter(char.id)}
                      className="text-zinc-600 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                      title="Figur löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                        Name / Rolle *
                      </label>
                      <input
                        type="text"
                        placeholder="z. B. Erdbeere, Detektiv Müller, Roter Sportwagen"
                        value={char.name}
                        onChange={(e) => handleUpdateCharacter(char.id, 'name', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                        Aussehen / Optik
                      </label>
                      <input
                        type="text"
                        placeholder="z. B. leuchtend rot mit goldenen Rennstreifen"
                        value={char.appearance || ''}
                        onChange={(e) => handleUpdateCharacter(char.id, 'appearance', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                        Verhalten / Persönlichkeit
                      </label>
                      <input
                        type="text"
                        placeholder="z. B. ehrgeizig, frech, übermütig"
                        value={char.personality || ''}
                        onChange={(e) => handleUpdateCharacter(char.id, 'personality', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                        Kleidung / Accessoires
                      </label>
                      <input
                        type="text"
                        placeholder="z. B. grünes Stirnband, dunkle Sonnenbrille"
                        value={char.clothing || ''}
                        onChange={(e) => handleUpdateCharacter(char.id, 'clothing', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <button
              onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-500 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
            >
              <span>Weiter: Umgebung & Schauplatz</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: ENVIRONMENT & ATMOSPHERE */}
      {step === 3 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-500" />
              Umgebung, Licht & Atmosphäre
            </h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Wo und wann spielt deine Szene? Diese Details sorgen für kinoreife Beleuchtung und Tiefenwirkung.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Schauplatz / Location
              </label>
              <input
                type="text"
                placeholder="z. B. Moderner Supermarkt nach Ladenschluss, Neon-Gasse in Tokio, Gemütliche Berghütte"
                value={form.environment.location}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    environment: { ...prev.environment, location: e.target.value },
                  }))
                }
                className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Tageszeit / Lichtverhältnisse
                </label>
                <input
                  type="text"
                  placeholder="z. B. Mitternacht mit kaltem Neonlicht, Golden Hour, Sonniger Vormittag"
                  value={form.environment.timeOfDay || ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      environment: { ...prev.environment, timeOfDay: e.target.value },
                    }))
                  }
                  className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Wetter / Stimmung & Atmosphäre
                </label>
                <input
                  type="text"
                  placeholder="z. B. Lustig, chaotisch, dramatischer Nebel, warmer Sommerwind"
                  value={form.environment.weatherOrAtmosphere || ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      environment: { ...prev.environment, weatherOrAtmosphere: e.target.value },
                    }))
                  }
                  className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <button
              onClick={() => setStep(2)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-500 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
            >
              <span>Weiter: Story & Szenenablauf</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: STORY & SCENES */}
      {step === 4 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Clapperboard className="w-5 h-5 text-rose-500" />
                Handlungsablauf & Szenen (Optional)
              </h2>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Unterteile dein Video in chronologische Szenen. Wenn du keine Szenen anlegst, wird automatisch deine Kernidee als Gesamtszene gerendert.
              </p>
            </div>

            <button
              type="button"
              onClick={handleAddScene}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto border border-zinc-800"
            >
              <Plus className="w-4 h-4 text-rose-500" />
              <span>Szene hinzufügen</span>
            </button>
          </div>

          {form.scenes.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-zinc-800 bg-zinc-900/50 space-y-2">
              <Clapperboard className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-xs text-zinc-500 font-medium">
                Aktuell wird deine Hauptidee als zusammenhängendes Video gerendert.
              </p>
              <p className="text-[11px] text-zinc-600 max-w-sm mx-auto">
                Möchtest du eine exakte Reihenfolge vorgeben (z. B. Start, Verfolgungsjagd, Zieldurchfahrt)? Füge einzelne Szenen hinzu.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {form.scenes.map((scene, index) => (
                <div
                  key={scene.id}
                  className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-rose-600 text-white text-[10px] flex items-center justify-center font-bold">
                        {index + 1}
                      </span>
                      Szene {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveScene(scene.id)}
                      className="text-zinc-600 hover:text-rose-500 transition-colors p-1 cursor-pointer"
                      title="Szene löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <input
                        type="text"
                        placeholder="Was passiert in dieser Szene? (z. B. Erdbeere betritt den Supermarkt und schaut sich um)"
                        value={scene.description}
                        onChange={(e) => handleUpdateScene(scene.id, 'description', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Optionale Aktion / Kamerabewegung (z. B. Schneller Schwenk nach rechts)"
                        value={scene.action || ''}
                        onChange={(e) => handleUpdateScene(scene.id, 'action', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:border-rose-500"
                      />
                      <input
                        type="text"
                        placeholder='Gesprochener Dialog (z. B. "Jetzt geht es los!")'
                        value={scene.dialogue || ''}
                        onChange={(e) => handleUpdateScene(scene.id, 'dialogue', e.target.value)}
                        className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-1.5 text-[11px] text-zinc-300 focus:outline-none focus:border-rose-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-zinc-900">
            <button
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-500 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
            >
              <span>Weiter: Stil, Kamera & Audio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: STYLE, CAMERA, AUDIO & TECHNICAL SPECS */}
      {step === 5 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-8 shadow-sm">
          {/* Visual Style Selection */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-rose-500" />
              Visueller Stil
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {STYLE_OPTIONS.map((opt) => {
                const isSelected = form.style === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, style: opt.id }))}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-rose-600 bg-rose-950/30 ring-1 ring-rose-600'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{opt.icon}</span>
                      <span className="font-bold text-xs text-white">{opt.label}</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-snug">
                      {opt.desc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-1">
              <input
                type="text"
                placeholder="Zusätzliche visuelle Anweisungen (z. B. Warme Farbtöne, 90er VHS-Körnung, Neonglühen)..."
                value={form.customStyleInstructions || ''}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, customStyleInstructions: e.target.value }))
                }
                className="w-full bg-zinc-900 rounded-xl border border-zinc-800 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Camera Settings */}
          <div className="space-y-3 pt-4 border-t border-zinc-900">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-rose-500" />
              Kameraführung
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CAMERA_OPTIONS.map((cam) => {
                const isSelected = form.camera === cam.id;
                return (
                  <button
                    key={cam.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, camera: cam.id }))}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-rose-600 bg-rose-950/30 font-bold text-rose-300'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 text-zinc-400 hover:text-zinc-300'
                    }`}
                  >
                    <div className="text-xs">{cam.label}</div>
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5">{cam.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Audio & Sound Design */}
          <div className="space-y-3 pt-4 border-t border-zinc-900">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-rose-600" />
                Audio & Sounddesign (Veo-kompatibel)
              </h2>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-400 hover:text-zinc-300">
                <input
                  type="checkbox"
                  checked={form.audio.enableAudio}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      audio: { ...prev.audio, enableAudio: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
                <span>Audio aktivieren</span>
              </label>
            </div>

            {form.audio.enableAudio && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-zinc-900 border border-zinc-800 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                    Gesprochener Dialog / Voiceover
                  </label>
                  <input
                    type="text"
                    placeholder='z. B. "Auf die Plätze, fertig, los!"'
                    value={form.audio.dialogue || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        audio: { ...prev.audio, dialogue: e.target.value },
                      }))
                    }
                    className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                    Sound-Effekte (SFX)
                  </label>
                  <input
                    type="text"
                    placeholder="z. B. Reifenquietschen, Einkaufswagenscheppern, Jubel"
                    value={form.audio.soundEffects || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        audio: { ...prev.audio, soundEffects: e.target.value },
                      }))
                    }
                    className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                    Umgebungsgeräusche / Atmosphäre
                  </label>
                  <input
                    type="text"
                    placeholder="z. B. Supermarkt-Hintergrund, Durchsagen, Schritte"
                    value={form.audio.ambientSound || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        audio: { ...prev.audio, ambientSound: e.target.value },
                      }))
                    }
                    className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 mb-1">
                    Musikstil & Mood
                  </label>
                  <input
                    type="text"
                    placeholder="z. B. Schneller energetischer Synthwave-Track"
                    value={form.audio.musicMood || ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        audio: { ...prev.audio, musicMood: e.target.value },
                      }))
                    }
                    className="w-full bg-zinc-950 rounded-xl border border-zinc-800 px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Technical Video Settings */}
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="w-5 h-5 text-rose-600" />
              Technische Video-Einstellungen
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Aspect Ratio */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Format / Aspect Ratio
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, aspectRatio: '9:16' },
                      }))
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      form.settings.aspectRatio === '9:16'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    9:16 (Vertikal)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, aspectRatio: '16:9' },
                      }))
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      form.settings.aspectRatio === '16:9'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    16:9 (Horizontal)
                  </button>
                </div>
              </div>

              {/* Duration */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Dauer</label>
                  <span className="font-mono text-xs font-bold text-white">
                    {form.settings.durationSec}s ({creditCost} Credits)
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={45}
                  step={5}
                  value={form.settings.durationSec}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, durationSec: Number(e.target.value) },
                    }))
                  }
                  className="w-full accent-rose-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1">
                  <span>10s (10 Cr)</span>
                  <span>25s (15 Cr)</span>
                  <span>45s (20 Cr)</span>
                </div>
              </div>

              {/* Resolution */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
                  Auflösung
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, resolution: '720p' },
                      }))
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      form.settings.resolution === '720p'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    720p HD (Schnell)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        settings: { ...prev.settings, resolution: '1080p' },
                      }))
                    }
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      form.settings.resolution === '1080p'
                        ? 'border-rose-600 bg-rose-50/50 text-rose-700'
                        : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                    }`}
                  >
                    1080p Full HD
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
            <button
              onClick={() => setStep(4)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück</span>
            </button>
            <button
              onClick={() => setStep(6)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition-all shadow-sm shadow-rose-600/20 cursor-pointer"
            >
              <span>Weiter: Review & Prompt Preview</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: REVIEW & PROMPT PREVIEW */}
      {step === 6 && (
        <div className="bg-zinc-950 rounded-3xl border border-zinc-800 p-6 sm:p-8 space-y-6 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Review & Video-Vorschau
            </h2>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Prüfe deine Konfiguration und den für Google Veo optimierten Prompt, bevor Credits abgebucht werden.
            </p>
          </div>

          {/* Video Parameter Summary Card */}
          <div className="rounded-2xl bg-black border border-zinc-800 p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Zusammenfassung deiner Konfiguration
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-zinc-500 block text-[11px]">Format & Dauer</span>
                <span className="font-semibold text-zinc-300">
                  {form.settings.aspectRatio} · {form.settings.durationSec}s ({form.settings.resolution})
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Stil & Kamera</span>
                <span className="font-semibold text-zinc-300 capitalize">
                  {form.style} · {form.camera}
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Figuren & Szenen</span>
                <span className="font-semibold text-zinc-300">
                  {form.characters.length} Figuren · {form.scenes.length || 1} Szenen
                </span>
              </div>
              <div>
                <span className="text-zinc-500 block text-[11px]">Kosten</span>
                <span className="font-mono font-bold text-rose-500">{creditCost} Credits</span>
              </div>
            </div>

            {form.environment.location && (
              <div className="pt-2 border-t border-zinc-800/60 text-xs">
                <span className="text-zinc-500 text-[11px]">Schauplatz: </span>
                <span className="font-medium text-zinc-400">{form.environment.location}</span>
                {form.environment.timeOfDay && (
                  <span className="text-zinc-500"> ({form.environment.timeOfDay})</span>
                )}
              </div>
            )}
          </div>

          {/* Gemini Niche Prompt Director Review Panel */}
          <div className="rounded-3xl border border-indigo-900/50 bg-gradient-to-b from-indigo-950/20 via-black to-black p-5 sm:p-6 space-y-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      Gemini Prompt Director · {currentNiche.name}
                    </h3>
                    <span className="text-[10px] font-semibold bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">
                      KI-Regie
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Spezialisierte Szenenplanung nach den Gestaltungsregeln von {currentNiche.name}.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOptimizeWithGemini()}
                  disabled={isOptimizing}
                  className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  {isOptimizing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Optimiert Szene...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{promptPlan ? (planNeedsUpdate ? 'Planung aktualisieren' : 'Neu berechnen') : 'Mit Gemini optimieren'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Input change notification */}
            {planNeedsUpdate && promptPlan && (
              <div className="flex items-center gap-2 p-3 bg-amber-950/30 border border-amber-900/50 rounded-xl text-xs text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Deine Videoeinstellungen wurden geändert. Klicke auf <strong>"Planung aktualisieren"</strong>, um den Prompt mit den neuen Werten neu zu generieren.
                </span>
              </div>
            )}

            {/* Error state */}
            {optimizationError && (
              <div className="flex items-center justify-between p-3.5 bg-rose-950/30 border border-rose-900/50 rounded-xl text-xs text-rose-300">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <span>{optimizationError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleOptimizeWithGemini()}
                  className="font-bold underline text-rose-400 hover:text-rose-300 cursor-pointer"
                >
                  Erneut versuchen
                </button>
              </div>
            )}

            {/* Loading placeholder */}
            {isOptimizing && !promptPlan && (
              <div className="py-10 text-center space-y-3 bg-indigo-950/20 rounded-2xl border border-indigo-900/30">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                <p className="text-xs font-semibold text-zinc-200">
                  Gemini Prompt Director analysiert deine Idee für {currentNiche.name}...
                </p>
                <p className="text-[11px] text-zinc-500 max-w-sm mx-auto">
                  Beleuchtung, Kamerabewegung und Konsistenzregeln werden für Google Veo berechnet.
                </p>
              </div>
            )}

            {/* Structured Plan Content */}
            {promptPlan && (
              <div className="space-y-4">
                {/* German Summary Card */}
                <div className="p-4 bg-gradient-to-r from-indigo-950/40 via-zinc-900/40 to-zinc-950/40 rounded-2xl border border-indigo-900/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300 uppercase tracking-wider mb-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Geplante Szene (Zusammenfassung)</span>
                  </div>
                  <p className="text-xs sm:text-sm font-medium text-zinc-200 leading-relaxed">
                    {promptPlan.summaryGerman}
                  </p>
                </div>

                {/* Sub-Tabs for Specifications */}
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5 overflow-x-auto border-b border-zinc-800 pb-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveSpecTab('overview')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        activeSpecTab === 'overview'
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      Figuren & Schauplatz
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSpecTab('timeline')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        activeSpecTab === 'timeline'
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      Ablauf & Kamera ({promptPlan.structuredSpec.timeline.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSpecTab('audio')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        activeSpecTab === 'audio'
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      Audio & Sounddesign
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSpecTab('avoid')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                        activeSpecTab === 'avoid'
                          ? 'bg-zinc-800 text-white shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                      }`}
                    >
                      Qualitätsregeln ({promptPlan.structuredSpec.avoidElements.length})
                    </button>
                  </div>

                  {/* Tab Panel: Overview */}
                  {activeSpecTab === 'overview' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
                        <span className="font-bold text-zinc-300 block text-[11px] uppercase tracking-wider">
                          Hauptfiguren & Aussehen
                        </span>
                        <div className="space-y-1.5">
                          {promptPlan.structuredSpec.mainCharacters.map((c, idx) => (
                            <div key={idx} className="bg-zinc-900 p-2 rounded-lg border border-zinc-800">
                              <span className="font-semibold text-indigo-400">{c.name}</span>
                              {c.personalityOrRole && (
                                <span className="text-zinc-500 text-[10px] ml-1">({c.personalityOrRole})</span>
                              )}
                              <p className="text-[11px] text-zinc-400 mt-0.5">{c.appearance}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2">
                        <span className="font-bold text-zinc-300 block text-[11px] uppercase tracking-wider">
                          Schauplatz, Licht & Optik
                        </span>
                        <div className="space-y-1 text-[11px]">
                          <p><strong className="text-zinc-400">Setting:</strong> {promptPlan.structuredSpec.environment.setting}</p>
                          <p><strong className="text-zinc-400">Tageszeit:</strong> {promptPlan.structuredSpec.environment.timeOfDay}</p>
                          <p><strong className="text-zinc-400">Licht:</strong> {promptPlan.structuredSpec.environment.lightingAndAtmosphere}</p>
                          <p><strong className="text-zinc-400">Stil:</strong> {promptPlan.structuredSpec.visualStyle}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab Panel: Timeline */}
                  {activeSpecTab === 'timeline' && (
                    <div className="space-y-2 text-xs">
                      {promptPlan.structuredSpec.timeline.map((item, idx) => (
                        <div key={idx} className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="space-y-1">
                            <span className="inline-block px-2 py-0.5 rounded bg-zinc-800 font-mono font-bold text-[10px] text-zinc-400">
                              {item.timestampSec}
                            </span>
                            <p className="font-medium text-zinc-200">{item.visual}</p>
                            {item.audioOrSfx && (
                              <p className="text-[11px] text-indigo-400">Audio: {item.audioOrSfx}</p>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 bg-zinc-900 px-2 py-1 rounded-md border border-zinc-800 shrink-0">
                            🎥 {item.cameraMovement}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Tab Panel: Audio */}
                  {activeSpecTab === 'audio' && (
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2 text-xs">
                      <p><strong className="text-zinc-400">Raum-Atmosphäre:</strong> {promptPlan.structuredSpec.audioAndSoundEffects.ambient}</p>
                      <div>
                        <strong className="text-zinc-400 block mb-1">Soundeffekte (SFX):</strong>
                        <div className="flex flex-wrap gap-1.5">
                          {promptPlan.structuredSpec.audioAndSoundEffects.sfx.map((sfx, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300">
                              🔊 {sfx}
                            </span>
                          ))}
                        </div>
                      </div>
                      {promptPlan.structuredSpec.audioAndSoundEffects.dialogueOrVoiceover && (
                        <p className="pt-1 border-t border-zinc-800/60">
                          <strong className="text-zinc-400">Dialog:</strong> "{promptPlan.structuredSpec.audioAndSoundEffects.dialogueOrVoiceover}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Tab Panel: Avoid / Quality */}
                  {activeSpecTab === 'avoid' && (
                    <div className="p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 space-y-2 text-xs">
                      <span className="font-bold text-zinc-300 block text-[11px] uppercase tracking-wider">
                        Unerwünschte Elemente (Negative Constraints)
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {promptPlan.structuredSpec.avoidElements.map((item, idx) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-950/30 border border-rose-900/50 text-[11px] font-medium text-rose-300">
                            ✕ {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Generated Veo Prompt Card */}
          <div className="rounded-2xl border border-zinc-800 bg-black overflow-hidden shadow-2xs">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-white">
                  Strukturierter Veo 3.1 Prompt
                </span>
                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full font-mono">
                  {activePrompt.length} / 2000 Zeichen
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingPrompt(!isEditingPrompt)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    isEditingPrompt
                      ? 'bg-rose-950 text-rose-400'
                      : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingPrompt ? 'Auto-Prompt nutzen' : 'Manuell anpassen'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-400">Kopiert!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Kopieren</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-4">
              {isEditingPrompt ? (
                <textarea
                  rows={8}
                  value={manualPromptOverride || engineResult.prompt}
                  onChange={(e) => setManualPromptOverride(e.target.value)}
                  className="w-full font-mono text-xs text-white bg-zinc-900 rounded-xl border border-zinc-800 p-3 focus:outline-none focus:border-rose-500"
                />
              ) : (
                <pre className="font-mono text-xs text-zinc-300 whitespace-pre-wrap bg-zinc-900/60 p-4 rounded-xl border border-zinc-800 max-h-72 overflow-y-auto leading-relaxed">
                  {engineResult.prompt}
                </pre>
              )}
            </div>
          </div>

          {/* Insufficient Credits Warning if applicable */}
          {isLoggedIn && userCredits < creditCost && (
            <div className="flex items-center justify-between p-4 rounded-2xl bg-amber-950/20 border border-amber-900/30 text-xs text-amber-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>
                  Dein Guthaben ({userCredits} Credits) reicht nicht für diese Generierung ({creditCost} Credits).
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenCreditsModal}
                className="font-bold underline text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                Credits aufladen
              </button>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-zinc-900">
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-zinc-400 hover:text-white font-semibold text-xs transition-colors cursor-pointer order-2 sm:order-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Zurück zur Bearbeitung</span>
            </button>

            <button
              onClick={handleGenerateClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-md shadow-rose-600/20 transition-all transform hover:-translate-y-0.5 cursor-pointer order-1 sm:order-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>Video jetzt generieren ({creditCost} Credits)</span>
            </button>
          </div>
        </div>
      )}

      {/* Niche Switcher Modal */}
      {isNicheModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-800">
            <button
              onClick={() => setIsNicheModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-xl text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            <NicheSelector
              selectedNicheId={selectedNicheId}
              onSelectNiche={(niche) => {
                setSelectedNicheId(niche.id);
                setIsNicheModalOpen(false);
              }}
              title="Video-Nische wechseln"
              subtitle="Wähle eine der 4 vorgegebenen Nischen. Deine Eingaben bleiben erhalten."
            />
          </div>
        </div>
      )}

    </div>
  );
};
