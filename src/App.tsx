import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, User, setPersistence, inMemoryPersistence } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { authFetch } from './lib/authFetch';
import { handleFirestoreError, OperationType } from './lib/firestoreErrors';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { Discover } from './components/Discover';
import { Dashboard } from './components/Dashboard';
import { TemplateDetail } from './components/TemplateDetail';
import { MyVideos } from './components/MyVideos';
import { Pricing } from './components/Pricing';
import { VideoGeneratorModal } from './components/VideoGeneratorModal';
import { VerticalVideoPlayer } from './components/VerticalVideoPlayer';
import { CreditModal } from './components/CreditModal';
import { AuthModal } from './components/AuthModal';
import { VIDEO_TEMPLATES } from './data/templates';
import { VideoTemplate, GeneratedVideo, UserProfile } from './types';

const GUEST_USER: UserProfile = {
  name: 'Gast',
  email: '',
  credits: 0,
  plan: 'free',
  videosCreatedCount: 0,
  estimatedViews: 0,
};

export default function App() {
  const [currentTab, setCurrentTab] = useState<'landing' | 'discover' | 'dashboard' | 'my-videos' | 'pricing' | 'detail'>('discover');
  const [selectedTemplate, setSelectedTemplate] = useState<VideoTemplate>(VIDEO_TEMPLATES[0]);
  
  // Firebase Auth state
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // User Profile state (strictly isolated, initialized to Guest)
  const [user, setUser] = useState<UserProfile>(GUEST_USER);

  // User Videos state (strictly isolated, empty unless authenticated)
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);

  // Modal states
  const [isCreditModalOpen, setIsCreditModalOpen] = useState(false);
  const [activeVideoForPlayer, setActiveVideoForPlayer] = useState<GeneratedVideo | null>(null);
  
  // Video Generation Workflow State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingPayload, setGeneratingPayload] = useState<{
    template: VideoTemplate;
    settings: Record<string, any>;
    customPrompt: string;
    generationId: string;
  } | null>(null);

  // Test Firestore connection on boot
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();

    // Anforderung: Wenn die Webapp geöffnet wird, soll kein Nutzer angemeldet sein
    const enforceSignedOutOnLaunch = async () => {
      try {
        await setPersistence(auth, inMemoryPersistence);
        await signOut(auth);
      } catch (err) {
        console.warn("Initial launch sign-out note:", err);
      }
      setUser(GUEST_USER);
      setVideos([]);
      setFirebaseUser(null);
      localStorage.removeItem('shortscraft_user');
      localStorage.removeItem('shortscraft_videos');
    };
    enforceSignedOutOnLaunch();
  }, []);

  // Listen to Firebase Auth state changes and sync user profile, credits & videos from Firestore
  useEffect(() => {
    let unsubUserDoc: (() => void) | null = null;
    let unsubVideos: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      // Unsubscribe any previous listeners
      if (unsubUserDoc) {
        unsubUserDoc();
        unsubUserDoc = null;
      }
      if (unsubVideos) {
        unsubVideos();
        unsubVideos = null;
      }

      setFirebaseUser(currentUser);

      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);

        // Realtime listener for User Profile and individual Credits
        unsubUserDoc = onSnapshot(
          userDocRef,
          async (snap) => {
            if (snap.exists()) {
              const data = snap.data();
              const creditsVal = typeof data.credits === 'number' ? data.credits : 0;
              const updatedProfile: UserProfile = {
                name: data.displayName || data.name || currentUser.displayName || currentUser.email?.split('@')[0] || 'Creator',
                email: data.email || currentUser.email || '',
                credits: creditsVal,
                plan: (data.plan as 'free' | 'creator' | 'pro') || 'creator',
                videosCreatedCount: typeof data.videosCreatedCount === 'number' ? data.videosCreatedCount : 0,
                estimatedViews: typeof data.estimatedViews === 'number' ? data.estimatedViews : 0,
              };
              setUser(updatedProfile);
            } else {
              // Doc doesn't exist yet -> initialize securely via backend API with Admin SDK
              authFetch('/api/user-init', { method: 'POST' }).catch((initErr) => {
                console.error("Error initializing user via backend:", initErr);
              });
            }
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
          }
        );

        // Realtime listener for User Videos
        const videosQuery = query(
          collection(db, `users/${currentUser.uid}/videos`),
          orderBy('createdAtMillis', 'desc')
        );

        unsubVideos = onSnapshot(
          videosQuery,
          (snapshot) => {
            const loadedVideos: GeneratedVideo[] = snapshot.docs.map((docSnap) => {
              const d = docSnap.data();
              return {
                id: docSnap.id,
                title: d.title || 'Untitled Video',
                templateId: d.templateId || '',
                templateName: d.templateName || '',
                thumbnailUrl: d.thumbnailUrl || '',
                videoUrl: d.videoUrl || undefined,
                modelUsed: d.modelUsed || 'veo-3.1-lite-generate-preview',
                durationSec: d.durationSec || 15,
                createdAt: d.createdAt || '',
                status: d.status || 'completed',
                creditUsed: d.creditUsed || 10,
                scenes: d.scenes || [],
                settings: d.settings || {},
                aspectRatio: (d.aspectRatio as '9:16' | '16:9') || '9:16',
              };
            });
            setVideos(loadedVideos);
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, `users/${currentUser.uid}/videos`);
          }
        );
      } else {
        // User is logged out: reset state completely to blank guest
        setUser(GUEST_USER);
        setVideos([]);
        localStorage.removeItem('shortscraft_user');
        localStorage.removeItem('shortscraft_videos');
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubUserDoc) unsubUserDoc();
      if (unsubVideos) unsubVideos();
    };
  }, []);

  // Handle selecting a template to customize
  const handleSelectTemplate = (template: VideoTemplate) => {
    setSelectedTemplate(template);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Trigger video generation pipeline
  const handleStartGeneration = async (
    template: VideoTemplate,
    settings: Record<string, any>,
    customPrompt: string
  ) => {
    if (!firebaseUser) {
      setIsAuthModalOpen(true);
      return;
    }
    const cost = settings.duration <= 20 ? 10 : settings.duration <= 35 ? 15 : 20;

    // Optional frontend hint to avoid starting if balance is clearly insufficient
    if (user.credits < cost) {
      setIsCreditModalOpen(true);
      return;
    }

    // Unique generationId for idempotency and server-side transaction tracking
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setGeneratingPayload({ template, settings, customPrompt, generationId });
    setIsGenerating(true);
  };

  // When generation pipeline finishes
  const handleGenerationComplete = async (newVideo: GeneratedVideo) => {
    setIsGenerating(false);
    setGeneratingPayload(null);
    setVideos((prev) => [newVideo, ...prev.filter((v) => v.id !== newVideo.id)]);
    setActiveVideoForPlayer(newVideo);

    if (firebaseUser) {
      try {
        const videoPayload = {
          title: newVideo.title,
          templateId: newVideo.templateId,
          templateName: newVideo.templateName,
          thumbnailUrl: newVideo.thumbnailUrl,
          videoUrl: newVideo.videoUrl || '',
          modelUsed: newVideo.modelUsed || 'veo-3.1-lite-generate-preview',
          durationSec: newVideo.durationSec,
          createdAt: newVideo.createdAt,
          createdAtMillis: Date.now(),
          status: newVideo.status,
          creditUsed: newVideo.creditUsed,
          scenes: newVideo.scenes || [],
          settings: newVideo.settings || {},
          aspectRatio: newVideo.aspectRatio || '9:16',
        };
        await setDoc(doc(db, 'users', firebaseUser.uid, 'videos', newVideo.id), videoPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${firebaseUser.uid}/videos/${newVideo.id}`);
      }
    }
  };

  // Update plan notification (Client cannot write credits/plan directly)
  const handleUpdatePlan = (plan: 'free' | 'creator' | 'pro', additionalCredits: number) => {
    if (!firebaseUser) {
      setIsAuthModalOpen(true);
      return;
    }
    // Secure Architecture: Direct client modification is blocked
    console.log(`Plan change requested for ${plan} (+${additionalCredits} credits). Backend payment integration required.`);
  };

  // Add credits notification (Client cannot write credits directly)
  const handleAddCredits = (amount: number) => {
    if (!firebaseUser) {
      setIsAuthModalOpen(true);
      return;
    }
    // Secure Architecture: Direct client modification is blocked
    console.log(`Credit purchase requested for ${amount} credits. Backend payment integration required.`);
  };

  // Delete video from library and Firestore
  const handleDeleteVideo = async (videoId: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== videoId));
    const newCount = Math.max(0, user.videosCreatedCount - 1);
    setUser((prev) => ({
      ...prev,
      videosCreatedCount: newCount,
    }));

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'users', firebaseUser.uid, 'videos', videoId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${firebaseUser.uid}/videos/${videoId}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      
      {/* Top Bar Navigation */}
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={user}
        authUser={firebaseUser}
        onOpenCreditsModal={() => {
          if (!firebaseUser) {
            setIsAuthModalOpen(true);
          } else {
            setIsCreditModalOpen(true);
          }
        }}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onSignOut={async () => {
          await signOut(auth);
          localStorage.removeItem('shortscraft_user');
          localStorage.removeItem('shortscraft_videos');
          setUser(GUEST_USER);
          setVideos([]);
          setCurrentTab('landing');
        }}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {currentTab === 'landing' && (
          <LandingPage
            onSelectTemplate={handleSelectTemplate}
            onExploreLibrary={() => setCurrentTab('discover')}
          />
        )}

        {currentTab === 'discover' && (
          <Discover onSelectTemplate={handleSelectTemplate} />
        )}

        {currentTab === 'dashboard' && (
          <Dashboard
            user={user}
            authUser={firebaseUser}
            recentVideos={firebaseUser ? videos : []}
            onSelectTemplate={handleSelectTemplate}
            onGoToDiscover={() => setCurrentTab('discover')}
            onGoToMyVideos={() => setCurrentTab('my-videos')}
            onPlayVideo={(vid) => setActiveVideoForPlayer(vid)}
            onOpenCreditsModal={() => {
              if (!firebaseUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsCreditModalOpen(true);
              }
            }}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'detail' && selectedTemplate && (
          <TemplateDetail
            template={selectedTemplate}
            userCredits={user.credits}
            isLoggedIn={!!firebaseUser}
            onBack={() => setCurrentTab('discover')}
            onStartGeneration={handleStartGeneration}
            onOpenCreditsModal={() => {
              if (!firebaseUser) {
                setIsAuthModalOpen(true);
              } else {
                setIsCreditModalOpen(true);
              }
            }}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}

        {currentTab === 'my-videos' && (
          <MyVideos
            videos={firebaseUser ? videos : []}
            onPlayVideo={(vid) => setActiveVideoForPlayer(vid)}
            onDeleteVideo={handleDeleteVideo}
            onGoToDiscover={() => setCurrentTab('discover')}
          />
        )}

        {currentTab === 'pricing' && (
          <Pricing
            user={user}
            authUser={firebaseUser}
            onUpdatePlan={handleUpdatePlan}
            onOpenAuthModal={() => setIsAuthModalOpen(true)}
          />
        )}
      </main>

      {/* Generation Progress Modal */}
      {isGenerating && generatingPayload && (
        <VideoGeneratorModal
          template={generatingPayload.template}
          settings={generatingPayload.settings}
          customPrompt={generatingPayload.customPrompt}
          generationId={generatingPayload.generationId}
          onComplete={handleGenerationComplete}
          onCancel={() => setIsGenerating(false)}
          onOpenCreditModal={() => setIsCreditModalOpen(true)}
        />
      )}

      {/* Vertical 9:16 Video Player Modal */}
      {activeVideoForPlayer && (
        <VerticalVideoPlayer
          video={activeVideoForPlayer}
          onClose={() => setActiveVideoForPlayer(null)}
          onRegenerate={() => {
            const tpl = VIDEO_TEMPLATES.find((t) => t.id === activeVideoForPlayer.templateId) || selectedTemplate;
            setActiveVideoForPlayer(null);
            handleStartGeneration(tpl, activeVideoForPlayer.settings || {}, '');
          }}
          onCreateSimilar={() => {
            const tpl = VIDEO_TEMPLATES.find((t) => t.id === activeVideoForPlayer.templateId) || selectedTemplate;
            setActiveVideoForPlayer(null);
            handleSelectTemplate(tpl);
          }}
        />
      )}

      {/* Credits Management Modal */}
      <CreditModal
        isOpen={isCreditModalOpen}
        onClose={() => setIsCreditModalOpen(false)}
        user={user}
        authUser={firebaseUser}
        onAddCredits={handleAddCredits}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Firebase Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

    </div>
  );
}
