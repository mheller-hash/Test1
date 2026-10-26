import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, CheckCircle2, Loader2, Film, Clapperboard, Mic, Subtitles, Check, AlertCircle, Video } from 'lucide-react';
import { VideoTemplate, GeneratedVideo, SceneData } from '../types';
import { authFetch } from '../lib/authFetch';
import { getDistinctThumbnail } from '../lib/thumbnailHelper';

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
  const [isFailed, setIsFailed] = useState<boolean>(false);
  const [isRefunded, setIsRefunded] = useState<boolean>(false);

  const isCancelledRef = useRef(false);

  useEffect(() => {
    isCancelledRef.current = false;

    const chosenAspectRatio: '9:16' | '16:9' = settings.aspectRatio === '16:9' ? '16:9' : '9:16';
    const durationSec = settings.duration || template.defaultDurationSec;

    let operationName: string | null = null;
    let videoBlobUrl: string | null = null;

    async function runGenerationPipeline() {
      try {
        setCurrentStepIndex(0);
        setProgressPercent(15);
        setStatusMessage('Initialisiere Veo 3.1 Lite (veo-3.1-fast-generate-preview)...');

        // Strictly clean prompt without social media / smartphone contamination
        const finalPrompt =
          settings.isStructuredPrompt ||
          customPrompt.startsWith('CORE CONCEPT:') ||
          customPrompt.startsWith('SCENE BREAKDOWN') ||
          customPrompt.startsWith('CONCEPT:')
            ? customPrompt
            : customPrompt
            ? `${template.title}: ${customPrompt}. High cinematic quality, stunning lighting.`
            : `${template.title}: ${settings.storyTopic || settings.mainCharacter || 'cinematic video'}. Dynamic camera movement, high cinematic quality.`;

        const chosenModel = settings.model || 'veo-3.1-fast-generate-preview';
        const chosenResolution = settings.resolution || '720p';

        const videoStartRes = await authFetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: finalPrompt,
            aspectRatio: chosenAspectRatio,
            resolution: chosenResolution,
            model: chosenModel,
            duration: durationSec,
            durationSec,
            nicheId: settings.nicheId,
            generationId,
          }),
        });

        const startData = await videoStartRes.json();

        if (videoStartRes.status === 401) {
          setIsFailed(true);
          setErrorNotice('Authentifizierung erforderlich. Bitte melde dich an.');
          setStatusMessage('Nicht angemeldet.');
          return;
        }

        if (videoStartRes.status === 402 || startData.code === 'INSUFFICIENT_CREDITS') {
          setIsFailed(true);
          setErrorNotice(startData.error || 'Nicht genügend Credits vorhanden.');
          setStatusMessage('Guthaben unzureichend.');
          setTimeout(() => {
            onCancel();
            onOpenCreditModal?.();
          }, 1600);
          return;
        }

        if (startData.refunded) {
          setIsRefunded(true);
          setIsFailed(true);
          setErrorNotice(startData.error || 'Veo-Generierung konnte nicht gestartet werden. Credits wurden automatisch erstattet.');
          setStatusMessage('Fehler: Credits erstattet');
          return;
        }

        if (!videoStartRes.ok || !startData.operationName) {
          setIsFailed(true);
          setErrorNotice(startData.error || 'Fehler beim Starten der Veo-Generierung.');
          setStatusMessage('Start fehlgeschlagen.');
          return;
        }

        operationName = startData.operationName;
        setCurrentStepIndex(1);
        setProgressPercent(30);
        setStatusMessage('Veo 3.1 Operation gestartet. Berechne Geometrie & Motion...');

        // Poll until done or timeout (up to 90 seconds max polling)
        let isDone = false;
        let pollAttempts = 0;
        const maxAttempts = 30; // 30 * 3s = 90s

        while (!isDone && pollAttempts < maxAttempts && !isCancelledRef.current) {
          await new Promise((r) => setTimeout(r, 3000));
          pollAttempts++;

          if (isCancelledRef.current) return;

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

            if (statusData.refunded) {
              setIsRefunded(true);
            }

            if (statusData.done) {
              isDone = true;
              break;
            }
            if (statusData.error) {
              setIsFailed(true);
              const errMsg = statusData.error?.message || (typeof statusData.error === 'string' ? statusData.error : 'Fehler bei der Veo-Berechnung.');
              setErrorNotice(`${errMsg} ${statusData.refunded ? '(Credits wurden automatisch zurückerstattet)' : ''}`);
              setStatusMessage('Generierung fehlgeschlagen.');
              return;
            }
          } catch (pollErr: any) {
            console.warn('Polling error:', pollErr);
          }
        }

        if (isCancelledRef.current) return;

        if (!isDone) {
          setIsFailed(true);
          setErrorNotice('Zeitlimit bei der Videoerstellung überschritten. Bitte prüfe den Status später in My Videos.');
          setStatusMessage('Zeitüberschreitung.');
          return;
        }

        // If completed, download video stream
        setCurrentStepIndex(5);
        setProgressPercent(90);
        setStatusMessage('Lade finales MP4-Video von Veo 3.1 herunter...');

        try {
          const downloadRes = await authFetch('/api/video-download', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operationName }),
          });

          if (!downloadRes.ok) {
            setIsFailed(true);
            setErrorNotice('Video-Download von Veo fehlgeschlagen.');
            setStatusMessage('Download-Fehler.');
            return;
          }

          const blob = await downloadRes.blob();
          videoBlobUrl = URL.createObjectURL(blob);
        } catch (dlErr: any) {
          setIsFailed(true);
          setErrorNotice('Fehler beim Herunterladen des Videos: ' + (dlErr?.message || dlErr));
          setStatusMessage('Download-Fehler.');
          return;
        }

        if (!videoBlobUrl) {
          setIsFailed(true);
          setErrorNotice('Kein gültiges Video empfangen.');
          setStatusMessage('Fehlgeschlagen.');
          return;
        }

        // Finalize ONLY when real video is present
        setCurrentStepIndex(6);
        setProgressPercent(100);
        setStatusMessage('Video erfolgreich finalisiert!');

        await new Promise((r) => setTimeout(r, 600));

        if (isCancelledRef.current) return;

        const finalTitle =
          settings.storyTopic?.slice(0, 40) ||
          (customPrompt.startsWith('CORE CONCEPT:')
            ? customPrompt.slice(13, 53).trim()
            : `${template.title} Video`);

        const effectiveNicheId = settings.nicheId || (template.id.startsWith('niche-') ? template.id.replace('niche-', '') : undefined);
        const resolvedThumbnail =
          template.thumbnailUrl && !template.thumbnailUrl.includes('photo-1618005182384-a83a8bd57fbe')
            ? template.thumbnailUrl
            : getDistinctThumbnail(effectiveNicheId, finalTitle || customPrompt);

        const videoId = generationId || `vid-${Date.now()}`;

        // Trigger server-side durable archival with full video metadata
        authFetch('/api/videos/archive', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generationId: videoId,
            operationName,
            extraMeta: {
              title: finalTitle,
              templateName: template.title,
              nicheId: effectiveNicheId,
              prompt: finalPrompt,
              aspectRatio: chosenAspectRatio,
              durationSec,
            },
          }),
        }).catch((e) => console.warn('Archival trigger note:', e));

        const completedVideo: GeneratedVideo = {
          id: videoId,
          title: finalTitle,
          templateId: template.id,
          templateName: template.title,
          nicheId: effectiveNicheId,
          thumbnailUrl: resolvedThumbnail,
          videoUrl: videoBlobUrl,
          storagePath: `users/${videoId}.mp4`,
          storageStatus: 'completed',
          modelUsed: chosenModel,
          durationSec,
          createdAt: 'Gerade eben',
          status: 'completed',
          creditUsed: durationSec <= 20 ? 10 : durationSec <= 35 ? 15 : 20,
          aspectRatio: chosenAspectRatio,
          settings,
        };

        onComplete(completedVideo);
      } catch (veoErr: any) {
        console.error('Veo generation exception:', veoErr);
        setIsFailed(true);
        setErrorNotice(veoErr?.message || 'Unerwarteter Fehler bei der Veo-Generierung.');
        setStatusMessage('Generierung abgebrochen.');
      }
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
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>Google Veo 3.1 Studio</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            {isFailed ? 'Generierung fehlgeschlagen' : 'Dein Video wird erstellt'}
          </h2>

          <p className="text-xs text-slate-500">
            Format: <span className="text-slate-900 font-semibold">{template.title}</span> ({settings.aspectRatio || '9:16'})
          </p>
        </div>

        {/* Status Message */}
        <div className={`text-center p-2.5 rounded-xl border text-xs font-medium ${
          isFailed
            ? 'bg-rose-50 border-rose-200 text-rose-700 font-semibold'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}>
          {statusMessage}
        </div>

        {/* Progress Bar (hidden when failed) */}
        {!isFailed && (
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
        )}

        {/* Step-by-Step Stage Cards (shown when active) */}
        {!isFailed && (
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
        )}

        {/* Error Notice / Failure Card */}
        {errorNotice && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">{errorNotice}</span>
              {isRefunded && (
                <span className="text-emerald-700 font-bold text-[11px] block">
                  ✓ Deine Credits wurden automatisch deinem Konto gutgeschrieben.
                </span>
              )}
            </div>
          </div>
        )}

        <div className="text-center pt-1">
          {isFailed ? (
            <button
              onClick={onCancel}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              Schließen
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="text-xs text-slate-500 hover:text-slate-800 transition-colors cursor-pointer font-medium"
            >
              Im Hintergrund weiterlaufen lassen
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
