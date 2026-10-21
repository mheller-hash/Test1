import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// Load Firebase Config
const firebaseConfigPath = path.resolve(__dirname, 'src/firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

// Initialize Firebase Admin SDK for cryptographic ID-token verification & server-side Firestore
let adminApp: ReturnType<typeof initAdminApp>;
try {
  if (getAdminApps().length === 0) {
    adminApp = initAdminApp({
      projectId: firebaseConfig.projectId,
    });
  } else {
    adminApp = getAdminApps()[0];
  }
  console.log(`Firebase Admin SDK initialized for project ${firebaseConfig.projectId}`);
} catch (adminErr) {
  console.error('CRITICAL: Failed to initialize Firebase Admin SDK:', adminErr);
  process.exit(1);
}

export const adminAuth = getAdminAuth(adminApp);
export const adminDb = getAdminFirestore(adminApp, firebaseConfig.firestoreDatabaseId);

// Authenticated Request Interface
export interface AuthenticatedRequest extends express.Request {
  user?: {
    uid: string;
    email?: string;
    displayName?: string;
  };
}

// Central Auth Middleware: Validates Bearer ID-Token via Firebase Admin
export async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded || !decoded.uid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      displayName: (decoded as any).name || (decoded as any).displayName,
    };
    next();
  } catch (err: any) {
    console.warn('Auth token verification rejected:', err.message || err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed', details: err.message });
  }
}

// Server-authoritative Credit Cost Calculation
export function computeVideoCost(durationSec: number | undefined): number {
  const duration = typeof durationSec === 'number' && !isNaN(durationSec) && durationSec > 0 ? durationSec : 30;
  if (duration <= 20) return 10;
  if (duration <= 35) return 15;
  return 20;
}

