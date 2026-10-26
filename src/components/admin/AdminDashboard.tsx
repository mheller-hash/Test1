import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ShieldCheck, 
  Video, 
  Coins, 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  PlusCircle, 
  MinusCircle, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Copy, 
  Check, 
  ChevronRight, 
  X, 
  TrendingUp, 
  DollarSign, 
  Film, 
  Award,
  Sparkles,
  ExternalLink,
  Play,
  Tag,
  HardDrive,
  Database,
  Info,
  Layers,
  Calendar,
  UserCheck,
  CreditCard,
  Sliders,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { authFetch } from '../../lib/authFetch';
import { getNicheById } from '../../data/niches';

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  creationTime: string;
  lastSignInTime: string | null;
  lastSeenAt: string | null;
  hasFirestoreDoc: boolean;
  credits: number;
  plan: 'free' | 'starter' | 'creator' | 'pro' | string;
  videosCreatedCount: number;
  totalCreditsUsed: number;
  successfulGenerations?: number;
  failedGenerations?: number;
  estimatedCostUsd?: number;
  createdAt: string;
  isAdmin?: boolean;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers5min: number;
  totalCreditsAvailable: number;
  totalCreditsUsed: number;
  usersByPlan: Record<string, number>;
  generations: {
    total: number;
    completed: number;
    failed: number;
    refunded: number;
    reconciliationRequired: number;
    active: number;
  };
  modelBreakdown: Record<string, number>;
  estimatedCosts: {
    veoCostUsd: number;
    geminiCostUsd: number;
    totalCostUsd: number;
  };
}

export interface CreditTransactionRecord {
  id: string;
  amount: number;
  type: string;
  reason: string;
  adminEmail?: string;
  adminUid?: string;
  balanceAfter: number;
  createdAt: string;
  status: string;
}

export interface GenerationRecord {
  id: string;
  title?: string;
  templateName?: string | null;
  nicheId?: string | null;
  prompt?: string | null;
  modelUsed?: string;
  status: string;
  creditCost?: number;
  creditUsed?: number;
  durationSec?: number;
  aspectRatio?: string;
  createdAt?: string;
  videoUrl?: string | null;
  storageUrl?: string | null;
  storageStatus?: string;
  thumbnailUrl?: string | null;
  scenesCount?: number | null;
  failReason?: string | null;
  refunded?: boolean;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [docFilter, setDocFilter] = useState<string>('all');

