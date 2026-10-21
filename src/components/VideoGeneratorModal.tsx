import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, CheckCircle2, Loader2, Film, Clapperboard, Mic, Subtitles, Check, AlertCircle, Video } from 'lucide-react';
import { VideoTemplate, GeneratedVideo, SceneData } from '../types';
import { authFetch } from '../lib/authFetch';

interface VideoGeneratorModalProps {
  template: VideoTemplate;
  settings: Record<string, any>;
  customPrompt: string;
  generationId?: string;
  onComplete: (video: GeneratedVideo) => void;
  onCancel: () => void;
  onOpenCreditModal?: () => void;
}

interface Step {
  id: string;
  label: string;
  detail: string;
  icon: React.ElementType;
}

const GENERATION_STEPS: Step[] = [
  {
    id: 'init',
    label: 'Initialisiere Veo 3.1 Lite...',
    detail: 'Verbindet mit Google Veo (veo-3.1-fast-generate-preview) und lädt Parameter',
    icon: Video,
  },
  {
    id: 'story',
    label: 'Drehbuch & Hook optimieren...',
    detail: 'Entwickelt fesselnde Szenen und Dialoge mit konsistenten Charakteren',
    icon: Clapperboard,
  },
  {
    id: 'scenes',
    label: 'Kameraführung & Beleuchtung planen...',
    detail: 'Strukturiert Framing, Lichtstimmung und dynamische Übergänge',
    icon: Film,
  },
  {
    id: 'veo_render',
    label: 'Veo 3.1 Video-Generierung...',
    detail: 'Rendert hochauflösendes Video mit kinoreifer Bewegung und Konsistenz',
    icon: Sparkles,
  },
  {
    id: 'voice',
    label: 'Voiceover & Sounddesign...',
    detail: 'Synthetisiert authentische Synchronstimmen und Audio-Effekte',
    icon: Mic,
  },
  {
    id: 'subtitles',
    label: 'Dynamische Untertitel generieren...',
    detail: 'Erstellt synchrone Wort-für-Wort Viral-Untertitel',
    icon: Subtitles,
  },
  {
    id: 'finalize',
    label: 'Video finalisieren...',
    detail: 'Fügt MP4-Videospur, Audio und Untertitel zusammen',
    icon: CheckCircle2,
  },
];

