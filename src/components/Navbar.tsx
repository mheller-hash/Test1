import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Coins, Film, LogIn, LogOut, User as UserIcon, ShieldCheck, Layers, Shield } from 'lucide-react';
import { UserProfile } from '../types';
import { User } from 'firebase/auth';

interface NavbarProps {
  currentTab: 'landing' | 'niches' | 'discover' | 'create' | 'dashboard' | 'my-videos' | 'pricing' | 'detail' | 'admin';
  setCurrentTab: (tab: 'landing' | 'niches' | 'discover' | 'create' | 'dashboard' | 'my-videos' | 'pricing' | 'detail' | 'admin') => void;
  user: UserProfile;
  authUser: User | null;
  onOpenCreditsModal: () => void;
  onOpenAuthModal: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  setCurrentTab,
  user,
  authUser,
  onOpenCreditsModal,
  onOpenAuthModal,
  onSignOut,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayInitial = authUser?.email
    ? authUser.email.charAt(0).toUpperCase()
    : user.name.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3.5 shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
        
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setCurrentTab('discover')}
          className="flex items-center gap-2.5 text-left group transition-transform focus:outline-none cursor-pointer"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-rose-600 to-amber-500 flex items-center justify-center shadow-md shadow-rose-500/20">
            <Film className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            Veyro<span className="text-rose-600">.ai</span>
          </span>
        </button>

        {/* Zone 2: 4-5 concise single-line nav links with hover underlines */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setCurrentTab('create')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'create'
                ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-rose-600" />
            <span>Create Video</span>
          </button>

          <button
            onClick={() => setCurrentTab('niches')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentTab === 'niches'
                ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-rose-500" />
            <span>Video-Nischen</span>
          </button>

          <button
            onClick={() => setCurrentTab('discover')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
              currentTab === 'discover' || currentTab === 'detail'
                ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Templates
          </button>
          
          {authUser && (
            <>
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
                  currentTab === 'dashboard'
                    ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dashboard
              </button>

              <button
                onClick={() => setCurrentTab('my-videos')}
                className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors flex items-center gap-1.5 cursor-pointer ${
                  currentTab === 'my-videos'
                    ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>My Videos</span>
              </button>

              {user.isAdmin && (
                <button
                  onClick={() => setCurrentTab('admin')}
                  className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors flex items-center gap-1.5 cursor-pointer font-bold ${
                    currentTab === 'admin'
                      ? 'text-purple-600 border-b-2 border-purple-600'
                      : 'text-purple-600/80 hover:text-purple-700'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5 text-purple-600" />
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-semibold">Admin</span>
                </button>
              )}
            </>
          )}

          <button
            onClick={() => setCurrentTab('pricing')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors cursor-pointer ${
              currentTab === 'pricing'
                ? 'text-slate-900 border-b-2 border-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pricing
          </button>

          <button
            onClick={() => setCurrentTab('landing')}
            className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors text-xs text-slate-500 hover:text-slate-800 cursor-pointer ${
              currentTab === 'landing' ? 'text-slate-900 border-b-2 border-slate-600 font-semibold' : ''
            }`}
          >
            Home
          </button>
        </nav>

        {/* Zone 3: 1 primary action / Credits badge & profile */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenCreditsModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700 hover:border-rose-400 hover:bg-slate-200/80 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            title={authUser ? "Klicke für Credit-Aufladung und Details" : "Melde dich an, um Credits zu nutzen"}
          >
            {authUser ? (
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            ) : null}
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono tabular-nums font-semibold text-slate-900">
              {authUser ? user.credits : 0}
            </span>
            <span className="text-slate-500 hidden sm:inline">Credits</span>
            <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-mono font-bold">+</span>
          </button>

          <button
            onClick={() => setCurrentTab('create')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg shadow-sm shadow-rose-500/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Create Video</span>
          </button>

          {/* User Account / Firebase Auth */}
          {authUser ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 hover:border-rose-500 flex items-center justify-center text-xs font-semibold text-slate-800 transition-colors focus:outline-none cursor-pointer shadow-xs relative"
                title={authUser.email || user.name}
              >
                {displayInitial}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-white border border-slate-200 shadow-xl p-2 z-50 text-xs">
                  <div className="p-2.5 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Sicher angemeldet</span>
                      </span>
                    </div>
                    <div className="font-semibold text-slate-900 truncate">
                      {user.name}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {authUser.email}
                    </div>
                  </div>

                  <div className="p-1 mt-1 space-y-0.5">
                    {user.isAdmin && (
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          setCurrentTab('admin');
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-purple-700 font-bold hover:bg-purple-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Shield className="w-3.5 h-3.5 text-purple-600" />
                          <span>Admin-Dashboard</span>
                        </div>
                        <span className="bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded text-[10px]">VERIFIED</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenCreditsModal();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-colors flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span>Credits</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">{user.credits}</span>
                    </button>

                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        onSignOut();
                      }}
                      className="w-full text-left px-2.5 py-1.5 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Abmelden</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-xs font-semibold text-slate-800 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5 text-rose-600" />
              <span>Sign In</span>
            </button>
          )}
        </div>

      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around pt-2.5 mt-2 border-t border-slate-200 text-xs font-medium text-slate-600">
        <button
          onClick={() => setCurrentTab('create')}
          className={`py-1 flex items-center gap-1 ${currentTab === 'create' ? 'text-rose-600 font-bold' : ''}`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Create</span>
        </button>
        <button
          onClick={() => setCurrentTab('discover')}
          className={`py-1 ${currentTab === 'discover' ? 'text-rose-600 font-semibold' : ''}`}
        >
          Templates
        </button>
        {authUser && (
          <>
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`py-1 ${currentTab === 'dashboard' ? 'text-rose-600 font-semibold' : ''}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('my-videos')}
              className={`py-1 ${currentTab === 'my-videos' ? 'text-rose-600 font-semibold' : ''}`}
            >
              My Videos
            </button>
          </>
        )}
        <button
          onClick={() => setCurrentTab('pricing')}
          className={`py-1 ${currentTab === 'pricing' ? 'text-rose-600 font-semibold' : ''}`}
        >
          Pricing
        </button>
      </div>
    </header>
  );
};