  // Selected User Detail Modal
  const [selectedUserUid, setSelectedUserUid] = useState<string | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] = useState<{
    user: AdminUserRecord;
    creditTransactions: CreditTransactionRecord[];
    generations: GenerationRecord[];
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reconciliations, setReconciliations] = useState<any[]>([]);

  // Credit Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState<number>(20);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjusting, setAdjusting] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Plan Update State
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [selectedPlanInput, setSelectedPlanInput] = useState<string>('creator');

  // Copy Feedback
  const [copiedUid, setCopiedUid] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  // Active Tab in User Detail Modal
  const [detailTab, setDetailTab] = useState<'overview' | 'credits' | 'plan' | 'generations'>('overview');

  // Sorting
  const [sortKey, setSortKey] = useState<'creationTime' | 'credits' | 'estimatedCostUsd' | 'lastSeenAt' | 'successfulGenerations'>('creationTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const fetchAdminData = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const [statsRes, usersRes, reconRes] = await Promise.all([
        authFetch('/api/admin/stats'),
        authFetch('/api/admin/users'),
        authFetch('/api/admin/reconciliations'),
      ]);

      if (!statsRes.ok) {
        const errData = await statsRes.json();
        throw new Error(errData.error || 'Fehler beim Laden der Admin-Statistiken.');
      }
      if (!usersRes.ok) {
        const errData = await usersRes.json();
        throw new Error(errData.error || 'Fehler beim Laden der Nutzerliste.');
      }

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const reconData = await reconRes.json();

      setStats(statsData.stats);
      setUsers(usersData.users || []);
      setReconciliations(reconData.reconciliations || []);
    } catch (err: any) {
      console.error('Admin Dashboard Load Error:', err);
      setError(err.message || 'Konnte Admin-Daten nicht abrufen.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleFetchUserDetail = async (uid: string) => {
    setSelectedUserUid(uid);
    setLoadingDetail(true);
    setSelectedUserDetail(null);
    setDetailTab('overview');
    try {
      const res = await authFetch(`/api/admin/users/${uid}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Nutzer-Details konnten nicht geladen werden.');
      }
      const data = await res.json();
      setSelectedUserDetail({
        user: data.user,
        creditTransactions: data.creditTransactions || [],
        generations: data.generations || [],
      });
      setSelectedPlanInput(data.user.plan || 'creator');
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleInitializeUserDoc = async (uid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await authFetch(`/api/admin/users/${uid}/initialize-doc`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Initialisierung fehlgeschlagen.');
      alert(data.message);
      fetchAdminData();
      if (selectedUserUid === uid) {
        handleFetchUserDetail(uid);
      }
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    }
  };

  const handleAdjustCredits = async () => {
    if (!selectedUserUid) return;
    if (!adjustReason || adjustReason.trim().length < 3) {
      setAdjustError('Bitte gib eine gültige Begründung an (mind. 3 Zeichen).');
      return;
    }
    if (!adjustAmount || adjustAmount === 0) {
      setAdjustError('Betrag muss eine ganze Zahl ungleich 0 sein.');
      return;
    }

    setAdjusting(true);
    setAdjustError(null);

    try {
      const idempotencyKey = `adj-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const res = await authFetch(`/api/admin/users/${selectedUserUid}/adjust-credits`, {
        method: 'POST',
        body: JSON.stringify({
          amount: adjustAmount,
          reason: adjustReason,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Credit-Anpassung fehlgeschlagen.');

      setIsAdjustModalOpen(false);
      setAdjustReason('');
      setAdjustAmount(20);
      
      // Refresh user details and list
      handleFetchUserDetail(selectedUserUid);
      fetchAdminData();
    } catch (err: any) {
      setAdjustError(err.message || 'Credit-Anpassung fehlgeschlagen.');
    } finally {
      setAdjusting(false);
    }
  };

  const handleUpdatePlan = async () => {
    if (!selectedUserUid) return;
    setUpdatingPlan(true);
    try {
      const res = await authFetch(`/api/admin/users/${selectedUserUid}/update-plan`, {
        method: 'POST',
        body: JSON.stringify({ plan: selectedPlanInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tarif-Update fehlgeschlagen.');
      
      alert(data.message);
      handleFetchUserDetail(selectedUserUid);
      fetchAdminData();
    } catch (err: any) {
      alert(`Fehler: ${err.message}`);
    } finally {
      setUpdatingPlan(false);
    }
  };

  const copyToClipboard = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedUid(text);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const copyPromptText = (promptText: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(promptText);
    setCopiedPromptId(id);
    setTimeout(() => setCopiedPromptId(null), 2000);
  };

  // Helper to test if lastSeenAt is within 5 minutes
  const isRecentlyActive = (lastSeenAt: string | null) => {
    if (!lastSeenAt) return false;
    const ms = new Date(lastSeenAt).getTime();
    if (isNaN(ms)) return false;
    return Date.now() - ms <= 5 * 60 * 1000;
  };

  // Helper to format transaction type nicely
  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'generation_charge':
        return { label: 'Video-Abbuchung', color: 'bg-red-950/60 text-red-300 border-red-800' };
      case 'generation_refund':
        return { label: 'Rückerstattung', color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800' };
      case 'admin_adjustment':
        return { label: 'Admin-Anpassung', color: 'bg-purple-950/60 text-purple-300 border-purple-800' };
      case 'welcome_bonus':
        return { label: 'Startguthaben', color: 'bg-blue-950/60 text-blue-300 border-blue-800' };
      default:
        return { label: type, color: 'bg-zinc-800 text-zinc-300 border-zinc-700' };
    }
  };

  // Filtered Users List
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.displayName && u.displayName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesPlan = planFilter === 'all' || u.plan === planFilter;
    const matchesDoc =
      docFilter === 'all' ||
      (docFilter === 'missing' && !u.hasFirestoreDoc) ||
      (docFilter === 'present' && u.hasFirestoreDoc);

    return matchesSearch && matchesPlan && matchesDoc;
  }).sort((a, b) => {
    let valA: any = a[sortKey];
    let valB: any = b[sortKey];

    if (sortKey === 'creationTime' || sortKey === 'lastSeenAt') {
      valA = valA ? new Date(valA).getTime() : 0;
      valB = valB ? new Date(valB).getTime() : 0;
    } else {
      valA = valA || 0;
      valB = valB || 0;
    }

    if (sortOrder === 'asc') {
      return valA > valB ? 1 : -1;
    } else {
      return valA < valB ? 1 : -1;
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-zinc-100 flex flex-col items-center justify-center p-6">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent mb-4"></div>
        <p className="text-zinc-400 font-medium">Lade Admin-Dashboard & Firebase-Nutzerdaten...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 p-4 sm:p-8">
      {/* Top Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/80 border border-zinc-800 p-6 rounded-2xl backdrop-blur-md shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-200 to-purple-300 bg-clip-text text-transparent">
                  Veyro.ai Admin-Dashboard
                </h1>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
                  <Award className="w-3.5 h-3.5 text-purple-400" />
                  Admin
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Echtzeit-Systemübersicht, vollständige Firebase Authentication Nutzerbasis &amp; Credit-Verwaltung
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchAdminData}
              disabled={refreshing}
              className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-sm font-medium transition flex items-center gap-2 border border-zinc-800 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Aktualisieren
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 rounded-xl bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-center gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Metric Overview Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-zinc-950/60 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Registrierte Nutzer</span>
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{stats.totalUsers}</span>
                <span className="text-xs text-zinc-500">aus Firebase Auth</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Kürzlich Aktiv (&lt;5 min)</span>
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Activity className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{stats.activeUsers5min}</span>
                <span className="text-xs text-zinc-400">geschätzter Status</span>
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Videogenerierungen</span>
                <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400">
                  <Video className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-black text-white">{stats.generations.completed}</span>
                  <span className="text-xs text-emerald-400 ml-1.5 font-medium">erfolgreich</span>
                </div>
                {stats.generations.failed > 0 && (
                  <div className="text-xs text-red-400 font-medium">
                    {stats.generations.failed} fehlgeschlagen
                  </div>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl relative overflow-hidden group hover:border-zinc-700 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Credits Balance</span>
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-amber-300">{stats.totalCreditsAvailable}</span>
                  <span className="text-xs text-zinc-400 ml-1">verfügbar</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-zinc-300">{stats.totalCreditsUsed}</span>
                  <span className="text-xs text-zinc-400 ml-1">verbraucht</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cost & Subscription Plan Breakdown Bar */}
        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl">
              <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Nutzerverteilung nach Tarifen
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(stats.usersByPlan).map(([planKey, count]) => (
                  <div key={planKey} className="bg-zinc-800/50 border border-zinc-700/60 p-3.5 rounded-xl">
                    <span className="text-xs font-semibold text-zinc-400 uppercase">{planKey}</span>
                    <p className="text-xl font-black text-white mt-1">{count} <span className="text-xs font-normal text-zinc-400">Nutzer</span></p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400" />
                  Geschätzte KI-Generierungskosten
                </h3>
                <p className="text-xs text-zinc-400 mb-4">
                  Basierend auf Veo-Videorenderings ($0.35/Vid) &amp; Gemini Prompt Optimization ($0.001/Call)
                </p>
              </div>
              <div className="space-y-2 border-t border-zinc-800 pt-3">
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Google Veo Video Kosten:</span>
                  <span className="font-mono font-bold">${stats.estimatedCosts.veoCostUsd.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-300">
                  <span>Gemini Prompt Director:</span>
                  <span className="font-mono font-bold">${stats.estimatedCosts.geminiCostUsd.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold text-emerald-400 border-t border-zinc-800 pt-2">
                  <span>Gesamtkosten geschätzt:</span>
                  <span className="font-mono">${stats.estimatedCosts.totalCostUsd.toFixed(2)} USD</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stuck Generations / Reconciliation View */}
        {reconciliations.length > 0 && (
          <div className="bg-zinc-900/80 border border-amber-900/50 rounded-2xl p-6 backdrop-blur-md shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <AlertTriangle className="w-24 h-24 text-amber-500" />
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Hängende Generierungen ({reconciliations.length})
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Diese Jobs befinden sich im Status <code className="text-amber-300">reconciliation_required</code> und werden im Hintergrund automatisch geprüft.
                </p>
              </div>
              <button 
                onClick={fetchAdminData}
                className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                Liste aktualisieren
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Nutzer</th>
                    <th className="py-3 px-4">Generation ID</th>
                    <th className="py-3 px-4">Modell</th>
                    <th className="py-3 px-4">Operation Name</th>
                    <th className="py-3 px-4">Erstellt am</th>
                    <th className="py-3 px-4 text-center">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                  {reconciliations.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-800/40 transition group">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-200">{r.userEmail || 'Unbekannt'}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">{r.userId}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-amber-200/80">{r.id}</td>
                      <td className="py-3 px-4">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono border border-zinc-700 text-zinc-400">
                          {r.modelUsed || 'veo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[10px] text-zinc-500 max-w-[150px] truncate">
                        {r.operationName || 'N/A'}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {new Date(r.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button 
                          onClick={() => handleFetchUserDetail(r.userId)}
                          className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold cursor-pointer"
                        >
                          Nutzer prüfen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* User Management Section */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-md shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Erweiterte Nutzerübersicht ({filteredUsers.length} von {users.length})
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Sämtliche aus Firebase Authentication abgerufenen Konten mit Live-Firestore Verknüpfung
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Search input */}
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -tranzinc-y-1/2" />
                  <input
                  type="text"
                  placeholder="Email, UID oder Name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              {/* Plan filter */}
              <select
                value={planFilter}
                onChange={(e) => setPlanFilter(e.target.value)}
                className="bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300 px-3 py-2 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">Alle Tarife</option>
                <option value="free">Free</option>
                <option value="starter">Starter</option>
                <option value="creator">Creator</option>
                <option value="pro">Pro</option>
              </select>

              {/* Firestore Doc filter */}
              <select
                value={docFilter}
                onChange={(e) => setDocFilter(e.target.value)}
                className="bg-black border border-zinc-800 rounded-xl text-xs text-zinc-300 px-3 py-2 focus:outline-none focus:border-purple-500 cursor-pointer"
              >
                <option value="all">Alle Firestore-Status</option>
                <option value="present">Dokument vorhanden</option>
                <option value="missing">Fehlendes Dokument ⚠️</option>
              </select>
            </div>
          </div>

          {/* User Table with all required columns */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4">Nutzer / E-Mail</th>
                  <th className="py-3 px-4">Firebase UID</th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition"
                    onClick={() => toggleSort('creationTime')}
                  >
                    <div className="flex items-center gap-1">
                      Registrierung
                      {sortKey === 'creationTime' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4">Tarif</th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-200 transition"
                    onClick={() => toggleSort('credits')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Verfügbare Credits
                      {sortKey === 'credits' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Verbrauchte Credits</th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-200 transition"
                    onClick={() => toggleSort('estimatedCostUsd')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      API Kosten
                      {sortKey === 'estimatedCostUsd' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 text-center cursor-pointer hover:text-zinc-200 transition"
                    onClick={() => toggleSort('successfulGenerations')}
                  >
                    <div className="flex items-center justify-center gap-1">
                      Videogenerierungen
                      {sortKey === 'successfulGenerations' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th 
                    className="py-3 px-4 cursor-pointer hover:text-zinc-200 transition"
                    onClick={() => toggleSort('lastSeenAt')}
                  >
                    <div className="flex items-center gap-1">
                      Letzte Aktivität
                      {sortKey === 'lastSeenAt' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="py-3 px-4 text-center">Aktionen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-zinc-500">
                      Keine Nutzer gefunden, die den Suchkriterien entsprechen.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const active = isRecentlyActive(u.lastSeenAt);
                    const successfulCount = u.successfulGenerations ?? u.videosCreatedCount ?? 0;
                    const failedCount = u.failedGenerations ?? 0;

                    return (
                      <tr
                        key={u.uid}
                        onClick={() => handleFetchUserDetail(u.uid)}
                        className="hover:bg-zinc-800/40 cursor-pointer transition group"
                      >
                        {/* E-Mail & Name */}
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-purple-400 uppercase text-xs shrink-0">
                              {u.email ? u.email[0] : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="text-zinc-100 font-semibold flex items-center gap-1.5 truncate">
                                <span>{u.email || 'Keine E-Mail'}</span>
                                {u.isAdmin && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    Admin
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-zinc-500 truncate">{u.displayName || 'Creator'}</div>
                            </div>
                          </div>
                        </td>

                        {/* UID */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span>{u.uid.slice(0, 10)}...</span>
                            <button
                              onClick={(e) => copyToClipboard(u.uid, e)}
                              className="p-1 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
                              title="UID kopieren"
                            >
                              {copiedUid === u.uid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>

                        {/* Registrierungsdatum */}
                        <td className="py-3.5 px-4 text-zinc-300 whitespace-nowrap">
                          {u.creationTime ? new Date(u.creationTime).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                        </td>

                        {/* Tarif */}
                        <td className="py-3.5 px-4 uppercase font-bold text-[10px] tracking-wider whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded ${
                            u.plan === 'pro' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                            u.plan === 'creator' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                            u.plan === 'starter' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                            'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}>
                            {u.plan}
                          </span>
                        </td>

                        {/* Verfügbare Credits */}
                        <td className="py-3.5 px-4 text-center font-bold text-amber-400 whitespace-nowrap">
                          {u.credits}
                        </td>

                        {/* Verbrauchte Credits */}
                        <td className="py-3.5 px-4 text-center font-semibold text-zinc-300 whitespace-nowrap">
                          {u.totalCreditsUsed}
                        </td>
                        
                        {/* API Kosten */}
                        <td className="py-3.5 px-4 text-center font-bold text-emerald-400 whitespace-nowrap">
                          ${u.estimatedCostUsd?.toFixed(2) || '0.00'}
                        </td>

                        {/* Videogenerierungen: Erfolgreich / Fehlgeschlagen */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-emerald-400 text-xs">
                              {successfulCount} erfolgreich
                            </span>
                            {failedCount > 0 ? (
                              <span className="text-[10px] text-red-400">
                                {failedCount} fehlgeschlagen
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-500">
                                0 fehlgeschlagen
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Letzte Aktivität */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                              Aktiv (&lt;5 min)
                            </span>
                          ) : u.lastSeenAt ? (
                            <span className="text-zinc-400 text-[11px]">
                              {new Date(u.lastSeenAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px]">Nicht verfügbar</span>
                          )}
                        </td>

                        {/* Aktionen */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {!u.hasFirestoreDoc ? (
                            <button
                              onClick={(e) => handleInitializeUserDoc(u.uid, e)}
                              className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-[10px] font-semibold flex items-center gap-1 mx-auto cursor-pointer"
                              title="Kein Firestore-Dokument vorhanden! Klicken zum Initialisieren"
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              Doc anlegen
                            </button>
                          ) : (
                            <button className="px-2.5 py-1 rounded bg-zinc-800 group-hover:bg-purple-600 text-zinc-300 group-hover:text-white transition text-[11px] font-medium inline-flex items-center gap-1 cursor-pointer">
                              Details
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Detail Modal */}
      {selectedUserUid && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {selectedUserDetail?.user.email || 'Nutzer-Detailansicht'}
                    {selectedUserDetail?.user.isAdmin && (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 font-semibold">
                        Admin
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-zinc-400 font-mono">UID: {selectedUserUid}</p>
                    <button
                      onClick={(e) => copyToClipboard(selectedUserUid, e)}
                      className="text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      title="UID kopieren"
                    >
                      {copiedUid === selectedUserUid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedUserUid(null)}
                className="p-2 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetail ? (
              <div className="p-16 text-center text-zinc-400 flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-purple-500 border-t-transparent mb-3"></div>
                Lade Nutzerdaten, Credit-Ledger und Generierungshistorie...
              </div>
            ) : selectedUserDetail ? (
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 4 Dedicated Tabs */}
                <div className="flex border-b border-zinc-800 gap-6">
                  <button
                    onClick={() => setDetailTab('overview')}
                    className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      detailTab === 'overview'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <UserCheck className="w-4 h-4" />
                    Konto &amp; Identität
                  </button>
                  <button
                    onClick={() => setDetailTab('credits')}
                    className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      detailTab === 'credits'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Coins className="w-4 h-4" />
                    Credit-Verlauf &amp; Ledger ({selectedUserDetail.creditTransactions.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('plan')}
                    className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      detailTab === 'plan'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    Abonnement &amp; Tarif
                  </button>
                  <button
                    onClick={() => setDetailTab('generations')}
                    className={`pb-3 text-xs font-bold transition border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      detailTab === 'generations'
                        ? 'border-purple-500 text-purple-400'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    Videogenerierungen ({selectedUserDetail.generations.length})
                  </button>
                </div>

                {/* TAB 1: KONTO & IDENTITÄT */}
                {detailTab === 'overview' && (
                  <div className="space-y-6">
                    {/* User Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Verfügbare Credits</span>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-3xl font-black text-amber-400">
                            {selectedUserDetail.user.credits}
                          </span>
                          <button
                            onClick={() => setIsAdjustModalOpen(true)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold flex items-center gap-1 transition shadow cursor-pointer"
                          >
                            <PlusCircle className="w-3 h-3" />
                            Anpassen
                          </button>
                        </div>
                      </div>

                      <div className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Aktiver Tarif</span>
                        <div className="mt-2 flex items-center justify-between">
                          <span className={`px-2.5 py-1 rounded text-xs font-bold uppercase ${
                            selectedUserDetail.user.plan === 'pro' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                            selectedUserDetail.user.plan === 'creator' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                            selectedUserDetail.user.plan === 'starter' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                            'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}>
                            {selectedUserDetail.user.plan}
                          </span>
                          <button
                            onClick={() => setDetailTab('plan')}
                            className="text-[10px] text-purple-400 hover:text-purple-300 font-bold cursor-pointer"
                          >
                            Ändern &rarr;
                          </button>
                        </div>
                      </div>

                      <div className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">API Kosten (Est.)</span>
                        <div className="mt-2 flex items-baseline gap-1.5">
                          <span className="text-2xl font-black text-emerald-400">
                            ${selectedUserDetail.user.estimatedCostUsd?.toFixed(2) || '0.00'}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-bold uppercase">USD</span>
                        </div>
                      </div>

                      <div className="bg-black p-4 rounded-xl border border-zinc-800 flex flex-col justify-between">
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase">Aktivitätsstatus</span>
                        <div className="mt-2 text-[11px] text-zinc-300 font-medium">
                          {isRecentlyActive(selectedUserDetail.user.lastSeenAt) ? (
                            <span className="inline-flex items-center gap-1.5 font-bold text-emerald-400">
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                              Online
                            </span>
                          ) : selectedUserDetail.user.lastSeenAt ? (
                            <span className="truncate block">
                              Zuletzt: {new Date(selectedUserDetail.user.lastSeenAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span className="text-zinc-500 italic">Nie angemeldet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detailed Metadata Grid */}
                    <div className="bg-black p-5 rounded-xl border border-zinc-800 space-y-4">
                      <h4 className="font-bold text-zinc-200 uppercase tracking-wider text-xs flex items-center gap-2">
                        <Database className="w-4 h-4 text-purple-400" />
                        Vollständige Kontoinformationen
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="block text-zinc-500 font-medium">E-Mail-Adresse:</span>
                          <span className="text-zinc-100 font-semibold">{selectedUserDetail.user.email || 'Nicht verfügbar'}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Firebase UID:</span>
                          <span className="text-zinc-200 font-mono text-[11px]">{selectedUserDetail.user.uid}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Anzeigename:</span>
                          <span className="text-zinc-200 font-medium">{selectedUserDetail.user.displayName || 'Creator'}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Registrierungsdatum (Auth):</span>
                          <span className="text-zinc-200 font-medium">
                            {selectedUserDetail.user.creationTime ? new Date(selectedUserDetail.user.creationTime).toLocaleString('de-DE') : 'Nicht verfügbar'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Letzte Anmeldung (Auth):</span>
                          <span className="text-zinc-200 font-medium">
                            {selectedUserDetail.user.lastSignInTime ? new Date(selectedUserDetail.user.lastSignInTime).toLocaleString('de-DE') : 'Nicht verfügbar'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Firestore Nutzerdokument:</span>
                          <span className={selectedUserDetail.user.hasFirestoreDoc ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                            {selectedUserDetail.user.hasFirestoreDoc ? 'Vorhanden in users/{uid}' : 'Nicht angelegt ⚠️'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Insgesamt verbrauchte Credits:</span>
                          <span className="text-zinc-200 font-medium">{selectedUserDetail.user.totalCreditsUsed} Credits</span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Verursachte API-Kosten (geschätzt):</span>
                          <span className="text-emerald-400 font-bold">${selectedUserDetail.user.estimatedCostUsd?.toFixed(3) || '0.000'} USD</span>
                        </div>
                        <div>
                          <span className="block text-zinc-500 font-medium">Erfolgreich erstellte Videos:</span>
                          <span className="text-emerald-400 font-semibold">
                            {selectedUserDetail.user.successfulGenerations ?? selectedUserDetail.user.videosCreatedCount ?? 0} Videos
                          </span>
                        </div>
                      </div>

                      {!selectedUserDetail.user.hasFirestoreDoc && (
                        <div className="pt-3 border-t border-zinc-800 flex items-center justify-between">
                          <p className="text-xs text-amber-300">
                            Für dieses Authentication-Konto existiert noch kein Firestore-Dokument in <code className="bg-zinc-900 px-1 py-0.5 rounded text-amber-200">users/{'{uid}'}</code>.
                          </p>
                          <button
                            onClick={(e) => handleInitializeUserDoc(selectedUserDetail.user.uid, e)}
                            className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/40 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                            Dokument jetzt anlegen
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* TAB 2: CREDIT-VERLAUF & LEDGER */}
                {detailTab === 'credits' && (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black p-4 rounded-xl border border-zinc-800">
                      <div>
                        <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-amber-400" />
                          Credit-Verlauf &amp; Revisionssicherer Audit Ledger
                        </h4>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Verfügbares Guthaben: <strong className="text-amber-400 font-bold">{selectedUserDetail.user.credits} Credits</strong> &bull; Bisher verbraucht: <strong className="text-zinc-200 font-bold">{selectedUserDetail.user.totalCreditsUsed} Credits</strong>
                        </p>
                      </div>
                      <button
                        onClick={() => setIsAdjustModalOpen(true)}
                        className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center gap-1.5 transition self-start sm:self-auto cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4" />
                        Guthaben anpassen (+ / -)
                      </button>
                    </div>

                    <div className="overflow-x-auto border border-zinc-800 rounded-xl">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="bg-zinc-950 border-b border-zinc-800 text-zinc-400 font-semibold uppercase">
                            <th className="py-2.5 px-4">Datum &amp; Uhrzeit</th>
                            <th className="py-2.5 px-4">Transaktionstyp</th>
                            <th className="py-2.5 px-4 text-center">Betrag</th>
                            <th className="py-2.5 px-4 text-center">Saldo Danach</th>
                            <th className="py-2.5 px-4">Begründung &amp; Verwendungszweck</th>
                            <th className="py-2.5 px-4">Ausführender Admin / System</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                          {selectedUserDetail.creditTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-8 text-center text-zinc-500">
                                Keine Credit-Transaktionen im Firestore-Ledger aufgezeichnet.
                              </td>
                            </tr>
                          ) : (
                            selectedUserDetail.creditTransactions.map((tx) => {
                              const typeInfo = getTransactionTypeLabel(tx.type);
                              return (
                                <tr key={tx.id} className="hover:bg-zinc-800/30">
                                  <td className="py-2.5 px-4 text-zinc-400 whitespace-nowrap">
                                    {new Date(tx.createdAt).toLocaleString('de-DE')}
                                  </td>
                                  <td className="py-2.5 px-4 uppercase text-[10px] font-bold whitespace-nowrap">
                                    <span className={`px-2 py-0.5 rounded border ${typeInfo.color}`}>
                                      {typeInfo.label}
                                    </span>
                                  </td>
                                  <td className={`py-2.5 px-4 text-center font-bold whitespace-nowrap ${tx.amount > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} Credits
                                  </td>
                                  <td className="py-2.5 px-4 text-center font-mono font-bold text-zinc-200 whitespace-nowrap">
                                    {tx.balanceAfter}
                                  </td>
                                  <td className="py-2.5 px-4 text-zinc-300 max-w-xs truncate">
                                    {tx.reason || 'Keine Begründung angegeben'}
                                  </td>
                                  <td className="py-2.5 px-4 text-zinc-400 text-[11px] whitespace-nowrap">
                                    {tx.adminEmail ? (
                                      <span className="text-purple-300 font-medium">{tx.adminEmail}</span>
                                    ) : (
                                      <span className="text-zinc-500">System (Automatisch)</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB 3: ABONNEMENT & TARIF */}
                {detailTab === 'plan' && (
                  <div className="space-y-6">
                    <div className="bg-black p-5 rounded-xl border border-zinc-800 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-purple-400" />
                            Abonnement-Status &amp; Tarif-Verwaltung
                          </h4>
                          <p className="text-xs text-zinc-400 mt-0.5">
                            Verwalte den Tarif dieses Nutzers. Die Änderung wird serverseitig in Firestore gespeichert.
                          </p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                          selectedUserDetail.user.plan === 'pro' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                          selectedUserDetail.user.plan === 'creator' ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700' :
                          selectedUserDetail.user.plan === 'starter' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                        }`}>
                          Aktuell: {selectedUserDetail.user.plan}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                        <select
                          value={selectedPlanInput}
                          onChange={(e) => setSelectedPlanInput(e.target.value)}
                          className="bg-zinc-900 border border-zinc-700 rounded-xl text-xs font-semibold uppercase text-zinc-200 px-3 py-2.5 focus:outline-none focus:border-purple-500 cursor-pointer"
                        >
                          <option value="free">Free Plan (Testzugang)</option>
                          <option value="starter">Starter Plan (50 Credits / Monat)</option>
                          <option value="creator">Creator Plan (100 Credits / Monat)</option>
                          <option value="pro">Pro Plan (500 Credits / Monat &amp; VIP Priority)</option>
                        </select>
                        <button
                          onClick={handleUpdatePlan}
                          disabled={updatingPlan || selectedPlanInput === selectedUserDetail.user.plan}
                          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {updatingPlan ? 'Speichere...' : 'Tarif jetzt aktualisieren'}
                        </button>
                      </div>
                    </div>

                    {/* Plan Feature Entitlements Reference */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${selectedUserDetail.user.plan === 'free' ? 'bg-zinc-900/90 border-purple-500 ring-1 ring-purple-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                        <div className="font-bold text-white uppercase flex items-center justify-between">
                          <span>Free</span>
                          {selectedUserDetail.user.plan === 'free' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <ul className="text-zinc-400 space-y-1 text-[11px]">
                          <li>&bull; 0-10 Credits Testguthaben</li>
                          <li>&bull; 720p Auflösung</li>
                          <li>&bull; Standard-Warteschlange</li>
                          <li>&bull; Wasserzeichen aktiv</li>
                        </ul>
                      </div>

                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${selectedUserDetail.user.plan === 'starter' ? 'bg-zinc-900/90 border-blue-500 ring-1 ring-blue-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                        <div className="font-bold text-blue-300 uppercase flex items-center justify-between">
                          <span>Starter</span>
                          {selectedUserDetail.user.plan === 'starter' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </div>
                        <ul className="text-zinc-400 space-y-1 text-[11px]">
                          <li>&bull; 50 Credits / Monat</li>
                          <li>&bull; Bis 1080p Full HD</li>
                          <li>&bull; Alle 4 Nischen zugänglich</li>
                          <li>&bull; Standard Render-Geschwindigkeit</li>
                        </ul>
                      </div>

                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${selectedUserDetail.user.plan === 'creator' ? 'bg-zinc-900/90 border-emerald-500 ring-1 ring-emerald-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                        <div className="font-bold text-emerald-300 uppercase flex items-center justify-between">
                          <span>Creator</span>
                          {selectedUserDetail.user.plan === 'creator' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        </div>
                        <ul className="text-zinc-400 space-y-1 text-[11px]">
                          <li>&bull; 100-250 Credits / Monat</li>
                          <li>&bull; Veo 3.1 &amp; Omni Flash</li>
                          <li>&bull; Volle Skript- &amp; Regie-Anpassung</li>
                          <li>&bull; Priorisierter Video-Render</li>
                        </ul>
                      </div>

                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${selectedUserDetail.user.plan === 'pro' ? 'bg-zinc-900/90 border-purple-500 ring-1 ring-purple-500/30' : 'bg-zinc-950 border-zinc-800'}`}>
                        <div className="font-bold text-purple-300 uppercase flex items-center justify-between">
                          <span>Pro VIP</span>
                          {selectedUserDetail.user.plan === 'pro' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                        </div>
                        <ul className="text-zinc-400 space-y-1 text-[11px]">
                          <li>&bull; 500+ Credits / Monat</li>
                          <li>&bull; Höchste Priorität in Veo-Pipeline</li>
                          <li>&bull; Sofortiger SRT/Script-Export</li>
                          <li>&bull; 24/7 VIP Support</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: VIDEOGENERIERUNGEN & STORAGE */}
                {detailTab === 'generations' && (
                  <div className="space-y-6">
                    {/* Generations Summary Counters */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-zinc-400">Gesamt</span>
                        <p className="text-xl font-black text-white mt-0.5">{selectedUserDetail.generations.length}</p>
                      </div>
                      <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-emerald-400">Erfolgreich</span>
                        <p className="text-xl font-black text-emerald-400 mt-0.5">
                          {selectedUserDetail.generations.filter((g) => g.status === 'completed').length}
                        </p>
                      </div>
                      <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-red-400">Fehlgeschlagen / Erstattet</span>
                        <p className="text-xl font-black text-red-400 mt-0.5">
                          {selectedUserDetail.generations.filter((g) => g.status === 'failed' || g.status === 'refunded').length}
                        </p>
                      </div>
                      <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl">
                        <span className="text-[10px] uppercase font-bold text-amber-400">In Bearbeitung</span>
                        <p className="text-xl font-black text-amber-400 mt-0.5">
                          {selectedUserDetail.generations.filter((g) => g.status === 'starting' || g.status === 'processing').length}
                        </p>
                      </div>
                    </div>

                    {/* Transparent Storage Info Banner */}
                    <div className="p-4 rounded-xl bg-black border border-zinc-800 flex items-start gap-3 text-xs">
                      <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-zinc-300">
                        <span className="font-bold text-white block">Transparenter Speicherstatus &amp; Firebase Storage Archivierung</span>
                        <p className="text-zinc-400 leading-relaxed">
                          Veyro.ai generiert KI-Videos serverseitig über Google Veo und Gemini Omni Flash. Wurde ein Video dauerhaft nach Firebase Storage übertragen (<code className="text-purple-300 bg-zinc-900 px-1 py-0.5 rounded">storageUrl</code>), ist der integrierte Player aktiv. Liegen ausschließlich Metadaten oder temporäre Streams vor, wird dies unverfälscht ausgewiesen. Es werden keine künstlichen URLs erfunden.
                        </p>
                      </div>
                    </div>

                    {/* Video Cards Grid */}
                    <div className="space-y-4">
                      {selectedUserDetail.generations.length === 0 ? (
                        <div className="py-12 text-center text-zinc-500 bg-zinc-950 rounded-xl border border-zinc-800">
                          Bisher keine Videogenerierungen für diesen Nutzer verzeichnet.
                        </div>
                      ) : (
                        selectedUserDetail.generations.map((gen) => {
                          const niche = gen.nicheId ? getNicheById(gen.nicheId) : null;
                          const hasStorage = Boolean(
                            gen.storageUrl ||
                            (gen.videoUrl && (gen.videoUrl.includes('firebasestorage') || gen.videoUrl.includes('storage.googleapis')))
                          );
                          const activeVideoSrc = gen.storageUrl || gen.videoUrl || null;

                          return (
                            <div key={gen.id} className="bg-black border border-zinc-800 rounded-xl p-5 space-y-4">
                              {/* Header: Title, Template, Status */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800/80 pb-3">
                                <div>
                                  <h5 className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                                    <Film className="w-4 h-4 text-purple-400" />
                                    {gen.title || `Video #${gen.id.slice(0, 8)}`}
                                  </h5>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-zinc-400">
                                    <span>Template: <strong className="text-zinc-200">{gen.templateName || 'Direct Creation'}</strong></span>
                                    <span>&bull;</span>
                                    <span>ID: <code className="font-mono text-[10px] text-zinc-500">{gen.id}</code></span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 self-start sm:self-auto">
                                  <span className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
                                    gen.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    gen.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                                    gen.status === 'refunded' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                                    'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}>
                                    {gen.status === 'completed' ? 'Abgeschlossen' :
                                     gen.status === 'failed' ? 'Fehlgeschlagen' :
                                     gen.status === 'refunded' ? 'Rückerstattet' : 'In Bearbeitung'}
                                  </span>
                                </div>
                              </div>

                              {/* Attributes Grid */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                                  <span className="block text-zinc-500 text-[10px] uppercase font-bold">Verwendete Credits:</span>
                                  <span className="font-bold text-amber-400 mt-0.5 flex items-center gap-1">
                                    <Coins className="w-3.5 h-3.5" />
                                    {gen.creditUsed ?? gen.creditCost ?? 10} Credits
                                  </span>
                                </div>

                                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                                  <span className="block text-zinc-500 text-[10px] uppercase font-bold">Nische:</span>
                                  <span className="font-semibold text-purple-300 mt-0.5 flex items-center gap-1 truncate">
                                    <Tag className="w-3.5 h-3.5" />
                                    {niche ? niche.name : (gen.nicheId || 'Nicht verfügbar')}
                                  </span>
                                </div>

                                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                                  <span className="block text-zinc-500 text-[10px] uppercase font-bold">Format &amp; Dauer:</span>
                                  <span className="font-medium text-zinc-200 mt-0.5">
                                    {gen.aspectRatio || '9:16'} &bull; {gen.durationSec || 15}s
                                  </span>
                                </div>

                                <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800">
                                  <span className="block text-zinc-500 text-[10px] uppercase font-bold">Erstellungsdatum:</span>
                                  <span className="font-medium text-zinc-300 mt-0.5 whitespace-nowrap">
                                    {gen.createdAt ? new Date(gen.createdAt).toLocaleString('de-DE') : 'Nicht verfügbar'}
                                  </span>
                                </div>
                              </div>

                              {/* Verwendeter Prompt / Idee */}
                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-zinc-300 flex items-center gap-1">
                                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                    Verwendete Nischen-Idee &amp; Prompt:
                                  </span>
                                  {gen.prompt && (
                                    <button
                                      onClick={(e) => copyPromptText(gen.prompt!, gen.id, e)}
                                      className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1 cursor-pointer transition"
                                      title="Prompt kopieren"
                                    >
                                      {copiedPromptId === gen.id ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span className="text-emerald-400">Kopiert</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3" />
                                          <span>Kopieren</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>

                                {gen.prompt ? (
                                  <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-zinc-200 font-mono text-[11px] leading-relaxed max-h-32 overflow-y-auto whitespace-pre-wrap">
                                    {gen.prompt}
                                  </div>
                                ) : (
                                  <div className="p-2.5 rounded-lg bg-zinc-900/40 border border-zinc-800 text-zinc-500 italic text-[11px]">
                                    Nicht verfügbar (Im Firestore-Dokument ist kein Prompt-Text in <code className="text-zinc-400">prompt</code> oder <code className="text-zinc-400">settings.userIdea</code> hinterlegt).
                                  </div>
                                )}
                              </div>

                              {/* Storage Status & Video Player */}
                              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                                    Speicherstatus:
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    hasStorage ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                                    activeVideoSrc ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                                    'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                  }`}>
                                    {hasStorage ? 'In Firebase Storage gespeichert' :
                                     activeVideoSrc ? 'Temporäre Streaming-URL (Google Cloud)' :
                                     'Nicht in Firebase Storage archiviert (nur Metadaten)'}
                                  </span>
                                </div>

                                {activeVideoSrc ? (
                                  <div className="relative rounded-lg overflow-hidden bg-black border border-zinc-800 aspect-video max-h-64 mt-2">
                                    <video
                                      src={activeVideoSrc}
                                      controls
                                      className="w-full h-full object-contain"
                                      poster={gen.thumbnailUrl || undefined}
                                    />
                                  </div>
                                ) : gen.thumbnailUrl ? (
                                  <div className="relative rounded-lg overflow-hidden bg-zinc-900 border border-zinc-800 aspect-video max-h-48 mt-2">
                                    <img src={gen.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center p-4 text-center">
                                      <p className="text-xs text-zinc-300">
                                        Nur Vorschau-Thumbnail verfügbar &bull; Keine MP4-Datei in Firebase Storage hinterlegt.
                                      </p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-zinc-500 bg-zinc-900/30 p-2.5 rounded-lg border border-zinc-800/60">
                                    Keine Videodatei in Firebase Storage vorhanden. Für diesen Render-Job existieren ausschließlich Metadaten in Firestore (<code className="text-zinc-400">users/{'{uid}'}/generations</code>).
                                  </p>
                                )}
                              </div>

                              {/* Error / Refund Info if applicable */}
                              {gen.failReason && (
                                <div className="text-xs text-red-300 bg-red-950/40 p-3 rounded-lg border border-red-900/50 space-y-1">
                                  <div className="font-bold flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                    Fehlerursache:
                                  </div>
                                  <p className="text-[11px] text-red-200">{gen.failReason}</p>
                                  {gen.refunded && (
                                    <p className="text-[11px] text-emerald-400 font-semibold pt-1">
                                      &bull; Credits wurden dem Nutzerkonto automatisch rückerstattet.
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Credit Adjustment Sub-Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Credits anpassen
              </h3>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Füge Credits hinzu (z.B. <strong className="text-emerald-400">+50</strong>) oder ziehe Credits ab (z.B. <strong className="text-red-400">-20</strong>). Diese Aktion wird fälschungssicher im Transaktions-Ledger protokolliert.
            </p>

            {adjustError && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                {adjustError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Anzahl Credits (+ oder -):
                </label>
                <input
                  type="number"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Begründung für das Audit-Log:
                </label>
                <textarea
                  rows={3}
                  placeholder="z.B. Kulanzgutschrift wegen Renderverzögerung oder manuelles Upgrade"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition cursor-pointer"
              >
                Abbrechen
              </button>
              <button
                onClick={handleAdjustCredits}
                disabled={adjusting}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-bold transition shadow-lg shadow-purple-600/30 cursor-pointer"
              >
                {adjusting ? 'Wende an...' : 'Jetzt anwenden'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
