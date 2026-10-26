import React, { useState } from 'react';
import { Play, Download, Trash2, Clock, Film, Sparkles, Search, Loader2, HardDrive, RefreshCw, AlertCircle } from 'lucide-react';
import { GeneratedVideo } from '../types';
import { downloadVideoFile } from '../lib/videoExporter';
import { authFetch } from '../lib/authFetch';
import { getNicheById } from '../data/niches';
import { getDistinctThumbnail } from '../lib/thumbnailHelper';

interface MyVideosProps {
  videos: GeneratedVideo[];
  onPlayVideo: (video: GeneratedVideo) => void;
  onDeleteVideo: (videoId: string) => void;
  onGoToDiscover: () => void;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MyVideos: React.FC<MyVideosProps> = ({
  videos,
  onPlayVideo,
  onDeleteVideo,
  onGoToDiscover,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'generating'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const filteredVideos = videos.filter((vid) => {
    const matchesStatus = statusFilter === 'all' || vid.status === statusFilter;
    const niche = vid.nicheId ? getNicheById(vid.nicheId) : undefined;
    const matchesSearch =
      vid.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vid.templateName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (niche ? niche.name.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    return matchesStatus && matchesSearch;
  });

  const handleDownload = async (vid: GeneratedVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (downloadingId) return;
    setDownloadingId(vid.id);
    try {
      await downloadVideoFile(vid);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleRetryStorage = async (vid: GeneratedVideo, e: React.MouseEvent) => {
    e.stopPropagation();
    if (retryingId) return;
    setRetryingId(vid.id);
    try {
      const res = await authFetch(`/api/videos/${vid.id}/retry-storage`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        vid.storageStatus = 'completed';
        if (data.storagePath) vid.storagePath = data.storagePath;
        if (data.fileSizeBytes) vid.fileSizeBytes = data.fileSizeBytes;
      }
    } catch (err) {
      console.error('Retry storage failed:', err);
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            My Videos Library
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Deine erstellten vertikalen KI-Videos. Jederzeit ansehen, teilen oder herunterladen.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Videos durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500/30 transition-all w-48 sm:w-60 shadow-xs"
            />
          </div>

          <button
            onClick={onGoToDiscover}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-sm shadow-rose-500/20 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neues Video erstellen</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-rose-600 text-white font-semibold shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Alle Videos ({videos.length})
        </button>

        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
            statusFilter === 'completed'
              ? 'bg-rose-600 text-white font-semibold shadow-xs'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
          }`}
        >
          Fertiggestellt ({videos.filter((v) => v.status === 'completed').length})
        </button>
      </div>

      {/* Videos Grid or Empty State */}
      {filteredVideos.length === 0 ? (
        <div className="text-center py-20 bg-zinc-950 rounded-3xl border border-zinc-800 max-w-lg mx-auto p-8 space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 text-zinc-500 flex items-center justify-center mx-auto">
            <Film className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white">Noch keine Videos vorhanden</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Wähle ein Template wie AI Fruit Drama oder AI Story, passe es an und erstelle in unter einer Minute dein erstes virales Video.
          </p>
          <button
            onClick={onGoToDiscover}
            className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-all inline-flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Jetzt Template auswählen</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredVideos.map((vid) => (
            <div
              key={vid.id}
              onClick={() => onPlayVideo(vid)}
              className="group cursor-pointer rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden hover:border-rose-500 hover:shadow-2xl hover:shadow-rose-500/10 transition-all flex flex-col shadow-sm"
            >
              {/* Thumbnail (9:16 or 16:9) */}
              <div className={`relative ${vid.aspectRatio === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} w-full bg-slate-900 overflow-hidden`}>
                <img
                  src={
                    vid.thumbnailUrl && !vid.thumbnailUrl.includes('photo-1618005182384-a83a8bd57fbe')
                      ? vid.thumbnailUrl
                      : getDistinctThumbnail(vid.nicheId, vid.id + vid.title)
                  }
                  alt={vid.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getDistinctThumbnail(vid.nicheId, vid.title);
                  }}
                />

                {/* Scrim */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />

                {/* Status & Veo Indicator */}
                <div className="absolute top-3 left-3 flex flex-col gap-1 items-start">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                      vid.status === 'completed'
                        ? 'bg-emerald-950/50 text-emerald-400 border border-emerald-900/50'
                        : vid.status === 'generating'
                        ? 'bg-amber-950/50 text-amber-400 border border-amber-900/50'
                        : 'bg-rose-950/50 text-rose-400 border border-rose-900/50'
                    }`}
                  >
                    {vid.status === 'completed' ? 'Fertig' : vid.status === 'generating' ? 'Wird erstellt' : 'Fehlgeschlagen'}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-black/60 text-amber-300 border border-white/20">
                    Veo 3.1 • {vid.aspectRatio || '9:16'}
                  </span>
                </div>

                {/* Storage Status Badge (Top Right) */}
                <div className="absolute top-3 right-3 flex items-center z-10">
                  {vid.storageStatus === 'completed' || vid.storagePath ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 backdrop-blur-md shadow-xs"
                      title={`Dauerhaft in Firebase Storage gesichert (${vid.storagePath || 'videos/' + vid.id + '.mp4'})`}
                    >
                      <HardDrive className="w-3 h-3 text-emerald-400" />
                      <span>Storage</span>
                      {vid.fileSizeBytes ? <span className="opacity-80">({formatFileSize(vid.fileSizeBytes)})</span> : null}
                    </span>
                  ) : vid.storageStatus === 'uploading' ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-950/80 text-amber-300 border border-amber-500/30 backdrop-blur-md shadow-xs"
                      title="Wird in Firebase Storage hochgeladen..."
                    >
                      <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                      <span>Speichere...</span>
                    </span>
                  ) : vid.storageStatus === 'failed' ? (
                    <button
                      onClick={(e) => handleRetryStorage(vid, e)}
                      disabled={retryingId === vid.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-rose-950/85 text-rose-300 border border-rose-500/40 backdrop-blur-md shadow-xs hover:bg-rose-900 transition-colors cursor-pointer"
                      title={vid.storageError || "Storage-Upload fehlgeschlagen. Klicken zum Wiederholen."}
                    >
                      {retryingId === vid.id ? (
                        <Loader2 className="w-3 h-3 animate-spin text-rose-300" />
                      ) : (
                        <RefreshCw className="w-3 h-3 text-rose-300" />
                      )}
                      <span>Storage Retry</span>
                    </button>
                  ) : null}
                </div>

                {/* Duration bottom-left */}
                <div className="absolute bottom-3 left-3 text-xs font-mono text-slate-200 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-md">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  <span>{vid.durationSec}s</span>
                </div>

                {/* Hover Play Icon */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30 backdrop-blur-[2px]">
                  <div className="w-12 h-12 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-900/40 transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              {/* Video Card Details */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold text-rose-500 truncate">
                      {vid.templateName}
                    </span>
                    {vid.nicheId && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                        <span>{getNicheById(vid.nicheId).icon}</span>
                        <span>{getNicheById(vid.nicheId).name}</span>
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white text-sm line-clamp-2 group-hover:text-rose-500 transition-colors">
                    {vid.title}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500 mt-2">
                    <span>{vid.createdAt}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{vid.creditUsed} Credits</span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-zinc-900 flex items-center justify-between">
                  <button
                    onClick={(e) => handleDownload(vid, e)}
                    disabled={downloadingId === vid.id}
                    className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50"
                    title="Video herunterladen"
                  >
                    {downloadingId === vid.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteVideo(vid.id);
                    }}
                    className="p-1.5 text-zinc-600 hover:text-rose-500 rounded-lg hover:bg-rose-950/30 transition-colors cursor-pointer"
                    title="Löschen"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ))}
        </div>
      )}

    </div>
  );
};
