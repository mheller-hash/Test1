import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Share2,
  Volume2,
  VolumeX,
  Sparkles,
  Check,
  Subtitles,
  Layers,
  X,
  Loader2,
  FileText,
  Video as VideoIcon,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from 'lucide-react';
import { GeneratedVideo } from '../types';
import {
  downloadVideoFile,
  generateSrtContent,
  generateScriptContent,
  triggerBlobDownload,
} from '../lib/videoExporter';

interface VerticalVideoPlayerProps {
  video: GeneratedVideo;
  onClose: () => void;
  onRegenerate: () => void;
  onCreateSimilar: () => void;
}

export const VerticalVideoPlayer: React.FC<VerticalVideoPlayerProps> = ({
  video,
  onClose,
  onRegenerate,
  onCreateSimilar,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.25 | 1.5>(1);
  const [isCopied, setIsCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatusText, setDownloadStatusText] = useState('');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const durationSec = video.durationSec || 30;
  const scenes = video.scenes || [];

  // Determine current scene based on currentTimeSec
  const currentSceneIndex = Math.min(
    scenes.length - 1,
    Math.max(0, Math.floor((currentTimeSec / durationSec) * scenes.length))
  );
  const currentScene = scenes[currentSceneIndex] || scenes[0];

  // Web Speech API for authentic voiceover narration
  const speakCurrentScene = (text: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05 * playbackSpeed;
      utterance.pitch = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      // Ignore speech error if not allowed by browser permissions
    }
  };

  // Playback timer loop
  useEffect(() => {
    let animationFrameId: number;
    let lastTimestamp = performance.now();

    const loop = (timestamp: number) => {
      if (isPlaying) {
        const deltaSec = ((timestamp - lastTimestamp) / 1000) * playbackSpeed;
        setCurrentTimeSec((prev) => {
          const next = prev + deltaSec;
          if (next >= durationSec) {
            return 0;
          }
          return next;
        });
      }
      lastTimestamp = timestamp;
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, durationSec, playbackSpeed]);

  // Trigger speech on scene change if playing
  const prevSceneIndexRef = useRef(currentSceneIndex);
  useEffect(() => {
    if (isPlaying && !isMuted && currentScene?.spokenText) {
      if (prevSceneIndexRef.current !== currentSceneIndex) {
        prevSceneIndexRef.current = currentSceneIndex;
        speakCurrentScene(currentScene.spokenText);
      }
    }
  }, [currentSceneIndex, isPlaying, isMuted]);

  // Stop speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const togglePlay = () => {
    if (!isPlaying) {
      if (!isMuted && currentScene?.spokenText) {
        speakCurrentScene(currentScene.spokenText);
      }
    } else {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (timeSec: number) => {
    setCurrentTimeSec(timeSec);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // Active word calculation for subtitles
  const sceneRelativeSec =
    currentTimeSec - (currentSceneIndex / (scenes.length || 1)) * durationSec;
  const activeWord = currentScene?.subtitles?.find(
    (s) => sceneRelativeSec >= s.startSec && sceneRelativeSec <= s.endSec
  )?.word;

  const handleDownloadVideo = async (format: 'video' | 'srt' | 'script' = 'video') => {
    setShowExportMenu(false);
    setDownloadError(null);

    const safeTitle = (video.title || 'shortscraft_video')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase();

    if (format === 'srt') {
      try {
        const srt = generateSrtContent(video);
        const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' });
        triggerBlobDownload(blob, `${safeTitle}_untertitel.srt`);
        setDownloadSuccess('SRT-Untertitel erfolgreich gespeichert!');
        setTimeout(() => setDownloadSuccess(null), 3500);
      } catch (err: any) {
        setDownloadError('Konnte Untertitel-Datei nicht erstellen.');
      }
      return;
    }

    if (format === 'script') {
      try {
        const script = generateScriptContent(video);
        const blob = new Blob([script], { type: 'text/plain;charset=utf-8' });
        triggerBlobDownload(blob, `${safeTitle}_drehbuch.txt`);
        setDownloadSuccess('Drehbuch erfolgreich gespeichert!');
        setTimeout(() => setDownloadSuccess(null), 3500);
      } catch (err: any) {
        setDownloadError('Konnte Drehbuch-Datei nicht erstellen.');
      }
      return;
    }

    // Video Download (MP4 / WebM)
    setIsDownloading(true);
    setDownloadProgress(5);
    setDownloadStatusText('Bereite Video-Download vor...');

    try {
      const result = await downloadVideoFile(video, {
        onProgress: (percent, text) => {
          setDownloadProgress(percent);
          setDownloadStatusText(text);
        },
      });
      setDownloadSuccess(`Video erfolgreich gespeichert (${result.filename})!`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err: any) {
      console.error('Video download error:', err);
      setDownloadError(
        err.message || 'Download fehlgeschlagen. Bitte prüfe deine Browser-Berechtigungen.'
      );
      setTimeout(() => setDownloadError(null), 5000);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadStatusText('');
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const isWide = video.aspectRatio === '16:9';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className={`w-full ${isWide ? 'max-w-6xl' : 'max-w-5xl'} bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row my-auto`}>
        
        {/* Left Column: Video Player Screen */}
        <div className={`${isWide ? 'lg:w-[540px]' : 'lg:w-[420px]'} bg-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-200 relative`}>
          
          {/* Canvas Box (9:16 or 16:9) */}
          <div
            onClick={togglePlay}
            className={`relative ${
              isWide ? 'aspect-video w-full max-w-[480px]' : 'aspect-[9/16] w-full max-w-[320px]'
            } rounded-2xl overflow-hidden shadow-2xl bg-slate-900 cursor-pointer select-none group border border-slate-300`}
          >
            {/* Visual Frame: Real HTML5 Video if available, else Storyboard Animation */}
            {video.videoUrl ? (
              <video
                src={video.videoUrl}
                autoPlay
                loop
                muted={isMuted}
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={currentScene?.imageUrl || video.thumbnailUrl}
                alt={video.title}
                referrerPolicy="no-referrer"
                className={`w-full h-full object-cover transition-transform duration-1000 ease-out ${
                  isPlaying ? 'scale-110' : 'scale-100'
                }`}
              />
            )}

            {/* Dark Scrim inside player for readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

            {/* Top Bar inside Player */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between text-white text-xs z-10 pointer-events-none">
              <span className="font-mono text-[10px] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-rose-300 font-semibold flex items-center gap-1">
                <span>{video.templateName}</span>
                <span className="text-[9px] text-amber-300">Veo 3.1</span>
              </span>
              <span className="font-mono text-[10px] bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-slate-200">
                {video.aspectRatio || '9:16'} • Szene {currentSceneIndex + 1}/{scenes.length}
              </span>
            </div>

            {/* Center Play/Pause Overlay indicator */}
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                <div className="w-14 h-14 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-xl shadow-rose-950/60 transform scale-100">
                  <Play className="w-6 h-6 fill-white ml-1" />
                </div>
              </div>
            )}

            {/* Dynamic Animated TikTok/Reels Subtitles */}
            {subtitlesEnabled && currentScene?.spokenText && (
              <div className="absolute bottom-16 left-4 right-4 text-center pointer-events-none z-10">
                <div className="inline-block max-w-full bg-black/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shadow-2xl">
                  <div className="text-[11px] text-rose-400 font-bold uppercase tracking-wider mb-0.5">
                    {currentScene.speaker}
                  </div>
                  <div className="text-sm font-extrabold text-white leading-snug">
                    {currentScene.subtitles && currentScene.subtitles.length > 0 ? (
                      currentScene.subtitles.map((sub, i) => {
                        const isCurrentWord = sub.word === activeWord;
                        return (
                          <span
                            key={i}
                            className={`inline-block mr-1 transition-transform ${
                              isCurrentWord
                                ? 'text-amber-300 scale-110 underline decoration-rose-500 decoration-2'
                                : 'text-white'
                            }`}
                          >
                            {sub.word}
                          </span>
                        );
                      })
                    ) : (
                      <span>{currentScene.spokenText}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Right side floating TikTok action badges */}
            <div className="absolute right-3 bottom-24 flex flex-col items-center gap-3 text-white pointer-events-none">
              <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-xs">
                ❤️
              </div>
              <span className="text-[10px] font-mono font-semibold">14.2k</span>
              <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-xs">
                💬
              </div>
              <span className="text-[10px] font-mono font-semibold">382</span>
            </div>

            {/* Bottom Scrubber Timeline inside player */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 to-transparent space-y-1.5"
            >
              {/* Scene Timeline bars */}
              <div className="flex gap-1 h-1.5 w-full">
                {scenes.map((sc, i) => {
                  const sceneStart = (i / scenes.length) * durationSec;
                  const sceneEnd = ((i + 1) / scenes.length) * durationSec;
                  const isPast = currentTimeSec >= sceneEnd;
                  const isCurrent = currentTimeSec >= sceneStart && currentTimeSec < sceneEnd;
                  const sceneProgress = isPast
                    ? 100
                    : isCurrent
                    ? ((currentTimeSec - sceneStart) / (sceneEnd - sceneStart)) * 100
                    : 0;

                  return (
                    <div
                      key={i}
                      onClick={() => handleSeek(sceneStart)}
                      className="h-full flex-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
                      title={`Szene ${i + 1}: ${sc.speaker}`}
                    >
                      <div
                        className="h-full bg-rose-500 transition-all duration-100"
                        style={{ width: `${sceneProgress}%` }}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Time display */}
              <div className="flex items-center justify-between text-[11px] text-slate-300 font-mono">
                <span>{currentTimeSec.toFixed(1)}s</span>
                <span>{durationSec}s</span>
              </div>
            </div>

          </div>

          {/* Player controls toolbar below phone canvas (Bright styling) */}
          <div className="w-full max-w-[320px] mt-4 flex items-center justify-between text-slate-700 px-2">
            <button
              onClick={togglePlay}
              className="p-2 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-slate-800" />}
            </button>

            <button
              onClick={() => handleSeek(0)}
              className="p-2 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Von vorne starten"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsMuted((prev) => !prev)}
              className="p-2 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title={isMuted ? 'Ton an' : 'Stumm'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-600" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSubtitlesEnabled((prev) => !prev)}
              className={`p-2 transition-colors rounded-lg cursor-pointer ${
                subtitlesEnabled ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:bg-slate-200'
              }`}
              title="Untertitel ein/aus"
            >
              <Subtitles className="w-4 h-4" />
            </button>

            <button
              onClick={() => handleDownloadVideo('video')}
              disabled={isDownloading}
              className={`p-2 transition-colors rounded-lg cursor-pointer ${
                isDownloading
                  ? 'text-rose-600 bg-rose-50'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-200'
              }`}
              title="Video herunterladen (MP4)"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            <button
              onClick={() => {
                setPlaybackSpeed((prev) => (prev === 1 ? 1.25 : prev === 1.25 ? 1.5 : 1));
              }}
              className="px-2.5 py-1 text-xs font-mono font-semibold rounded-lg bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 shadow-xs cursor-pointer"
              title="Wiedergabegeschwindigkeit"
            >
              {playbackSpeed}x
            </button>
          </div>
        </div>

        {/* Right Column: Actions, Scenes Storyboard, Export, Details */}
        <div className="flex-1 p-6 sm:p-8 flex flex-col justify-between space-y-6 bg-white">
          
          <div>
            {/* Top Bar with Close button */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs font-mono text-emerald-600 font-bold uppercase tracking-wider">
                  Video erfolgreich generiert
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                  {video.title}
                </h2>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-2">
                  <span>Template: <strong className="text-slate-900">{video.templateName}</strong></span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums">{video.durationSec}s Länge</span>
                  <span aria-hidden="true" className="text-slate-300">·</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-800">{video.creditUsed} Credits</span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Storyboard Scene Breakdown */}
            <div className="mt-6 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-rose-600" />
                  <span>Szenen-Storyboard ({scenes.length} Szenen)</span>
                </span>
                <span className="text-[11px] text-slate-500 font-normal">Klicke eine Szene zum Anspringen</span>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {scenes.map((sc, idx) => {
                  const isCurrent = currentSceneIndex === idx;
                  const sceneStart = (idx / scenes.length) * durationSec;

                  return (
                    <div
                      key={idx}
                      onClick={() => handleSeek(sceneStart)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-rose-50 border-rose-300 text-slate-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-slate-900 font-bold">
                          Szene {sc.sceneNumber}: {sc.speaker}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500 font-medium">
                          {sc.durationSec}s
                        </span>
                      </div>
                      <p className="italic text-slate-800 mt-1 line-clamp-1">
                        „{sc.spokenText}“
                      </p>
                      <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                        {sc.visualAction}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons: Download, Progress, Format Options, Regenerate */}
          <div className="space-y-3 pt-6 border-t border-slate-200">
            {/* Download Progress Bar */}
            {isDownloading && (
              <div className="p-3 bg-rose-50/90 border border-rose-200 rounded-2xl space-y-2 animate-in fade-in duration-200">
                <div className="flex items-center justify-between text-xs font-semibold text-rose-950">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                    <span>{downloadStatusText || 'Wird vorbereitet...'}</span>
                  </span>
                  <span className="font-mono text-rose-700 font-bold">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-rose-200/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-600 h-full transition-all duration-200 rounded-full shadow-xs"
                    style={{ width: `${Math.max(5, downloadProgress)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Success Toast */}
            {downloadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-emerald-900 animate-in fade-in duration-200 shadow-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{downloadSuccess}</span>
              </div>
            )}

            {/* Error Toast */}
            {downloadError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-2.5 text-xs font-semibold text-rose-900 animate-in fade-in duration-200 shadow-xs">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{downloadError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
              
              {/* Primary Download Button with Dropdown Trigger */}
              <div className="relative">
                <div className="flex w-full rounded-xl shadow-md shadow-rose-500/20 overflow-hidden">
                  <button
                    onClick={() => handleDownloadVideo('video')}
                    disabled={isDownloading}
                    className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                  >
                    {isDownloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Download läuft...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>Video herunterladen (MP4)</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowExportMenu((prev) => !prev)}
                    disabled={isDownloading}
                    className="px-2.5 bg-rose-700 hover:bg-rose-600 text-white border-l border-rose-500 transition-colors cursor-pointer flex items-center justify-center"
                    title="Weitere Export-Optionen (.SRT, Drehbuch)"
                  >
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {/* Export Options Dropdown */}
                {showExportMenu && (
                  <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-200 rounded-2xl shadow-xl z-30 p-1.5 space-y-1 animate-in fade-in slide-in-from-bottom-2">
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Export-Formate
                    </div>
                    <button
                      onClick={() => handleDownloadVideo('video')}
                      className="w-full p-2.5 rounded-xl hover:bg-slate-50 text-left flex items-start gap-2.5 transition-colors cursor-pointer"
                    >
                      <VideoIcon className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Video (MP4 / WebM HD)</div>
                        <div className="text-[11px] text-slate-500">Für TikTok, Reels & YouTube Shorts</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadVideo('srt')}
                      className="w-full p-2.5 rounded-xl hover:bg-slate-50 text-left flex items-start gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileCode className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Untertitel-Datei (.SRT)</div>
                        <div className="text-[11px] text-slate-500">Mit exakten Timecodes für Untertitel-Upload</div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleDownloadVideo('script')}
                      className="w-full p-2.5 rounded-xl hover:bg-slate-50 text-left flex items-start gap-2.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-slate-900">Drehbuch & Prompts (.TXT)</div>
                        <div className="text-[11px] text-slate-500">Vollständiges Skript mit Sprechertexten</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Share / Copy Link Button */}
              <button
                onClick={handleShare}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4 text-slate-600" />}
                <span>{isCopied ? 'Link kopiert!' : 'Teilen & Link kopieren'}</span>
              </button>
            </div>

            {/* Quick compatibility hint */}
            <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
              <span>Format: <strong className="text-slate-800">{video.aspectRatio || '9:16'} HD</strong></span>
              <span>Direkt kompatibel mit TikTok, Reels & Shorts</span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={onRegenerate}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Erneut generieren</span>
              </button>

              <button
                onClick={onCreateSimilar}
                className="flex-1 py-2 px-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Ähnliches Video erstellen</span>
              </button>

              <button
                onClick={onClose}
                className="py-2 px-3 text-slate-500 hover:text-slate-800 text-xs font-medium cursor-pointer"
              >
                Zur Library
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