// Helper: Ensure user document exists with 0 initial credits (no signup bonus)
// Atomically and idempotently executed via Admin SDK transaction
export async function ensureUserDoc(uid: string, email?: string, displayName?: string) {
  const userRef = adminDb.collection('users').doc(uid);

  return await adminDb.runTransaction(async (t) => {
    const userSnap = await t.get(userRef);

    // If user profile already exists -> return immediately unchanged. Never alter or overwrite existing credits!
    if (userSnap.exists) {
      return userSnap.data();
    }

    // New user profile: initialize with 0 credits, standard profile fields, and no signup bonus
    const initialUserData = {
      displayName: displayName || email?.split('@')[0] || 'Creator',
      email: email || '',
      credits: 0,
      plan: 'creator',
      videosCreatedCount: 0,
      estimatedViews: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    t.set(userRef, initialUserData);
    return initialUserData;
  });
}

// Helper: Idempotent Refund function
export async function refundCredits(
  uid: string,
  generationId: string,
  cost: number,
  model: string,
  reason: string
) {
  const userRef = adminDb.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const refundTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-refund`);

  try {
    await adminDb.runTransaction(async (t) => {
      // Idempotency: If refund transaction already exists, do not refund again
      const existingRefund = await t.get(refundTxRef);
      if (existingRefund.exists) {
        console.log(`[Refund] Generation ${generationId} was already refunded, skipping duplicate.`);
        return;
      }

      const userDoc = await t.get(userRef);
      const data = userDoc.exists ? userDoc.data() : {};
      const currentCredits = typeof data?.credits === 'number' ? data.credits : 0;
      const currentCount = typeof data?.videosCreatedCount === 'number' ? data.videosCreatedCount : 1;

      t.update(userRef, {
        credits: currentCredits + cost,
        videosCreatedCount: Math.max(0, currentCount - 1),
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.set(refundTxRef, {
        amount: cost,
        type: 'generation_refund',
        balanceAfter: currentCredits + cost,
        generationId,
        model,
        reason,
        createdAt: FieldValue.serverTimestamp(),
        status: 'completed',
      });

      t.update(genRef, {
        status: 'failed',
        refunded: true,
        refundReason: reason,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    console.log(`[Refund] Successfully refunded ${cost} credits to user ${uid} for generation ${generationId}`);
  } catch (err) {
    console.error(`[Refund] Failed to refund credits for generation ${generationId}:`, err);
  }
}

// Initialize Gemini Client if key exists
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  } catch (err) {
    console.warn('Gemini client initialization failed, will use fallback generation:', err);
  }
}

// Helper to generate realistic scene word timings
function buildTimedSubtitles(text: string, startOffsetSec: number, totalDurationSec: number) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const wordDuration = Math.max(0.25, (totalDurationSec - 0.5) / words.length);
  return words.map((word, idx) => ({
    word,
    startSec: parseFloat((startOffsetSec + idx * wordDuration).toFixed(2)),
    endSec: parseFloat((startOffsetSec + (idx + 1) * wordDuration).toFixed(2)),
  }));
}

// Public Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'ShortsCraft AI backend' });
});

// Protected: Initialize / Sync user profile in Firestore
app.post('/api/user-init', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userData = await ensureUserDoc(uid, req.user!.email, req.user!.displayName);
    res.json({ success: true, user: userData });
  } catch (error: any) {
    console.error('Error initializing user:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize user' });
  }
});

// Protected: Story & Scene Generation with Gemini
app.post('/api/generate-story', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { templateId, templateTitle, settings, durationSec, customPrompt } = req.body;
    const duration = durationSec || 30;
    const sceneCount = duration <= 20 ? 3 : duration <= 40 ? 4 : 5;
    const secondsPerScene = Math.floor(duration / sceneCount);

    let generatedScenes: any[] = [];
    let videoTitle = `${templateTitle} Short`;

    if (aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const prompt = `Du bist ein erfahrener Showrunner für virale Kurzvideos auf TikTok, Instagram Reels und YouTube Shorts.
Erstelle ein kurzes, extrem fesselndes Skript für das Video-Template "${templateTitle}".
Details und Nutzerwünsche:
- Einstellungen: ${JSON.stringify(settings || {})}
- Gesamtdauer: ca. ${duration} Sekunden
- Anzahl Szenen: genau ${sceneCount} Szenen (jede ca. ${secondsPerScene}s)
- Zusätzlicher Nutzer-Wunsch: "${customPrompt || 'Maximale Viralität und Unterhaltungswert'}"

Antworte ausschließlich im folgenden validen JSON-Format:
{
  "title": "Knackiger viraler Titel (max 6 Worte)",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "Name des Charakters oder Erzähler",
      "spokenText": "Gesprochener Satz (punchy, 1-2 Sätze)",
      "visualAction": "Präzise Beschreibung der Kameraschwenks / Bildaktion",
      "imagePrompt": "Detailreicher visueller Bild-Prompt für 9:16 vertikales Video"
    }
  ]
}`;

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout after 15s')), 15000)
        );

        const geminiPromise = aiClient.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        const text = response.text || '';
        const parsed = JSON.parse(text);

        if (parsed.title) videoTitle = parsed.title;
        if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
          let currentTimestamp = 0;
          generatedScenes = parsed.scenes.map((sc: any, idx: number) => {
            const scDuration = idx === parsed.scenes.length - 1 ? duration - currentTimestamp : secondsPerScene;
            const subs = buildTimedSubtitles(sc.spokenText || '', currentTimestamp, scDuration);
            const scObj = {
              id: `scene-${idx + 1}`,
              duration: scDuration,
              speaker: sc.speaker || `Speaker ${idx + 1}`,
              spokenText: sc.spokenText || '',
              visualAction: sc.visualAction || '',
              imagePrompt: sc.imagePrompt || '',
              subtitles: subs,
            };
            currentTimestamp += scDuration;
            return scObj;
          });
        }
      } catch (geminiErr: any) {
        console.warn('Gemini live generation failed, switching to curated dynamic template:', geminiErr.message);
      }
    }

    if (generatedScenes.length === 0) {
      const templateThemes: Record<string, any[]> = {
        'reddit-stories': [
          { speaker: 'Erzähler (Reddit)', spoken: 'Heute habe ich herausgefunden, was mein Chef nachts im Büro wirklich treibt...', action: 'Schneller Zoom auf verlassenes Bürogebäude bei Nacht, flackerndes Deckenlicht' },
          { speaker: 'Erzähler (Reddit)', spoken: 'Ich hatte meinen USB-Stick vergessen und schlich mich um 23 Uhr leise zurück.', action: 'Subjektive Handkamera schleicht durch dunklen Korridor, gedämpfte Schritte' },
          { speaker: 'Chef', spoken: 'Er saß nicht am Schreibtisch. Er stand im Serverraum und baute heimlich Krypto-Miner aus alten Servern!', action: 'Kamera blickt durch Lüftungsgitter auf glühende LED-Racks und überraschtes Gesicht' },
          { speaker: 'Erzähler (Reddit)', spoken: 'Als er mich sah, bot er mir sofort eine 50/50 Beteiligung an, wenn ich schweige...', action: 'Dramatischer Freeze-Frame mit aufleuchtendem Dollar-Symbol und Cliffhanger-Sound' }
        ],
        'fake-history': [
          { speaker: 'Historiker', spoken: 'Was euch in der Schule über Julius Cäsar verschwiegen wurde, ist absolut verrückt.', action: 'Statue von Cäsar zoomt mit Glitch-Effekt und rotem dramatischen Scheinwerfer' },
          { speaker: 'Historiker', spoken: 'Er wurde 75 v. Chr. von Piraten entführt und beschwerte sich lautstark über das Lösegeld!', action: 'Antikes Holzschiff im Sturm, Cäsar gestikuliert wütend vor verdutzten Piraten' },
          { speaker: 'Cäsar', spoken: '20 Talente? Kennt ihr meinen Wert nicht? Verlangt mindestens 50!', action: 'Goldmünzen regnen in Zeitlupe herab, epische orchestrale Musik' },
          { speaker: 'Historiker', spoken: 'Nach seiner Freilassung kaperte er eine Flotte und kreuzigte alle seine Entführer wie versprochen.', action: 'Silhouette einer römischen Kriegsflotte im Sonnenuntergang mit bedrohlichem Bass' }
        ]
      };

      const items = templateThemes[templateId] || [
        { speaker: 'Host', spoken: `3 Geheimnisse über ${templateTitle}, die du garantiert noch nicht kanntest!`, action: 'Dynamischer Hook mit schnellem Text-Pop-in und animiertem Emoji' },
        { speaker: 'Host', spoken: 'Nummer 1: Die meisten Creator machen diesen einen kritischen Fehler beim Upload.', action: 'Split-Screen: Falsche Methode vs. Richtige Methode mit Soundeffekt' },
        { speaker: 'Host', spoken: 'Nummer 2: Der Algorithmus liebt exakt diesen Schnitt-Rhythmus in den ersten 3 Sekunden.', action: 'Timeline-Grafik mit pulsierender Retention-Kurve in Neongrün' },
        { speaker: 'Host', spoken: 'Speichere diesen Short jetzt ab und folge für Teil 2 morgen!', action: 'Call to Action Button pulsiert mit Pfeil-Animation' }
      ];

      let currentTimestamp = 0;
      generatedScenes = items.map((item, idx) => {
        const scDuration = idx === items.length - 1 ? duration - currentTimestamp : secondsPerScene;
        const subs = buildTimedSubtitles(item.spoken, currentTimestamp, scDuration);
        const scObj = {
          id: `scene-${idx + 1}`,
          duration: scDuration,
          speaker: item.speaker,
          spokenText: item.spoken,
          visualAction: item.action,
          subtitles: subs,
        };
        currentTimestamp += scDuration;
        return scObj;
      });
    }

    res.json({
      success: true,
      title: videoTitle,
      durationSec: duration,
      scenes: generatedScenes,
    });
  } catch (error: any) {
    console.error('Failed to generate story:', error);
    res.status(500).json({ error: error.message || 'Generation failed' });
  }
});

// Protected: Veo Video Generation with Atomic Credit Transaction & Idempotency
app.post('/api/generate-video', requireAuth, async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  const { prompt, aspectRatio = '9:16', resolution = '720p', model, durationSec, generationId: clientGenId } = req.body;

  // 1. Validate API Client
  if (!aiClient || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured on the server. Bitte wähle einen API-Key in AI Studio.',
      missingKey: true,
    });
  }

  // 2. Server-Authoritative Cost & Idempotency Key
  const duration = typeof durationSec === 'number' && !isNaN(durationSec) ? durationSec : 30;
  const cost = computeVideoCost(duration);
  const generationId = clientGenId && typeof clientGenId === 'string' && clientGenId.trim().length > 0
    ? clientGenId.trim()
    : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const requestedModel = model || 'veo-3.1-fast-generate-preview';
  const validAspectRatio = aspectRatio === '16:9' ? '16:9' : '9:16';
  const validResolution = resolution === '1080p' ? '1080p' : '720p';

  const userRef = adminDb.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const chargeTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-charge`);

  // 3. Idempotency Check: Did this generationId already run or complete?
  try {
    const existingGen = await genRef.get();
    if (existingGen.exists) {
      const gData = existingGen.data() || {};
      if (gData.operationName) {
        console.log(`[Idempotency] Request with generationId ${generationId} already has operation ${gData.operationName}`);
        return res.json({
          operationName: gData.operationName,
          modelUsed: gData.modelUsed || requestedModel,
          aspectRatio: gData.aspectRatio || validAspectRatio,
          generationId,
          alreadyStarted: true,
        });
      }
    }
  } catch (err: any) {
    console.warn('Idempotency pre-check warning:', err.message);
  }

  // 4. Atomic Firestore Transaction for Credit Verification and Deduction
  let charged = false;
  try {
    await adminDb.runTransaction(async (t) => {
      const userDoc = await t.get(userRef);
      let currentCredits = 0;
      let currentCount = 0;

      if (!userDoc.exists) {
        // First-time user initialization inside transaction with 0 credits
        t.set(userRef, {
          displayName: req.user!.displayName || req.user!.email?.split('@')[0] || 'Creator',
          email: req.user!.email || '',
          credits: 0,
          plan: 'creator',
          videosCreatedCount: 0,
          estimatedViews: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        throw new Error('INSUFFICIENT_CREDITS');
      } else {
        const data = userDoc.data() || {};
        currentCredits = typeof data.credits === 'number' ? data.credits : 0;
        currentCount = typeof data.videosCreatedCount === 'number' ? data.videosCreatedCount : 0;

        if (currentCredits < cost) {
          throw new Error('INSUFFICIENT_CREDITS');
        }

        t.update(userRef, {
          credits: currentCredits - cost,
          videosCreatedCount: currentCount + 1,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Ledger: Charge Record
      t.set(chargeTxRef, {
        amount: -cost,
        type: 'generation_charge',
        balanceAfter: currentCredits - cost,
        generationId,
        model: requestedModel,
        cost,
        createdAt: FieldValue.serverTimestamp(),
        status: 'completed',
        details: {
          durationSec: duration,
          aspectRatio: validAspectRatio,
          resolution: validResolution,
        },
      });

      // Generation Record
      t.set(genRef, {
        id: generationId,
        userId: uid,
        cost,
        status: 'starting',
        modelUsed: requestedModel,
        aspectRatio: validAspectRatio,
        resolution: validResolution,
        durationSec: duration,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    charged = true;
  } catch (txErr: any) {
    if (txErr.message === 'INSUFFICIENT_CREDITS') {
      return res.status(402).json({
        error: `Nicht genügend Credits vorhanden. Erforderlich: ${cost} Credits.`,
        requiredCredits: cost,
        code: 'INSUFFICIENT_CREDITS',
      });
    }
    console.error('Credit transaction failed:', txErr);
    return res.status(500).json({ error: 'Credit transaction failed: ' + txErr.message });
  }

  // 5. Veo Video Generation Initiation
  let operation;
  try {
    try {
      operation = await aiClient.models.generateVideos({
        model: requestedModel,
        prompt: prompt || 'A cinematic viral short video with dynamic camera angles and striking lighting',
        config: {
          numberOfVideos: 1,
          resolution: validResolution,
          aspectRatio: validAspectRatio,
        },
      });
    } catch (modelErr: any) {
      console.warn(`Attempt with ${requestedModel} failed, trying veo-3.1-lite-generate-preview:`, modelErr?.message || modelErr);
      operation = await aiClient.models.generateVideos({
        model: 'veo-3.1-lite-generate-preview',
        prompt: prompt || 'A cinematic viral short video with dynamic camera angles and striking lighting',
        config: {
          numberOfVideos: 1,
          resolution: validResolution,
          aspectRatio: validAspectRatio,
        },
      });
    }

    if (!operation || !operation.name) {
      throw new Error('Failed to obtain operation name from video generation');
    }

    // 6. Record operation details and ownership
    await genRef.update({
      operationName: operation.name,
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Save global operation-to-user mapping for secure access verification
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operation.name));
    await opDocRef.set({
      operationName: operation.name,
      userId: uid,
      generationId,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.json({
      operationName: operation.name,
      modelUsed: requestedModel,
      aspectRatio: validAspectRatio,
      generationId,
      cost,
    });
  } catch (veoErr: any) {
    console.error('Veo video generation error, triggering automatic refund:', veoErr);
    
    // 7. Automatic Idempotent Refund if charged
    if (charged) {
      await refundCredits(uid, generationId, cost, requestedModel, veoErr.message || 'Veo start error');
    }

    res.status(500).json({
      error: `Video-Generierung konnte nicht gestartet werden: ${veoErr.message || veoErr}. Deine ${cost} Credits wurden automatisch zurückerstattet.`,
      refunded: true,
      cost,
    });
  }
});

// Protected: Veo Video Status Polling with Ownership Verification
app.post('/api/video-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'Missing operationName in request' });
    }
    if (!aiClient) {
      return res.status(400).json({ error: 'Gemini client is not initialized' });
    }

    // Ownership Verification: Ensure this operation belongs to the authenticated user
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
    const opDoc = await opDocRef.get();

    if (opDoc.exists) {
      const opData = opDoc.data();
      if (opData?.userId !== req.user!.uid) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to check this operation.' });
      }
    } else {
      // Fallback check in user's generation collection
      const userGenRef = adminDb.collection('users').doc(req.user!.uid).collection('generations').doc(operationName);
      const userGen = await userGenRef.get();
      if (!userGen.exists) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to check this operation.' });
      }
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await aiClient.operations.getVideosOperation({ operation: op });

    res.json({
      done: Boolean(updated.done),
      error: updated.error || null,
      metadata: updated.metadata || null,
    });
  } catch (error: any) {
    console.error('Error checking Veo video status:', error);
    res.status(500).json({ error: error.message || 'Status check failed' });
  }
});

// Protected: Veo Video Download Streaming with Ownership Verification
app.post('/api/video-download', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'Missing operationName in request' });
    }
    if (!aiClient || !process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini client is not initialized' });
    }

    // Ownership Verification: Ensure this operation belongs to the authenticated user
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
    const opDoc = await opDocRef.get();

    if (opDoc.exists) {
      const opData = opDoc.data();
      if (opData?.userId !== req.user!.uid) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to download this video.' });
      }
    } else {
      const userGenRef = adminDb.collection('users').doc(req.user!.uid).collection('generations').doc(operationName);
      const userGen = await userGenRef.get();
      if (!userGen.exists) {
        return res.status(403).json({ error: 'Forbidden: You do not have permission to download this video.' });
      }
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await aiClient.operations.getVideosOperation({ operation: op });
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return res.status(404).json({ error: 'Video URI not found in completed operation' });
    }

    const videoRes = await fetch(uri, {
      headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
    });

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: `Failed to fetch video stream (${videoRes.status})` });
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'inline; filename="generated_video.mp4"');

    if (videoRes.body) {
      const reader = videoRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          res.end();
          break;
        }
        res.write(value);
      }
    } else {
      const arrayBuf = await videoRes.arrayBuffer();
      res.send(Buffer.from(arrayBuf));
    }
  } catch (error: any) {
    console.error('Error downloading Veo video:', error);
    res.status(500).json({ error: error.message || 'Download failed' });
  }
});

// Vite Middleware for development / Static file serving for production
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
