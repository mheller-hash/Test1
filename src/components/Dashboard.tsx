import React, { useState } from 'react';
import { 
  Sparkles, 
  Coins, 
  Film, 
  Plus, 
  Folder, 
  FileText, 
  Users, 
  Zap, 
  TrendingUp, 
  ShieldCheck, 
  Lock,
  LogIn 
} from 'lucide-react';
import { VideoTemplate, GeneratedVideo, UserProfile } from '../types';
import { FilesSection } from './FilesSection';
import { NotesSection } from './NotesSection';
import { TeamSection } from './TeamSection';

interface DashboardProps {
  user: UserProfile;
  authUser: any;
  recentVideos: GeneratedVideo[];
  onSelectTemplate: (template: VideoTemplate) => void;
  onGoToDiscover: () => void;
  onGoToMyVideos: () => void;
  onPlayVideo: (video: GeneratedVideo) => void;
  onOpenCreditsModal: () => void;
  onOpenAuthModal: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  user,
  authUser,
  recentVideos,
  onGoToDiscover,
  onGoToMyVideos,
  onPlayVideo,
  onOpenCreditsModal,
  onOpenAuthModal,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'notes' | 'team'>('overview');

  // If not authenticated, render secure gate
  if (!authUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-8">
        <div className="rounded-3xl bg-white border border-slate-200/90 p-8 sm:p-12 text-center shadow-xl relative overflow-hidden space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8 text-rose-600" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Geschützter Benutzerbereich</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Anmeldung erforderlich
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Melde dich mit deinem persönlichen Account an, um auf dein Dashboard, deine gespeicherten Credits, Videobibliothek, Notizen und Teamdateien zuzugreifen.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onOpenAuthModal}
              className="w-full sm:w-auto px-7 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm transition-all shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Jetzt sicher anmelden</span>
            </button>
            <button
              onClick={onGoToDiscover}
              className="w-full sm:w-auto px-7 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Templates ansehen</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      
      {/* Navigation tabs */}
      <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
        {[
          { id: 'overview', label: 'Dashboard', icon: Sparkles },
          { id: 'files', label: 'Dateien', icon: Folder },
          { id: 'notes', label: 'Notizen', icon: FileText },
          { id: 'team', label: 'Team', icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 text-sm font-semibold flex items-center gap-2 rounded-xl transition-all duration-300 cursor-pointer ${
              activeTab === tab.id
                ? 'bg-rose-50 text-rose-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-10">
          {/* Welcome Banner */}
          <div className="relative rounded-3xl bg-slate-900 text-white p-8 sm:p-10 overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Konto verifiziert & Cloud-Sync aktiv</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Willkommen zurück, {user.name}</h1>
                <p className="text-slate-300 mt-2 max-w-xl text-sm">
                  Angemeldet als <span className="font-mono text-slate-100 font-semibold">{user.email}</span>. Deine Credits werden dauerhaft sicher in der Cloud gespeichert.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={onOpenCreditsModal} className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer border border-white/10 shadow-sm">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="font-mono">{user.credits} Credits</span>
                </button>
                <button onClick={onGoToDiscover} className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-rose-900/50 flex items-center gap-2 cursor-pointer">
                  <Plus className="w-4 h-4" />
                  <span>Neues Video</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { label: 'Verfügbare Credits', value: user.credits, icon: Zap, helper: 'Sicher in Firestore gespeichert' },
              { label: 'Erstellte Videos', value: user.videosCreatedCount, icon: Film, helper: 'In persönlicher Bibliothek' },
              { label: 'Aktiver Plan', value: user.plan.toUpperCase(), icon: TrendingUp, helper: 'Monatliches Kontingent' },
            ].map((kpi, idx) => (
              <div key={idx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-4">
                  <kpi.icon className="w-6 h-6 text-rose-500" />
                  <span className="text-[11px] font-medium text-slate-400">{kpi.helper}</span>
                </div>
                <div className="text-sm font-semibold text-slate-500">{kpi.label}</div>
                <div className="text-3xl font-extrabold text-slate-950 mt-1 font-mono">{kpi.value}</div>
              </div>
            ))}
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-950">Zuletzt erstellt</h2>
              <button onClick={onGoToMyVideos} className="text-sm font-semibold text-rose-600 hover:underline cursor-pointer">Alle ansehen →</button>
            </div>
            {recentVideos.length === 0 ? (
              <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                <Film className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-slate-500 text-sm font-medium">Noch keine Videos erstellt.</p>
                <button
                  onClick={onGoToDiscover}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-500 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Jetzt erstes Video erstellen</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {recentVideos.slice(0, 4).map(vid => (
                  <div key={vid.id} onClick={() => onPlayVideo(vid)} className="p-5 rounded-2xl bg-white border border-slate-200 cursor-pointer hover:border-rose-400 transition-all hover:shadow-lg shadow-sm">
                    <div className="font-bold text-slate-950 text-sm truncate">{vid.title}</div>
                    <div className="text-xs text-slate-500 mt-2">{vid.templateName}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeTab === 'files' && <FilesSection />}
      {activeTab === 'notes' && <NotesSection />}
      {activeTab === 'team' && <TeamSection />}
    </div>
  );
};