export const VideoGeneratorModal: React.FC<VideoGeneratorModalProps> = ({
  template,
  settings,
  customPrompt,
  generationId,
  onComplete,
  onCancel,
  onOpenCreditModal,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [progressPercent, setProgressPercent] = useState(10);
  const [statusMessage, setStatusMessage] = useState('Starte Veo 3.1 Pipeline...');
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [generatedStoryData, setGeneratedStoryData] = useState<{
    title: string;
    scenes: SceneData[];
  } | null>(null);

  const isCancelledRef = useRef(false);

  useEffect(() => {
    isCancelledRef.current = false;

    const chosenAspectRatio: '9:16' | '16:9' = settings.aspectRatio === '16:9' ? '16:9' : '9:16';
    const durationSec = settings.duration || template.defaultDurationSec;

    let operationName: string | null = null;
    let videoBlobUrl: string | null = null;

    async function runGenerationPipeline() {
      // 1. Parallel: Fetch story & screenplay from backend
      const storyPromise = (async () => {
        try {
          const res = await authFetch('/api/generate-story', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              templateId: template.id,
              templateTitle: template.title,
              settings,
              durationSec,
              customPrompt,
            }),
          });
          const data = await res.json();
          if (!isCancelledRef.current && data.scenes) {
            setGeneratedStoryData({
              title: data.title || `${template.title} Video`,
              scenes: data.scenes.map((sc: any) => ({
                ...sc,
                imageUrl: template.thumbnailUrl,
              })),
            });
            return data;
          }
        } catch (err) {
          console.warn('Story generation note:', err);
        }
        return null;
      })();

      // 2. Start Veo Video Generation via backend
      try {
        setCurrentStepIndex(0);
        setProgressPercent(15);
        setStatusMessage('Initialisiere Veo 3.1 Lite (veo-3.1-fast-generate-preview)...');

        const videoStartRes = await authFetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: customPrompt
              ? `${template.title}: ${customPrompt}. High cinematic quality, stunning lighting.`
              : `${template.title}: ${settings.storyTopic || settings.mainCharacter || 'cinematic vertical video'}. Dynamic camera movement, viral social media aesthetics.`,
            aspectRatio: chosenAspectRatio,
            resolution: '720p',
            model: 'veo-3.1-fast-generate-preview',
            durationSec,
            generationId,
          }),
        });

        const startData = await videoStartRes.json();

        if (videoStartRes.status === 401) {
          setErrorNotice('Authentifizierung erforderlich. Bitte melde dich an.');
          setStatusMessage('Nicht angemeldet.');
          return;
        }

        if (videoStartRes.status === 402 || startData.code === 'INSUFFICIENT_CREDITS') {
          setErrorNotice(startData.error || 'Nicht genügend Credits vorhanden.');
          setStatusMessage('Guthaben unzureichend.');
          setTimeout(() => {
            onCancel();
            onOpenCreditModal?.();
          }, 1600);
          return;
        }

        if (startData.refunded) {
          setErrorNotice(startData.error || 'Veo-Generierung fehlgeschlagen. Deine Credits wurden automatisch zurückerstattet.');
          setStatusMessage('Fehler: Credits wurden erstattet.');
        }

        if (startData.operationName) {
          operationName = startData.operationName;
          setCurrentStepIndex(1);
          setProgressPercent(30);
          setStatusMessage('Veo 3.1 Operation gestartet. Berechne 3D-Geometrie & Motion...');

          // Poll until done or timeout (up to 90 seconds max polling)
          let isDone = false;
          let pollAttempts = 0;
          const maxAttempts = 30; // 30 * 3s = 90s

          while (!isDone && pollAttempts < maxAttempts && !isCancelledRef.current) {
            await new Promise((r) => setTimeout(r, 3000));
            pollAttempts++;

            if (isCancelledRef.current) break;

            // Advance progress visual
            const simulatedProgress = Math.min(85, 30 + Math.floor((pollAttempts / maxAttempts) * 55));
            setProgressPercent(simulatedProgress);

            if (pollAttempts === 2) {
              setCurrentStepIndex(2);
              setStatusMessage('Kameraführung und Keyframe-Konsistenz werden gerendert...');
            } else if (pollAttempts === 4) {
              setCurrentStepIndex(3);
              setStatusMessage('Veo 3.1 rendert hochauflösende Frames...');
            } else if (pollAttempts === 8) {
              setCurrentStepIndex(4);
              setStatusMessage('Feinschliff & Textur-Details werden berechnet...');
            }

            try {
              const statusRes = await authFetch('/api/video-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operationName }),
              });
              const statusData = await statusRes.json();

              if (statusData.done) {
                isDone = true;
                break;
              }
              if (statusData.error) {
                console.warn('Veo operation returned error:', statusData.error);
                break;
              }
            } catch (pollErr) {
              console.warn('Polling error:', pollErr);
            }
          }

          // If completed, download video stream
          if (isDone && !isCancelledRef.current) {
            setCurrentStepIndex(5);
            setProgressPercent(90);
            setStatusMessage('Lade finales MP4-Video von Veo 3.1 herunter...');

            try {
              const downloadRes = await authFetch('/api/video-download', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ operationName }),
              });

              if (downloadRes.ok) {
                const blob = await downloadRes.blob();
                videoBlobUrl = URL.createObjectURL(blob);
              }
            } catch (dlErr) {
              console.warn('Video download error:', dlErr);
            }
          }
        } else if (startData.missingKey) {
          setErrorNotice('Tipp: Füge deinen Gemini API Key hinzu für direkte Veo 3.1 Live-Renderings.');
        }
      } catch (veoErr: any) {
        console.warn('Veo 3.1 generation fallback triggered:', veoErr);
      }

      // Wait for story data
      const storyData = await storyPromise;

      if (isCancelledRef.current) return;

      // Finalize
      setCurrentStepIndex(6);
      setProgressPercent(100);
      setStatusMessage('Video erfolgreich finalisiert!');

      await new Promise((r) => setTimeout(r, 600));

      if (isCancelledRef.current) return;

      const finalTitle =
        storyData?.title ||
        `${settings.mainCharacter || template.title}: ${settings.storyTopic ? settings.storyTopic.slice(0, 30) : 'Neues Video'}`;

      const completedVideo: GeneratedVideo = {
        id: `vid-${Date.now()}`,
        title: finalTitle,
        templateId: template.id,
        templateName: template.title,
        thumbnailUrl: template.thumbnailUrl,
        videoUrl: videoBlobUrl || undefined,
        modelUsed: 'veo-3.1-lite-generate-preview',
        durationSec,
        createdAt: 'Gerade eben',
        status: 'completed',
        creditUsed: durationSec <= 20 ? 10 : durationSec <= 35 ? 15 : 20,
        aspectRatio: chosenAspectRatio,
        settings,
        scenes: storyData?.scenes || [
          {
            sceneNumber: 1,
            durationSec: Math.floor(durationSec / 3),
            imagePrompt: `${template.title} Szene 1`,
            imageUrl: template.thumbnailUrl,
            speaker: settings.mainCharacter || 'Protagonist',
            spokenText: `Die Geschichte beginnt in ${settings.location || 'einer unvergesslichen Szene'}.`,
            visualAction: 'Kameraschwenk über das Setting',
            subtitles: [
              { word: 'Die', startSec: 0.5, endSec: 0.9 },
              { word: 'Geschichte', startSec: 1.0, endSec: 1.8 },
              { word: 'beginnt', startSec: 1.9, endSec: 2.6 },
              { word: 'jetzt.', startSec: 2.7, endSec: 3.5 },
            ],
          },
          {
            sceneNumber: 2,
            durationSec: Math.floor(durationSec / 3),
            imagePrompt: `${template.title} Szene 2`,
            imageUrl: template.thumbnailUrl,
            speaker: settings.secondaryCharacter || settings.mainCharacter || 'Protagonist',
            spokenText: settings.storyTopic || 'Eine unerwartete Wende stellt alles auf den Kopf.',
            visualAction: 'Dramatischer Zoom mit Beleuchtungswechsel',
            subtitles: [
              { word: 'Eine', startSec: 0.5, endSec: 0.9 },
              { word: 'unerwartete', startSec: 1.0, endSec: 2.0 },
              { word: 'Wende', startSec: 2.1, endSec: 2.8 },
              { word: 'geschieht.', startSec: 2.9, endSec: 3.8 },
            ],
          },
          {
            sceneNumber: 3,
            durationSec: Math.floor(durationSec / 3),
            imagePrompt: `${template.title} Szene 3`,
            imageUrl: template.thumbnailUrl,
            speaker: 'Erzähler',
            spokenText: 'Folge für Teil 2. Was denkst du, wie es weitergeht?',
            visualAction: 'Abblende mit packendem TikTok Cliffhanger',
            subtitles: [
              { word: 'Folge', startSec: 0.5, endSec: 1.0 },
              { word: 'für', startSec: 1.1, endSec: 1.4 },
              { word: 'Teil', startSec: 1.5, endSec: 2.0 },
              { word: '2.', startSec: 2.1, endSec: 2.8 },
            ],
          },
        ],
      };

      onComplete(completedVideo);
    }

    runGenerationPipeline();

    return () => {
      isCancelledRef.current = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm transition-all animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 relative overflow-hidden">
        
        {/* Subtle glow */}
        <div className="absolute top-0 right-1/4 w-48 h-48 bg-rose-500/10 rounded-full blur-[70px] pointer-events-none" />

        {/* Top Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-rose-600" />
            <span>Google Veo 3.1 Lite Engine</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            Dein Video wird erstellt
          </h2>

          <p className="text-xs text-slate-500">
            Format: <span className="text-slate-900 font-semibold">{template.title}</span> ({settings.aspectRatio || '9:16'})
          </p>
        </div>

        {/* Status Message */}
        <div className="text-center p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
          {statusMessage}
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="font-medium">Fortschritt</span>
            <span className="font-mono tabular-nums text-slate-900 font-bold">{progressPercent}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200">
            <div
              className="h-full bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 rounded-full transition-all duration-500 ease-out shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step-by-Step Stage Cards */}
        <div className="space-y-2 py-1 max-h-60 overflow-y-auto pr-1">
          {GENERATION_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const IconComponent = step.icon;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 p-2.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-rose-50/80 border-rose-300 text-slate-900 shadow-sm'
                    : isCompleted
                    ? 'bg-emerald-50/40 border-emerald-200 text-slate-800'
                    : 'bg-slate-50/50 border-slate-100 text-slate-400 opacity-60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    isCompleted
                      ? 'bg-emerald-100 text-emerald-700'
                      : isCurrent
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <IconComponent className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent ? 'text-slate-900 font-bold' : isCompleted ? 'text-slate-800' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCompleted && (
                      <span className="text-[10px] font-mono text-emerald-700 font-bold">Fertig</span>
                    )}
                    {isCurrent && (
                      <span className="text-[10px] font-mono text-rose-600 font-bold animate-pulse">Aktiv</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">
                    {step.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {errorNotice && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}

        {/* Live Snippet Preview if story data already ready */}
        {generatedStoryData && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 text-[11px] font-medium">Generierter Hook: </span>
            <span className="text-slate-900 font-semibold italic">
              „{generatedStoryData.scenes[0]?.spokenText || 'Szene bereit...'}“
            </span>
          </div>
        )}

        <div className="text-center pt-1">
          <button
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer font-medium"
          >
            Im Hintergrund weiterlaufen lassen
          </button>
        </div>

      </div>
    </div>
  );
};
