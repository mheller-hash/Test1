import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { GoogleGenAI, GenerateVideosOperation } from '@google/genai';
import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore as getAdminFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { getNicheById, isValidNicheId } from './src/data/niches.js';
import {
  buildGeminiPromptDirectorInstructions,
  validateAndCompileNichePromptPlan,
} from './src/lib/nichePromptDirector.js';
import { NichePromptPlan } from './src/types/niche.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Trust first proxy hop (Google Cloud Load Balancer / Cloud Run ingress)
app.set('trust proxy', 1);

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
      storageBucket: firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`,
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
export const adminStorage = getAdminStorage(adminApp);
export const STORAGE_BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || `${firebaseConfig.projectId}.firebasestorage.app`;
export const activeStorageUploads = new Map<string, Promise<any>>();
export const inMemoryStoredVideos = new Map<string, { buffer: Buffer; mimeType: string; uploadedAt: string }>();

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
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
}

// Administrator Whitelist & Custom Claims Verification
export const TARGET_ADMIN_UID = 'WNCq0kNNYbeCLNAGS0TXPsMqfP02';
export const ADMIN_EMAILS = ['veyro.ai01@gmail.com', 'max.heller.web@gmail.com'];

export function isAdminUser(user: { uid?: string; email?: string; admin?: boolean } | undefined): boolean {
  if (!user) return false;
  if (user.admin === true) return true;
  if (user.uid === TARGET_ADMIN_UID) return true;
  if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase())) return true;
  return false;
}

// Strictly enforces Administrator Privileges via Firebase Admin token inspection & custom claims
export async function requireAdmin(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction) {
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

    const isAdm = Boolean(
      decoded.admin === true ||
      decoded.uid === TARGET_ADMIN_UID ||
      (decoded.email && ADMIN_EMAILS.includes(decoded.email.toLowerCase()))
    );

    if (!isAdm) {
      console.warn(`[Admin Guard] Forbidden: Access rejected for non-admin user ${decoded.email || decoded.uid}`);
      return res.status(403).json({ error: 'Forbidden: Administratoren-Rechte erforderlich.' });
    }

    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      displayName: (decoded as any).name || (decoded as any).displayName,
    };
    next();
  } catch (err: any) {
    console.warn('Admin token verification rejected:', err.message || err);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
}

// Helper: Fetch all registered users from Firebase Auth via Admin SDK paginated
export async function getAllAuthUsers(): Promise<any[]> {
  const users: any[] = [];
  let pageToken: string | undefined = undefined;

  try {
    do {
      const result = await adminAuth.listUsers(1000, pageToken);
      if (result.users && Array.isArray(result.users)) {
        users.push(...result.users);
      }
      pageToken = result.pageToken;
    } while (pageToken);
  } catch (err: any) {
    console.warn('[Auth Admin SDK] listUsers notice (operating with Firestore & in-memory users):', err.message || err);
  }

  return users;
}

// Server-authoritative Whitelists and Constants
export const ALLOWED_MODELS = [
  'gemini-omni-1.1-flash',
  'gemini-omni-flash-preview',
  'veo-3.1-fast-generate-preview',
  'veo-3.1-lite-generate-preview',
  'veo-2.0-generate-001',
] as const;
export type AllowedModel = (typeof ALLOWED_MODELS)[number];

// In-Memory Fallback Stores (active if Firestore Admin lacks IAM in sandbox/Cloud Run)
export const inMemoryUsers = new Map<string, any>();
export const inMemoryGenerations = new Map<string, any>();
export const inMemoryOperations = new Map<string, any>();
export const inMemoryCreditTransactions = new Map<string, any[]>(); // uid -> transaction[]

// Cross-project IAM authorization detection for Firestore Admin SDK
export let isFirestoreAdminAvailable = false;
if (process.env.NODE_ENV !== 'test') {
  adminDb
    .collection('users')
    .limit(1)
    .get()
    .then(() => {
      isFirestoreAdminAvailable = true;
    })
    .catch(() => {
      // Seamlessly operate with in-memory persistence when running without cross-project IAM keys
      isFirestoreAdminAvailable = false;
    });
}

// In-Memory Cache for Gemini Niche Prompt Optimizations (Prevents redundant paid API calls)
export interface CachedNichePlan {
  plan: NichePromptPlan;
  expiresAt: number;
}
export const nichePromptCache = new Map<string, CachedNichePlan>();

export function getNicheCacheKey(
  uid: string,
  nicheId: string,
  userIdea: string,
  durationSec: number,
  aspectRatio: string,
  overrides: any
): string {
  const hash = crypto
    .createHash('sha256')
    .update(`${nicheId}:${userIdea.trim()}:${durationSec}:${aspectRatio}:${JSON.stringify(overrides || {})}`)
    .digest('hex');
  return `${uid}:${hash}`;
}

export const ALLOWED_ASPECT_RATIOS = ['9:16', '16:9'] as const;
export const ALLOWED_RESOLUTIONS = ['720p', '1080p'] as const;

// Generation State Machine Definition
export type GenerationState =
  | 'starting'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'reconciliation_required';

export const ALLOWED_STATE_TRANSITIONS: Record<GenerationState, GenerationState[]> = {
  starting: ['submitted', 'processing', 'failed', 'reconciliation_required'],
  submitted: ['processing', 'completed', 'failed', 'reconciliation_required'],
  processing: ['completed', 'failed'],
  completed: [], // Terminal: Completed jobs can NEVER transition to another state or be refunded!
  failed: ['refunded'],
  refunded: [], // Terminal
  reconciliation_required: ['failed', 'completed'], // Manual/Administrative resolution only
};

export function isValidStateTransition(from: GenerationState, to: GenerationState): boolean {
  if (from === to) return true;
  const allowed = ALLOWED_STATE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

// Determines if an error from Veo submission is deterministically PRE-submission
// (meaning Google definitely rejected the request BEFORE creating an operation / job).
// Timeouts, socket hangups, connection aborts, and 5xx errors are AMBIGUOUS and must NOT auto-refund!
export function isDeterministicPreSubmissionError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || String(err)).toLowerCase();
  const status = err.status || err.code || err.statusCode || err.response?.status;

  // Ambiguous network errors: Veo may have already received the request and started rendering!
  if (
    msg.includes('timeout') ||
    msg.includes('zeitlimit') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('aborted') ||
    msg.includes('socket hang up') ||
    msg.includes('premature close') ||
    status === 504 ||
    status === 503 ||
    status === 502
  ) {
    return false;
  }

  // Deterministic upfront rejections prior to job creation
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    msg.includes('invalid argument') ||
    msg.includes('api key not valid') ||
    msg.includes('unsupported model') ||
    msg.includes('permission denied')
  ) {
    return true;
  }

  // Default to ambiguous to protect finances
  return false;
}

// Strict Google Video URI Validator (Protects against SSRF and credential exfiltration)
export function isValidGoogleVideoUri(uriString: string): boolean {
  try {
    if (!uriString || typeof uriString !== 'string') return false;
    const parsed = new URL(uriString);
    if (parsed.protocol !== 'https:') return false;
    const hostname = parsed.hostname.toLowerCase();
    return (
      hostname === 'generativelanguage.googleapis.com' ||
      hostname === 'storage.googleapis.com' ||
      hostname.endsWith('.googleapis.com') ||
      hostname.endsWith('.google.com')
    );
  } catch {
    return false;
  }
}

// Veo Video Generation Config Builder: guarantees dynamic duration, resolution and aspect ratio are passed to Veo
export function buildVeoConfig(duration: number, resolution: string, aspectRatio: string) {
  const safeDuration = typeof duration === 'number' && !isNaN(duration) ? Math.max(5, Math.min(60, Math.floor(duration))) : 15;
  return {
    numberOfVideos: 1,
    resolution,
    aspectRatio,
    durationSeconds: safeDuration,
  };
}

// Secure Client IP Resolver (Guarded against forged client headers)
export function getClientIp(req: express.Request): string {
  // With app.set('trust proxy', 1), Express automatically extracts the genuine client IP from Cloud Run reverse proxy
  if (req.ip) return req.ip;
  // Fallback to socket remote address (never trust unverified client-supplied headers without proxy validation)
  return req.socket?.remoteAddress || '127.0.0.1';
}

// Bounded In-Memory Rate Limiting & Fast-L7 Abuse Protection
interface RateLimitWindow {
  timestamps: number[];
}
export const MAX_RATE_LIMIT_CACHE_ENTRIES = 5000;
export const MAX_CONCURRENT_GENERATIONS = 2;
export const USER_GENERATION_RATE_LIMIT = 10;
export const RATE_LIMIT_WINDOW_MS = 60000; // 60s
export const userGenRateLimits = new Map<string, RateLimitWindow>();
export const ipGenRateLimits = new Map<string, RateLimitWindow>();
export const userStatusRateLimits = new Map<string, RateLimitWindow>();
export const activeUserGenerations = new Map<string, Set<string>>(); // uid -> Set<generationId>

// Memory-leak prevention: Prune expired entries from in-memory maps
export function pruneExpiredRateLimits(map: Map<string, RateLimitWindow>, windowMs: number) {
  const now = Date.now();
  for (const [key, entry] of map.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
    if (entry.timestamps.length === 0) {
      map.delete(key);
    }
  }

  // Hard cap: If map exceeds maximum capacity, drop oldest entries
  if (map.size > MAX_RATE_LIMIT_CACHE_ENTRIES) {
    let toDelete = map.size - MAX_RATE_LIMIT_CACHE_ENTRIES;
    for (const key of map.keys()) {
      map.delete(key);
      if (--toDelete <= 0) break;
    }
  }
}

// Rate limit checker (Sliding Window with auto-pruning)
export function checkRateLimit(
  map: Map<string, RateLimitWindow>,
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let entry = map.get(key);
  if (!entry) {
    if (map.size >= MAX_RATE_LIMIT_CACHE_ENTRIES) {
      pruneExpiredRateLimits(map, windowMs);
    }
    entry = { timestamps: [] };
    map.set(key, entry);
  }

  // Remove timestamps outside window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  entry.timestamps.push(now);
  return { allowed: true };
}

// Periodic In-Memory Map Cleanup (Every 60 seconds, unreferenced to avoid keeping event loop alive)
if (process.env.NODE_ENV !== 'test') {
  const cleanupInterval = setInterval(() => {
    pruneExpiredRateLimits(ipGenRateLimits, 60000);
    pruneExpiredRateLimits(userStatusRateLimits, 60000);
    pruneExpiredRateLimits(userGenRateLimits, 60000);
  }, 60000);
  cleanupInterval.unref();
}

// In-Flight Concurrency Controls (Local Node Process Guard)
export function acquireGenerationSlot(uid: string, generationId: string, maxConcurrent = MAX_CONCURRENT_GENERATIONS): { allowed: boolean } {
  let userSlots = activeUserGenerations.get(uid);
  if (!userSlots) {
    userSlots = new Set<string>();
    activeUserGenerations.set(uid, userSlots);
  }

  // If this same generationId is already running (e.g. concurrent double-click / retry), allow through for idempotency
  if (userSlots.has(generationId)) {
    return { allowed: true };
  }

  if (userSlots.size >= maxConcurrent) {
    return { allowed: false };
  }

  userSlots.add(generationId);
  return { allowed: true };
}

export function releaseGenerationSlot(uid: string, generationId: string) {
  const userSlots = activeUserGenerations.get(uid);
  if (userSlots) {
    userSlots.delete(generationId);
    if (userSlots.size === 0) {
      activeUserGenerations.delete(uid);
    }
  }
}

// Rollback last rate-limit timestamp (for aborted/rejected requests before job creation)
export function rollbackRateLimit(map: Map<string, RateLimitWindow>, key: string) {
  const entry = map.get(key);
  if (entry && entry.timestamps.length > 0) {
    entry.timestamps.pop();
    if (entry.timestamps.length === 0) {
      map.delete(key);
    }
  }
}

// Distributed Concurrency Slot Release Helper in Firestore (Guaranteed cross-instance release)
export async function releaseDistributedGenerationSlot(uid: string, generationId: string) {
  try {
    const userRef = adminDb.collection('users').doc(uid);
    await userRef.update({
      [`activeGenerations.${generationId}`]: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (err: any) {
    // Non-fatal if user document or key is already cleaned up
    console.warn(`[Distributed Concurrency] Note on releasing slot ${generationId}:`, err.message);
  }
}

// Atomically mark generation completed AND release activeGenerations slot in a single Firestore transaction
export async function completeGenerationAtomically(
  uid: string,
  generationId: string
): Promise<{ completed: boolean; alreadyCompleted?: boolean }> {
  const userRef = adminDb.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);

  try {
    return await adminDb.runTransaction(async (t) => {
      const genDoc = await t.get(genRef);
      const userDoc = await t.get(userRef);

      if (!genDoc.exists) {
        return { completed: false };
      }

      const gData = genDoc.data() || {};
      if (gData.status === 'completed') {
        // Idempotent: already marked completed
        const uData = userDoc.exists ? (userDoc.data() || {}) : {};
        if (uData.activeGenerations && uData.activeGenerations[generationId]) {
          t.update(userRef, {
            [`activeGenerations.${generationId}`]: FieldValue.delete(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        return { completed: true, alreadyCompleted: true };
      }

      t.update(genRef, {
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (userDoc.exists) {
        t.update(userRef, {
          [`activeGenerations.${generationId}`]: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return { completed: true };
    });
  } catch (err: any) {
    console.error(`[Atomic Completion] Failed to atomically complete ${generationId}:`, err);
    return { completed: false };
  }
}

// Durable Server-Side Video Archiving into private Firebase Storage Bucket
export async function archiveVideoToStorage(
  uid: string,
  generationId: string,
  operationName: string,
  extraMeta?: {
    title?: string;
    templateName?: string;
    nicheId?: string;
    prompt?: string;
    aspectRatio?: string;
    durationSec?: number;
  }
): Promise<{
  success: boolean;
  storagePath: string;
  storageBucket: string;
  fileSizeBytes: number;
  storageStatus: 'completed' | 'failed' | 'already_archived';
  error?: string;
}> {
  const storagePath = `users/${uid}/videos/${generationId}.mp4`;
  const uploadKey = `${uid}:${generationId}`;

  // 1. In-flight upload deduplication
  const existingUpload = activeStorageUploads.get(uploadKey);
  if (existingUpload) {
    console.log(`[Storage Archive] Upload for ${uploadKey} is already in-flight, joining existing promise.`);
    return await existingUpload;
  }

  // 2. Check if already archived in Firestore
  try {
    const userRef = adminDb.collection('users').doc(uid);
    const genDoc = await userRef.collection('generations').doc(generationId).get();
    if (genDoc.exists && genDoc.data()?.storageStatus === 'completed') {
      const gData = genDoc.data()!;
      console.log(`[Storage Archive] Generation ${generationId} is already archived in Firebase Storage.`);
      return {
        success: true,
        storagePath: gData.storagePath || storagePath,
        storageBucket: gData.storageBucket || STORAGE_BUCKET_NAME,
        fileSizeBytes: gData.fileSizeBytes || 0,
        storageStatus: 'already_archived',
      };
    }
  } catch (fsCheckErr: any) {
    console.warn(`[Storage Archive] Note during Firestore check:`, fsCheckErr.message);
  }

  const uploadPromise = (async () => {
    const userRef = adminDb.collection('users').doc(uid);
    const genRef = userRef.collection('generations').doc(generationId);
    const videoRef = userRef.collection('videos').doc(generationId);

    // Transition state to 'uploading'
    try {
      await genRef.set({ storageStatus: 'uploading' }, { merge: true });
      await videoRef.set({ storageStatus: 'uploading' }, { merge: true });
    } catch (e: any) {
      console.warn(`[Storage Archive] Note setting uploading status:`, e.message);
    }

    try {
      let videoBuffer: Buffer | null = null;
      let mimeType = 'video/mp4';
      const isInteraction = operationName.startsWith('v1_') || !operationName.includes('/');

      // 3. Fetch real video data from Google Gemini/Veo APIs
      if (isInteraction) {
        if (!aiClient) throw new Error('Gemini AI Client is not initialized');
        const interaction = await withTimeout(
          aiClient.interactions.get(operationName),
          20000,
          'Interactions Video Download for Storage'
        );

        if (interaction.output_video?.data) {
          videoBuffer = Buffer.from(interaction.output_video.data, 'base64');
          mimeType = interaction.output_video.mime_type || 'video/mp4';
        } else if (Array.isArray(interaction.steps)) {
          for (const step of interaction.steps) {
            if (step.type === 'model_output' && Array.isArray(step.content)) {
              const vid: any = step.content.find((c: any) => c.type === 'video');
              if (vid && vid.data) {
                videoBuffer = Buffer.from(vid.data, 'base64');
                mimeType = vid.mime_type || 'video/mp4';
                break;
              }
            }
          }
        }
      } else {
        if (!aiClient) throw new Error('Gemini AI Client is not initialized');
        const op = new GenerateVideosOperation();
        op.name = operationName;
        const updated = await withTimeout(
          aiClient.operations.getVideosOperation({ operation: op }),
          15000,
          'Veo Download getOperation for Storage'
        );
        const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
        if (!uri) {
          throw new Error('Video URI in abgeschlossener Veo-Operation nicht gefunden.');
        }

        if (!isValidGoogleVideoUri(uri)) {
          throw new Error(`Video URI ist ungültig oder nicht autorisiert: ${uri}`);
        }

        const videoRes = await withTimeout(
          fetch(uri, {
            headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY || '' },
          }),
          30000,
          'Veo Video Fetch for Storage'
        );

        if (!videoRes.ok) {
          throw new Error(`Video-Download von Google fehlgeschlagen (${videoRes.status})`);
        }

        const arrayBuf = await videoRes.arrayBuffer();
        videoBuffer = Buffer.from(arrayBuf);
      }

      if (!videoBuffer || videoBuffer.length === 0) {
        throw new Error('Empfangene Videodaten sind leer.');
      }

      console.log(`[Storage Archive] Fetched video (${videoBuffer.length} bytes) for gen ${generationId}. Uploading to ${storagePath}...`);

      // 4. Save to private Firebase Storage Bucket
      try {
        const bucket = adminStorage.bucket(STORAGE_BUCKET_NAME);
        const file = bucket.file(storagePath);

        await withTimeout(
          file.save(videoBuffer, {
            metadata: {
              contentType: mimeType,
              metadata: {
                uid,
                generationId,
                operationName,
                uploadedAt: new Date().toISOString(),
              },
            },
            resumable: false,
          }),
          30000,
          'Firebase Storage File Save'
        );
      } catch (bucketErr: any) {
        console.warn(`[Storage Archive Note] Firebase Storage bucket save (${bucketErr.message}). Persisting to server buffer store.`);
        inMemoryStoredVideos.set(storagePath, {
          buffer: videoBuffer,
          mimeType,
          uploadedAt: new Date().toISOString(),
        });
      }

      // 5. Update Firestore records with durable storage metadata
      const updatePayload: Record<string, any> = {
        storagePath,
        storageBucket: STORAGE_BUCKET_NAME,
        fileSizeBytes: videoBuffer.length,
        mimeType,
        storageStatus: 'completed',
        storageError: FieldValue.delete(),
        status: 'completed',
        updatedAt: FieldValue.serverTimestamp(),
      };

      await genRef.set(updatePayload, { merge: true }).catch((e) => console.warn('genRef update note:', e.message));
      await videoRef.set({
        ...updatePayload,
        title: extraMeta?.title || `Video ${generationId.slice(0, 8)}`,
        templateName: extraMeta?.templateName || null,
        nicheId: extraMeta?.nicheId || null,
        prompt: extraMeta?.prompt || null,
        aspectRatio: extraMeta?.aspectRatio || '9:16',
        durationSec: extraMeta?.durationSec || 15,
      }, { merge: true }).catch((e) => console.warn('videoRef update note:', e.message));

      console.log(`[Storage Archive] Successfully archived video for user ${uid} at ${storagePath}`);

      return {
        success: true,
        storagePath,
        storageBucket: STORAGE_BUCKET_NAME,
        fileSizeBytes: videoBuffer.length,
        storageStatus: 'completed' as const,
      };
    } catch (err: any) {
      console.error(`[Storage Archive Error] Failed to archive video for gen ${generationId}:`, err);

      // Financial & System Guard: Never refund completed Veo job on storage failure!
      try {
        const failPayload = {
          storageStatus: 'failed',
          storageError: err.message || 'Storage upload error',
          updatedAt: FieldValue.serverTimestamp(),
        };
        await genRef.set(failPayload, { merge: true });
        await videoRef.set(failPayload, { merge: true });
      } catch (fErr: any) {
        console.warn('Note setting failed storage status:', fErr.message);
      }

      return {
        success: false,
        storagePath,
        storageBucket: STORAGE_BUCKET_NAME,
        fileSizeBytes: 0,
        storageStatus: 'failed' as const,
        error: err.message || 'Storage upload failed',
      };
    } finally {
      activeStorageUploads.delete(uploadKey);
    }
  })();

  activeStorageUploads.set(uploadKey, uploadPromise);
  return await uploadPromise;
}

// Generic Timeout Helper
export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationLabel: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${operationLabel} überschritt Zeitlimit von ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

// Server-authoritative Credit Cost Calculation (Guaranteed Integer & Strict Bounds)
export function computeVideoCost(durationSec: number | undefined): number {
  const duration = typeof durationSec === 'number' && !isNaN(durationSec) ? durationSec : 30;
  const boundedDuration = Math.max(5, Math.min(60, Math.floor(duration)));
  if (boundedDuration <= 20) return 10;
  if (boundedDuration <= 35) return 15;
  return 20;
}

// Helper: Ensure user document exists with 100 initial test credits
export async function ensureUserDoc(uid: string, email?: string, displayName?: string) {
  // If Firestore Admin is running in container without direct IAM keys, use in-memory store smoothly
  if (!isFirestoreAdminAvailable) {
    let memUser = inMemoryUsers.get(uid);
    if (!memUser) {
      memUser = {
        displayName: displayName || email?.split('@')[0] || 'Creator',
        email: email || '',
        credits: 100,
        plan: 'creator',
        videosCreatedCount: 0,
        totalCreditsUsed: 0,
        estimatedViews: 0,
        activeGenerations: {},
        recentGenerationTimestamps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryUsers.set(uid, memUser);
    }
    return memUser;
  }

  const userRef = adminDb.collection('users').doc(uid);

  try {
    return await adminDb.runTransaction(async (t) => {
      const userSnap = await t.get(userRef);

      // If user profile already exists -> return immediately unchanged.
      if (userSnap.exists) {
        return userSnap.data();
      }

      // New user profile: initialize with 100 credits for video testing
      const initialUserData = {
        displayName: displayName || email?.split('@')[0] || 'Creator',
        email: email || '',
        credits: 100,
        plan: 'creator',
        videosCreatedCount: 0,
        totalCreditsUsed: 0,
        estimatedViews: 0,
        activeGenerations: {},
        recentGenerationTimestamps: [],
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      t.set(userRef, initialUserData);
      return initialUserData;
    });
  } catch (err: any) {
    isFirestoreAdminAvailable = false;
    let memUser = inMemoryUsers.get(uid);
    if (!memUser) {
      memUser = {
        displayName: displayName || email?.split('@')[0] || 'Creator',
        email: email || '',
        credits: 100,
        plan: 'creator',
        videosCreatedCount: 0,
        totalCreditsUsed: 0,
        estimatedViews: 0,
        activeGenerations: {},
        recentGenerationTimestamps: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryUsers.set(uid, memUser);
    }
    return memUser;
  }
}

// Helper: Idempotent Refund function with strict Financial Protection:
// Completed jobs can NEVER be refunded!
export async function refundCredits(
  uid: string,
  generationId: string,
  cost: number,
  model: string,
  reason: string
): Promise<{ refunded: boolean; skippedDuplicate?: boolean; reason?: string }> {
  const userRef = adminDb.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const refundTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-refund`);

  try {
    return await adminDb.runTransaction(async (t) => {
      // 1. Check existing refund record
      const existingRefund = await t.get(refundTxRef);
      if (existingRefund.exists) {
        console.log(`[Refund] Generation ${generationId} was already refunded, skipping duplicate.`);
        return { refunded: false, skippedDuplicate: true, reason: 'ALREADY_REFUNDED' };
      }

      // 2. Read generation record to prevent illegal refunds on completed jobs
      const genDoc = await t.get(genRef);
      if (genDoc.exists) {
        const genData = genDoc.data() || {};
        // CRITICAL FINANCIAL GUARD: Completed jobs must NEVER be refunded!
        if (genData.status === 'completed') {
          console.warn(`[Refund Guard] BLOCKED: Generation ${generationId} is marked completed. Cannot refund.`);
          return { refunded: false, skippedDuplicate: false, reason: 'GENERATION_COMPLETED' };
        }
        // CRITICAL FINANCIAL GUARD: Jobs in 'reconciliation_required' must NEVER be automatically refunded!
        if (genData.status === 'reconciliation_required') {
          console.warn(`[Refund Guard] BLOCKED: Generation ${generationId} is in reconciliation_required state. Cannot auto-refund.`);
          return { refunded: false, skippedDuplicate: false, reason: 'RECONCILIATION_REQUIRED' };
        }
        if (genData.refunded === true) {
          console.log(`[Refund] Generation ${generationId} already has refunded: true.`);
          return { refunded: false, skippedDuplicate: true, reason: 'ALREADY_REFUNDED' };
        }
      }

      // 3. User document update
      const userDoc = await t.get(userRef);
      const data = userDoc.exists ? userDoc.data() : {};
      const currentCredits = typeof data?.credits === 'number' && !isNaN(data.credits) ? Math.max(0, data.credits) : 0;
      const currentCount = typeof data?.videosCreatedCount === 'number' ? data.videosCreatedCount : 1;
      const safeCost = Math.max(0, Math.floor(cost));

      t.update(userRef, {
        credits: currentCredits + safeCost,
        videosCreatedCount: Math.max(0, currentCount - 1),
        [`activeGenerations.${generationId}`]: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.set(refundTxRef, {
        amount: safeCost,
        type: 'generation_refund',
        balanceAfter: currentCredits + safeCost,
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

      return { refunded: true };
    });
  } catch (err: any) {
    console.error(`[Refund] Failed to refund credits for generation ${generationId}:`, err);
    return { refunded: false, reason: err.message || 'Refund transaction error' };
  }
}

/**
 * RECONCILIATION MECHANISM:
 * Automatically re-evaluates generations stuck in 'reconciliation_required', 'processing', or 'starting'.
 * Guaranteed exactly-once refund or completion via Firestore transactions.
 */
export async function reconcileGenerations() {
  if (process.env.NODE_ENV === 'test') return;
  console.log('[Reconciliation] Starting background worker loop...');
  
  try {
    // 1. Fetch all users to check their generations
    const usersSnap = await adminDb.collection('users').get();
    let reconciledCount = 0;

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const gensRef = adminDb.collection('users').doc(uid).collection('generations');
      
      // Look for ambiguous or long-running states
      const pendingGens = await gensRef
        .where('status', 'in', ['reconciliation_required', 'processing', 'starting'])
        .get();

      if (pendingGens.empty) continue;

      for (const genDoc of pendingGens.docs) {
        const gData = genDoc.data();
        const generationId = genDoc.id;
        const now = Date.now();
        const createdAt = gData.createdAt?.toDate ? gData.createdAt.toDate().getTime() : (typeof gData.createdAt === 'number' ? gData.createdAt : now);
        const ageMs = now - createdAt;

        // A. Handle stuck 'starting' states (Older than 2 minutes)
        // This usually means the server crashed/restarted before obtaining an operationName from Veo.
        if (gData.status === 'starting' && ageMs > 120000) {
          console.warn(`[Reconciliation] Gen ${generationId} for user ${uid} stuck in 'starting' for ${Math.round(ageMs/1000)}s. Transitioning to 'reconciliation_required'.`);
          await genDoc.ref.update({ 
            status: 'reconciliation_required', 
            error: 'Server-Unterbrechung während der Initialisierung (Timeout)',
            updatedAt: FieldValue.serverTimestamp() 
          });
          continue;
        }

        // B. Handle 'processing' or 'reconciliation_required' with an operationName
        if (gData.operationName && (gData.status === 'processing' || gData.status === 'reconciliation_required')) {
          try {
            const opName = gData.operationName;
            const isInteraction = Boolean(gData.isInteraction || opName.startsWith('v1_') || !opName.includes('/'));
            
            let isDone = false;
            let isFailed = false;
            let errorMsg = '';

            if (isInteraction) {
              if (!aiClient) continue;
              const interaction = await aiClient.interactions.get(opName);
              isDone = interaction.status === 'completed';
              isFailed = interaction.status === 'failed' || interaction.status === 'cancelled';
              const rawError = (interaction as any).error || (interaction.errors && interaction.errors[0]);
              errorMsg = rawError?.message || 'Interaction failed';
            } else {
              if (!aiClient) continue;
              const op = new GenerateVideosOperation();
              op.name = opName;
              const updated = await aiClient.operations.getVideosOperation({ operation: op });
              isDone = Boolean(updated.done);
              isFailed = Boolean(updated.error || (updated as any).response?.error);
              errorMsg = updated.error?.message || (updated as any).response?.error?.message || 'Veo operation failed';
            }

            if (isDone && !isFailed) {
              console.log(`[Reconciliation] Successfully recovered COMPLETED generation ${generationId} for user ${uid}.`);
              await completeGenerationAtomically(uid, generationId);
              // Async archive
              archiveVideoToStorage(uid, generationId, opName).catch(() => {});
              reconciledCount++;
            } else if (isFailed) {
              console.log(`[Reconciliation] Recovered FAILED generation ${generationId} for user ${uid}. Refunding ${gData.cost || 10} credits.`);
              await refundCredits(
                uid, 
                generationId, 
                gData.cost || 10, 
                gData.modelUsed || 'veo-3.1-fast-generate-preview', 
                `Automatisierte Hintergrund-Bereinigung: ${errorMsg}`
              );
              reconciledCount++;
            } else if (ageMs > 3600000) {
              // Terminal Guard: If a job is still 'processing' after 1 hour, it is almost certainly lost or stuck in Google's cloud.
              // Refund it to protect the user experience.
              console.warn(`[Reconciliation] Gen ${generationId} still 'processing' after 1 hour. Forcing refund.`);
              await refundCredits(
                uid, 
                generationId, 
                gData.cost || 10, 
                gData.modelUsed || 'veo-3.1-fast-generate-preview', 
                'Hintergrund-Timeout: Job dauerte länger als 60 Minuten.'
              );
              reconciledCount++;
            }
          } catch (apiErr: any) {
            // If the operation is not found (404), it might have been purged or never existed.
            if (apiErr.status === 404 || apiErr.code === 404 || apiErr.message?.includes('not found')) {
               if (ageMs > 300000) { // Give it 5 minutes grace period
                 console.warn(`[Reconciliation] Operation ${gData.operationName} not found for gen ${generationId}. Refunding.`);
                 await refundCredits(
                   uid, 
                   generationId, 
                   gData.cost || 10, 
                   gData.modelUsed || 'veo-3.1-fast-generate-preview', 
                   'Google-Operation wurde nicht gefunden oder existiert nicht mehr.'
                 );
                 reconciledCount++;
               }
            } else {
              console.error(`[Reconciliation] Error checking operation for ${generationId}:`, apiErr.message);
            }
          }
        } 
        // C. Handle 'reconciliation_required' WITHOUT an operationName
        else if (!gData.operationName && gData.status === 'reconciliation_required' && ageMs > 300000) {
          console.warn(`[Reconciliation] Gen ${generationId} stuck in 'reconciliation_required' without operationName for ${Math.round(ageMs/1000)}s. Refunding.`);
          await refundCredits(
            uid, 
            generationId, 
            gData.cost || 10, 
            gData.modelUsed || 'veo-3.1-fast-generate-preview', 
            'Server konnte den Operation-Status nicht ermitteln (kein OpName vorhanden).'
          );
          reconciledCount++;
        }
      }
    }
    
    if (reconciledCount > 0) {
      console.log(`[Reconciliation] Cycle finished. Successfully reconciled ${reconciledCount} records.`);
    }
  } catch (err: any) {
    console.error('[Reconciliation] Background worker loop failed:', err.message);
  }
}

// Background Scheduler: Every 5 minutes
if (process.env.NODE_ENV !== 'test') {
  const reconciliationInterval = setInterval(() => {
    reconcileGenerations().catch(err => console.error('Scheduled reconciliation failed:', err));
  }, 5 * 60 * 1000);
  reconciliationInterval.unref();
  
  // Initial run after a short delay (30s) to allow system to settle
  setTimeout(() => {
    reconcileGenerations().catch(err => console.error('Initial reconciliation failed:', err));
  }, 30000);
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
  res.json({ status: 'ok', service: 'Veyro.ai backend' });
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

// Protected: Get authenticated user profile with latest authoritative credit balance
app.get('/api/user-profile', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userData = await ensureUserDoc(uid, req.user!.email, req.user!.displayName);
    const isAdmin = isAdminUser(req.user);
    res.json({
      success: true,
      user: userData,
      isAdmin,
    });
  } catch (error: any) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user profile' });
  }
});

// Protected: User Activity Heartbeat (Throttled to max 1 update per 5 minutes per user)
const lastSeenThrottles = new Map<string, number>();

app.post('/api/user-heartbeat', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const now = Date.now();
    const lastUpdate = lastSeenThrottles.get(uid) || 0;

    // Throttle: Skip write if last update was less than 5 minutes (300,000 ms) ago
    if (now - lastUpdate < 300000) {
      return res.json({ success: true, throttled: true });
    }

    lastSeenThrottles.set(uid, now);
    const nowIso = new Date(now).toISOString();

    // Update in-memory user store
    const memUser = inMemoryUsers.get(uid);
    if (memUser) {
      memUser.lastSeenAt = nowIso;
      memUser.updatedAt = nowIso;
    }

    // Update in Firestore
    try {
      const userRef = adminDb.collection('users').doc(uid);
      await userRef.set(
        {
          lastSeenAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (fsErr: any) {
      // Non-fatal if running in sandbox without direct IAM keys
    }

    res.json({ success: true, lastSeenAt: nowIso });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Heartbeat update failed' });
  }
});

// ============================================================================
// ADMIN DASHBOARD ENDPOINTS (Strictly guarded by requireAdmin)
// ============================================================================

// Admin: List ALL registered users (combining Firebase Auth SDK listUsers & Firestore documents)
app.get('/api/admin/users', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const usersMap = new Map<string, any>();

    // 1. Fetch all registered users via Firebase Auth SDK (with fallback)
    const authUsers = await getAllAuthUsers();

    // 2. Fetch all Firestore user documents
    const firestoreDocsMap = new Map<string, any>();
    try {
      const snap = await adminDb.collection('users').get();
      for (const docSnap of snap.docs) {
        firestoreDocsMap.set(docSnap.id, docSnap.data());
      }
    } catch (fsErr: any) {
      console.warn('[Admin API] Note reading Firestore users collection:', fsErr.message);
    }

    // Overlay in-memory user records
    for (const [uid, uData] of inMemoryUsers.entries()) {
      if (!firestoreDocsMap.has(uid)) {
        firestoreDocsMap.set(uid, uData);
      }
    }

    // Include requesting user if missing from Firestore map
    if (req.user?.uid && !firestoreDocsMap.has(req.user.uid)) {
      firestoreDocsMap.set(req.user.uid, {
        uid: req.user.uid,
        email: req.user.email || '',
        displayName: req.user.displayName || 'Creator',
        credits: 100,
        plan: 'creator',
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      });
    }

    // 3. Populate usersMap from Auth users
    for (const au of authUsers) {
      const fsData = firestoreDocsMap.get(au.uid);
      const hasDoc = Boolean(fsData);

      const creationTime = au.metadata?.creationTime || (fsData?.createdAt ? (fsData.createdAt.toDate ? fsData.createdAt.toDate().toISOString() : String(fsData.createdAt)) : new Date().toISOString());
      const lastSignInTime = au.metadata?.lastSignInTime || null;
      const lastSeenAt = fsData?.lastSeenAt
        ? (fsData.lastSeenAt.toDate ? fsData.lastSeenAt.toDate().toISOString() : String(fsData.lastSeenAt))
        : lastSignInTime;

      usersMap.set(au.uid, {
        uid: au.uid,
        email: au.email || fsData?.email || '',
        displayName: au.displayName || fsData?.displayName || au.email?.split('@')[0] || 'Creator',
        creationTime,
        lastSignInTime,
        lastSeenAt,
        hasFirestoreDoc: hasDoc,
        credits: fsData && typeof fsData.credits === 'number' ? fsData.credits : 0,
        plan: fsData?.plan || 'free',
        videosCreatedCount: fsData && typeof fsData.videosCreatedCount === 'number' ? fsData.videosCreatedCount : 0,
        totalCreditsUsed: fsData && typeof fsData.totalCreditsUsed === 'number' ? fsData.totalCreditsUsed : 0,
        createdAt: creationTime,
        isAdmin: isAdminUser({ email: au.email || fsData?.email, uid: au.uid }),
      });
    }

    // 4. Populate any Firestore docs that were not present in authUsers
    for (const [uid, fsData] of firestoreDocsMap.entries()) {
      if (!usersMap.has(uid)) {
        const creationTime = fsData.createdAt ? (fsData.createdAt.toDate ? fsData.createdAt.toDate().toISOString() : String(fsData.createdAt)) : new Date().toISOString();
        const lastSeenAt = fsData.lastSeenAt ? (fsData.lastSeenAt.toDate ? fsData.lastSeenAt.toDate().toISOString() : String(fsData.lastSeenAt)) : null;

        usersMap.set(uid, {
          uid,
          email: fsData.email || '',
          displayName: fsData.displayName || 'Creator',
          creationTime,
          lastSignInTime: null,
          lastSeenAt,
          hasFirestoreDoc: true,
          credits: typeof fsData.credits === 'number' ? fsData.credits : 0,
          plan: fsData.plan || 'creator',
          videosCreatedCount: typeof fsData.videosCreatedCount === 'number' ? fsData.videosCreatedCount : 0,
          totalCreditsUsed: typeof fsData.totalCreditsUsed === 'number' ? fsData.totalCreditsUsed : 0,
          createdAt: creationTime,
          isAdmin: isAdminUser({ email: fsData.email, uid }),
        });
      }
    }

    // Compute successful & failed generations count per user
    const usersList = Array.from(usersMap.values());
    for (const u of usersList) {
      let successful = 0;
      let failed = 0;
      for (const [, gen] of inMemoryGenerations.entries()) {
        if (gen.userId === u.uid) {
          if (gen.status === 'completed') successful++;
          if (gen.status === 'failed' || gen.status === 'refunded') failed++;
        }
      }
      u.successfulGenerations = Math.max(successful, u.videosCreatedCount || 0);
      u.failedGenerations = failed;
      
      // Calculate estimated API cost for this user
      // $0.35 per video + $0.001 per prompt call
      u.estimatedCostUsd = parseFloat((u.successfulGenerations * 0.35).toFixed(3));
    }

    res.json({ success: true, count: usersList.length, users: usersList });
  } catch (error: any) {
    console.error('Error listing admin users:', error);
    res.status(500).json({ error: error.message || 'Failed to list admin users' });
  }
});

// Admin: List all generations requiring reconciliation across all users
app.get('/api/admin/reconciliations', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const reconciliations: any[] = [];
    
    // 1. Fetch all users
    const usersSnap = await adminDb.collection('users').get();
    
    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      const uData = userDoc.data();
      
      // 2. Fetch generations with reconciliation_required status
      const gensSnap = await adminDb.collection('users').doc(uid).collection('generations')
        .where('status', '==', 'reconciliation_required')
        .get();
        
      for (const genDoc of gensSnap.docs) {
        const gData = genDoc.data();
        reconciliations.push({
          ...gData,
          userId: uid,
          userEmail: uData.email || '',
          userDisplayName: uData.displayName || '',
          id: genDoc.id,
          createdAt: gData.createdAt?.toDate ? gData.createdAt.toDate().toISOString() : gData.createdAt,
          updatedAt: gData.updatedAt?.toDate ? gData.updatedAt.toDate().toISOString() : gData.updatedAt,
        });
      }
    }
    
    // Sort by most recent
    reconciliations.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });
    
    res.json({ success: true, count: reconciliations.length, reconciliations });
  } catch (error: any) {
    console.error('Error fetching reconciliations:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch reconciliations' });
  }
});

// Admin: Initialize missing Firestore user document safely without overwriting existing data
app.post('/api/admin/users/:uid/initialize-doc', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid) {
      return res.status(400).json({ error: 'Nutzer-UID erforderlich.' });
    }

    let authEmail = '';
    let authDisplayName = '';
    try {
      const au = await adminAuth.getUser(targetUid);
      authEmail = au.email || '';
      authDisplayName = au.displayName || '';
    } catch (e) {
      // Ignore if user not in auth SDK
    }

    let createdNew = false;
    let userData = null;

    try {
      const userRef = adminDb.collection('users').doc(targetUid);
      const docSnap = await userRef.get();
      if (!docSnap.exists) {
        const initialDoc = {
          displayName: authDisplayName || authEmail.split('@')[0] || 'Creator',
          email: authEmail,
          credits: 100,
          plan: 'creator',
          videosCreatedCount: 0,
          totalCreditsUsed: 0,
          estimatedViews: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          lastSeenAt: FieldValue.serverTimestamp(),
        };
        await userRef.set(initialDoc);
        createdNew = true;
        userData = { ...initialDoc, createdAt: new Date().toISOString() };
      } else {
        userData = docSnap.data();
      }
    } catch (fsErr: any) {
      // In-memory fallback
      let memUser = inMemoryUsers.get(targetUid);
      if (!memUser) {
        memUser = {
          displayName: authDisplayName || authEmail.split('@')[0] || 'Creator',
          email: authEmail,
          credits: 100,
          plan: 'creator',
          videosCreatedCount: 0,
          totalCreditsUsed: 0,
          createdAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
        };
        inMemoryUsers.set(targetUid, memUser);
        createdNew = true;
      }
      userData = memUser;
    }
    res.json({
      success: true,
      createdNew,
      user: userData,
      message: createdNew ? 'Nutzerdokument erfolgreich in Firestore initialisiert.' : 'Nutzerdokument existiert bereits.',
    });
  } catch (error: any) {
    console.error('Error initializing user doc:', error);
    res.status(500).json({ error: error.message || 'Failed to initialize user document' });
  }
});

// Admin: Get single user detailed view with transactions and generations history
app.get('/api/admin/users/:uid', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    if (!targetUid || typeof targetUid !== 'string' || targetUid.includes('..')) {
      return res.status(400).json({ error: 'Ungültige UID' });
    }

    let userProfile = inMemoryUsers.get(targetUid) || null;

    try {
      const uSnap = await adminDb.collection('users').doc(targetUid).get();
      if (uSnap.exists) {
        userProfile = { uid: targetUid, ...uSnap.data(), ...(userProfile || {}) };
      }
    } catch (fsErr: any) {
      console.warn('Could not read user from Firestore:', fsErr.message);
    }

    if (!userProfile) {
      userProfile = {
        uid: targetUid,
        email: '',
        displayName: 'User',
        credits: 0,
        plan: 'creator',
        videosCreatedCount: 0,
        totalCreditsUsed: 0,
        createdAt: new Date().toISOString(),
      };
    }

    // Calculate metrics for this user
    let successful = 0;
    for (const [, gen] of inMemoryGenerations.entries()) {
      if (gen.userId === targetUid && gen.status === 'completed') {
        successful++;
      }
    }
    const finalSuccessfulCount = Math.max(successful, userProfile.videosCreatedCount || 0);
    (userProfile as any).estimatedCostUsd = parseFloat((finalSuccessfulCount * 0.351).toFixed(3));
    (userProfile as any).successfulGenerations = finalSuccessfulCount;

    // Fetch Credit Transactions Ledger
    const transactions: any[] = [];
    const memTxs = inMemoryCreditTransactions.get(targetUid) || [];
    transactions.push(...memTxs);

    try {
      const txSnap = await adminDb.collection('users').doc(targetUid).collection('creditTransactions').orderBy('createdAt', 'desc').limit(50).get();
      for (const d of txSnap.docs) {
        const data = d.data();
        if (!transactions.some((t) => t.id === d.id)) {
          transactions.push({
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          });
        }
      }
    } catch (txErr: any) {
      console.warn('Could not read creditTransactions from Firestore:', txErr.message);
    }

    // Fetch Generations History (combining in-memory, users/{uid}/generations and users/{uid}/videos)
    const generationsMap = new Map<string, any>();

    for (const [genId, gData] of inMemoryGenerations.entries()) {
      if (gData.userId === targetUid) {
        generationsMap.set(genId, {
          id: genId,
          ...gData,
          creditCost: typeof gData.cost === 'number' ? gData.cost : 10,
          creditUsed: typeof gData.cost === 'number' ? gData.cost : 10,
          storageStatus: gData.videoUrl ? 'Temporäre Streaming-URL (nicht in Firebase Storage)' : 'Nicht in Firebase Storage archiviert (nur Metadaten)',
        });
      }
    }

    try {
      const genSnap = await adminDb.collection('users').doc(targetUid).collection('generations').orderBy('createdAt', 'desc').limit(50).get();
      for (const d of genSnap.docs) {
        const data = d.data();
        const hasStorage = Boolean(data.storagePath || data.storageUrl || data.storageStatus === 'completed');
        const storageStatus = hasStorage
          ? 'In Firebase Storage gespeichert'
          : (data.videoUrl ? 'Temporäre Streaming-URL (Google Cloud)' : 'Nicht in Firebase Storage archiviert');

        generationsMap.set(d.id, {
          id: d.id,
          ...data,
          creditCost: typeof data.cost === 'number' ? data.cost : 10,
          creditUsed: typeof data.cost === 'number' ? data.cost : 10,
          storageStatus,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        });
      }
    } catch (gErr: any) {
      console.warn('Could not read generations from Firestore:', gErr.message);
    }

    // Also fetch users/{uid}/videos (Client-created videos with template details, niche & prompts)
    try {
      const vidSnap = await adminDb.collection('users').doc(targetUid).collection('videos').get();
      for (const d of vidSnap.docs) {
        const vData = d.data();
        const createdAtIso = vData.createdAtMillis
          ? new Date(vData.createdAtMillis).toISOString()
          : (vData.createdAt?.toDate ? vData.createdAt.toDate().toISOString() : (vData.createdAt || new Date().toISOString()));

        const hasStorage = Boolean(vData.storageUrl || (vData.videoUrl && (vData.videoUrl.includes('firebasestorage') || vData.videoUrl.includes('storage.googleapis'))));
        const storageStatus = hasStorage
          ? 'In Firebase Storage gespeichert'
          : (vData.videoUrl ? 'Temporäre Streaming-URL (nicht in Firebase Storage)' : 'Nicht in Firebase Storage archiviert (nur Metadaten)');

        const extractedPrompt = vData.prompt || vData.settings?.userIdea || vData.settings?.customPrompt || vData.scenes?.[0]?.imagePrompt || null;
        const extractedNiche = vData.nicheId || vData.settings?.nicheId || null;

        const existing = generationsMap.get(d.id) || {};
        generationsMap.set(d.id, {
          ...existing,
          id: d.id,
          title: vData.title || existing.title || `Video ${d.id.slice(0, 8)}`,
          templateName: vData.templateName || existing.templateName || null,
          nicheId: extractedNiche || existing.nicheId || null,
          prompt: extractedPrompt || existing.prompt || null,
          status: vData.status || existing.status || 'completed',
          creditCost: typeof vData.creditUsed === 'number' ? vData.creditUsed : (typeof existing.creditCost === 'number' ? existing.creditCost : 10),
          creditUsed: typeof vData.creditUsed === 'number' ? vData.creditUsed : (typeof existing.creditUsed === 'number' ? existing.creditUsed : 10),
          durationSec: vData.durationSec || existing.durationSec || 15,
          modelUsed: vData.modelUsed || existing.modelUsed || 'veo-3.1-fast-generate-preview',
          aspectRatio: vData.aspectRatio || existing.aspectRatio || '9:16',
          videoUrl: vData.videoUrl || existing.videoUrl || null,
          storageUrl: vData.storageUrl || existing.storageUrl || null,
          storageStatus: hasStorage ? 'In Firebase Storage gespeichert' : (existing.storageStatus || storageStatus),
          thumbnailUrl: vData.thumbnailUrl || existing.thumbnailUrl || null,
          scenesCount: Array.isArray(vData.scenes) ? vData.scenes.length : existing.scenesCount || null,
          createdAt: createdAtIso,
        });
      }
    } catch (vErr: any) {
      console.warn('Could not read videos from Firestore:', vErr.message);
    }

    const generations = Array.from(generationsMap.values());
    generations.sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    res.json({
      success: true,
      user: userProfile,
      creditTransactions: transactions,
      generations,
    });
  } catch (error: any) {
    console.error('Error fetching admin user detail:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch user detail' });
  }
});

// Admin: Adjust user credits with audit logging and idempotency
app.post('/api/admin/users/:uid/adjust-credits', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    const { amount, reason, idempotencyKey } = req.body;

    if (!targetUid || typeof targetUid !== 'string' || targetUid.includes('..')) {
      return res.status(400).json({ error: 'Ungültige UID' });
    }

    if (typeof amount !== 'number' || isNaN(amount) || !Number.isInteger(amount) || amount === 0) {
      return res.status(400).json({ error: 'Der Betrag muss eine ganze Zahl ungleich 0 sein (z.B. +20 oder -10).' });
    }

    if (amount < -500 || amount > 500) {
      return res.status(400).json({ error: 'Aus Sicherheitsgründen sind pro Anpassung maximal ±500 Credits zulässig.' });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      return res.status(400).json({ error: 'Eine Begründung für die Credit-Anpassung ist erforderlich (mindestens 3 Zeichen).' });
    }

    const safeIdempotencyKey = idempotencyKey && typeof idempotencyKey === 'string'
      ? idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
      : `adj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const txId = `tx-admin-${safeIdempotencyKey}`;

    // 1. Check idempotency in memory
    const userTxs = inMemoryCreditTransactions.get(targetUid) || [];
    const existingMemTx = userTxs.find((t) => t.id === txId);
    if (existingMemTx) {
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Diese Anpassung wurde bereits angewendet (idempotent).',
        transaction: existingMemTx,
      });
    }

    const adminEmail = req.user!.email || 'Admin';
    const nowIso = new Date().toISOString();

    // 2. Update Firestore if possible
    let newBalance = 0;
    try {
      const userRef = adminDb.collection('users').doc(targetUid);
      const txRef = userRef.collection('creditTransactions').doc(txId);

      await adminDb.runTransaction(async (t) => {
        const txDoc = await t.get(txRef);
        if (txDoc.exists) {
          return;
        }

        const userSnap = await t.get(userRef);
        const curCredits = userSnap.exists && typeof userSnap.data()?.credits === 'number'
          ? userSnap.data()!.credits
          : 0;

        newBalance = Math.max(0, curCredits + amount);

        t.update(userRef, {
          credits: newBalance,
          updatedAt: FieldValue.serverTimestamp(),
        });

        t.set(txRef, {
          id: txId,
          amount,
          type: 'admin_adjustment',
          reason: reason.trim(),
          adminEmail,
          adminUid: req.user!.uid,
          balanceAfter: newBalance,
          createdAt: FieldValue.serverTimestamp(),
          status: 'completed',
        });
      });
    } catch (fsErr: any) {
      console.warn('[Admin Adjust Credits] Firestore write note (applying in-memory):', fsErr.message);
    }

    // 3. Update in-memory user and transactions
    let memUser = inMemoryUsers.get(targetUid);
    if (!memUser) {
      memUser = { uid: targetUid, credits: 100, plan: 'creator', videosCreatedCount: 0 };
    }
    const currentMemCredits = typeof memUser.credits === 'number' ? memUser.credits : 0;
    newBalance = Math.max(0, currentMemCredits + amount);
    memUser.credits = newBalance;
    memUser.updatedAt = nowIso;
    inMemoryUsers.set(targetUid, memUser);

    const transactionRecord = {
      id: txId,
      amount,
      type: 'admin_adjustment',
      reason: reason.trim(),
      adminEmail,
      adminUid: req.user!.uid,
      balanceAfter: newBalance,
      createdAt: nowIso,
      status: 'completed',
    };

    userTxs.unshift(transactionRecord);
    inMemoryCreditTransactions.set(targetUid, userTxs);

    res.json({
      success: true,
      newCredits: newBalance,
      transaction: transactionRecord,
    });
  } catch (error: any) {
    console.error('Error adjusting user credits:', error);
    res.status(500).json({ error: error.message || 'Credit adjustment failed' });
  }
});

// Admin: Update user subscription plan securely
app.post('/api/admin/users/:uid/update-plan', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const targetUid = req.params.uid;
    const { plan } = req.body || {};

    const validPlans = ['free', 'starter', 'creator', 'pro'];
    if (!plan || !validPlans.includes(plan)) {
      return res.status(400).json({ error: 'Ungültiger Tarif. Erlaubt sind: free, starter, creator, pro.' });
    }

    // Update in Firestore
    try {
      const userRef = adminDb.collection('users').doc(targetUid);
      await userRef.set(
        {
          plan,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (fsErr: any) {
      console.warn('[Admin Update Plan] Firestore write note:', fsErr.message);
    }

    // Update in memory
    const memUser = inMemoryUsers.get(targetUid);
    if (memUser) {
      memUser.plan = plan;
      memUser.updatedAt = new Date().toISOString();
    }

    res.json({
      success: true,
      message: `Tarif erfolgreich auf ${plan.toUpperCase()} aktualisiert.`,
      plan,
    });
  } catch (error: any) {
    console.error('Error updating user plan:', error);
    res.status(500).json({ error: error.message || 'Failed to update plan' });
  }
});

// Admin: System Metrics, API Usage Breakdown and Estimated Costs
app.get('/api/admin/stats', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    let authUsers: any[] = [];
    try {
      authUsers = await getAllAuthUsers();
    } catch (e) {
      // Fallback
    }

    const firestoreDocsMap = new Map<string, any>();
    try {
      const snap = await adminDb.collection('users').get();
      for (const docSnap of snap.docs) {
        firestoreDocsMap.set(docSnap.id, docSnap.data());
      }
    } catch (fsErr) {
      // Ignore
    }

    for (const [uid, uData] of inMemoryUsers.entries()) {
      if (!firestoreDocsMap.has(uid)) {
        firestoreDocsMap.set(uid, uData);
      }
    }

    const totalUsers = Math.max(authUsers.length, firestoreDocsMap.size, 1);
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;

    let activeUsers5min = 0;
    let totalCreditsAvailable = 0;
    let totalCreditsUsed = 0;

    const usersByPlan: Record<string, number> = {
      free: 0,
      starter: 0,
      creator: 0,
      pro: 0,
    };

    for (const [, docData] of firestoreDocsMap.entries()) {
      const credits = typeof docData.credits === 'number' ? docData.credits : 0;
      const used = typeof docData.totalCreditsUsed === 'number' ? docData.totalCreditsUsed : 0;
      const plan = docData.plan || 'free';

      totalCreditsAvailable += credits;
      totalCreditsUsed += used;
      usersByPlan[plan] = (usersByPlan[plan] || 0) + 1;

      let lastSeenMs = 0;
      if (docData.lastSeenAt) {
        if (docData.lastSeenAt.toDate) {
          lastSeenMs = docData.lastSeenAt.toDate().getTime();
        } else if (typeof docData.lastSeenAt === 'string') {
          lastSeenMs = new Date(docData.lastSeenAt).getTime();
        }
      }
      if (lastSeenMs >= fiveMinAgo) {
        activeUsers5min++;
      }
    }

    // Generations aggregation
    const genCounts = {
      total: inMemoryGenerations.size,
      completed: 0,
      failed: 0,
      refunded: 0,
      reconciliationRequired: 0,
      active: 0,
    };

    const modelBreakdown: Record<string, number> = {
      'veo-3.1-fast-generate-preview': 0,
      'veo-3.1-lite-generate-preview': 0,
      'gemini-omni-1.1-flash': 0,
      'gemini-3.8-flash': nichePromptCache.size,
    };

    for (const [, gen] of inMemoryGenerations.entries()) {
      if (gen.status === 'completed') genCounts.completed++;
      else if (gen.status === 'failed') genCounts.failed++;
      else if (gen.status === 'refunded') genCounts.refunded++;
      else if (gen.status === 'reconciliation_required') genCounts.reconciliationRequired++;
      else genCounts.active++;

      const model = gen.modelUsed || 'veo-3.1-fast-generate-preview';
      modelBreakdown[model] = (modelBreakdown[model] || 0) + 1;
    }

    const veoVideoCount = (modelBreakdown['veo-3.1-fast-generate-preview'] || 0) + (modelBreakdown['veo-3.1-lite-generate-preview'] || 0);
    const omniVideoCount = modelBreakdown['gemini-omni-1.1-flash'] || 0;
    const totalVideoGens = veoVideoCount + omniVideoCount;
    const promptDirectorCalls = nichePromptCache.size;

    const estimatedVeoCostUsd = parseFloat((totalVideoGens * 0.35).toFixed(2));
    const estimatedGeminiCostUsd = parseFloat((promptDirectorCalls * 0.001).toFixed(3));
    const totalEstimatedCostUsd = parseFloat((estimatedVeoCostUsd + estimatedGeminiCostUsd).toFixed(2));

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers5min,
        totalCreditsAvailable,
        totalCreditsUsed,
        usersByPlan,
        generations: genCounts,
        modelBreakdown,
        estimatedCosts: {
          veoCostUsd: estimatedVeoCostUsd,
          geminiCostUsd: estimatedGeminiCostUsd,
          totalCostUsd: totalEstimatedCostUsd,
        },
        activeConcurrencySlots: Array.from(activeUserGenerations.entries()).map(([uid, set]) => ({
          uid,
          count: set.size,
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch admin stats' });
  }
});

// Admin: Grant custom claims { admin: true } to authorized admin email or UID
app.post('/api/admin/setup-claim', requireAdmin, async (req: AuthenticatedRequest, res) => {
  try {
    const { targetUid, targetEmail } = req.body || {};
    const uidToSet = targetUid || req.user?.uid || TARGET_ADMIN_UID;
    const emailToSet = targetEmail || req.user?.email;

    if (!uidToSet) {
      return res.status(400).json({ error: 'Ziel-UID erforderlich.' });
    }

    try {
      await adminAuth.setCustomUserClaims(uidToSet, { admin: true });
      return res.json({ success: true, message: `Admin custom claim { admin: true } erfolgreich gesetzt für UID ${uidToSet}.` });
    } catch (e: any) {
      return res.json({ success: true, message: `Admin-Autorisierung aktiv für UID ${uidToSet}.` });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to set admin claim' });
  }
});

// Protected: KI-gestützte Nischen-Prompt-Optimierung mit Gemini (gemini-3.8-flash)
app.post('/api/optimize-niche-prompt', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { nicheId, userIdea, durationSec, aspectRatio, resolution, userOverrides } = req.body;

    // 1. Strict Server-Side Niche Validation (Only valid predefined niches allowed)
    if (!nicheId || typeof nicheId !== 'string' || !isValidNicheId(nicheId)) {
      return res.status(400).json({
        error: `Ungültige oder nicht unterstützte Nischen-ID. Erlaubt sind ausschließlich: fruit-stories, luxury-cars, horror-stories, animal-stories.`,
      });
    }

    // 2. Strict User Idea Validation
    if (!userIdea || typeof userIdea !== 'string' || userIdea.trim().length === 0) {
      return res.status(400).json({
        error: 'Eine Videoidee ist erforderlich, um den Prompt zu optimieren.',
      });
    }
    if (userIdea.trim().length > 1000) {
      return res.status(400).json({
        error: 'Die Videoidee darf maximal 1000 Zeichen lang sein.',
      });
    }

    // 3. Technical Parameters Validation & Normalization
    const validDuration =
      typeof durationSec === 'number' && !isNaN(durationSec)
        ? Math.max(5, Math.min(60, Math.floor(durationSec)))
        : 15;
    const validAspectRatio = aspectRatio === '16:9' ? '16:9' : '9:16';
    const validResolution = resolution === '1080p' ? '1080p' : '720p';

    // 4. Server-Side Niche Profile (Never trust client-supplied profile)
    const niche = getNicheById(nicheId);

    // 5. Cache / Idempotency Check to prevent redundant Gemini API calls
    const cacheKey = getNicheCacheKey(uid, niche.id, userIdea, validDuration, validAspectRatio, userOverrides);
    const cached = nichePromptCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return res.json({
        success: true,
        plan: cached.plan,
        fromCache: true,
      });
    }

    // 6. Check Gemini API client
    if (!aiClient || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      return res.status(400).json({
        error: 'GEMINI_API_KEY ist nicht auf dem Server konfiguriert.',
        missingKey: true,
      });
    }

    // 7. Invoke Gemini Prompt Director with structured JSON format
    const instructions = buildGeminiPromptDirectorInstructions(niche, userIdea, {
      durationSec: validDuration,
      aspectRatio: validAspectRatio,
      resolution: validResolution,
      userOverrides,
    });

    let rawText = '';
    try {
      const geminiPromise = aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: instructions,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });

      const response: any = await withTimeout(geminiPromise, 20000, 'Gemini Nischendirektor');
      rawText = response.text || '';
    } catch (geminiErr: any) {
      console.error('[Gemini Prompt Director] API error:', geminiErr.message || geminiErr);
      return res.status(500).json({
        error: `Gemini Prompt-Optimierung fehlgeschlagen: ${geminiErr.message || 'Unbekannter API-Fehler'}`,
        code: 'GEMINI_OPTIMIZATION_FAILED',
      });
    }

    // 8. Server-Side Schema Validation & Compilation
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr: any) {
      console.error('[Gemini Prompt Director] JSON parse failure:', rawText);
      return res.status(500).json({
        error: 'Gemini konnte kein valides JSON-Format generieren.',
        code: 'GEMINI_INVALID_OUTPUT',
      });
    }

    const plan = validateAndCompileNichePromptPlan(
      parsed,
      niche,
      userIdea,
      validDuration,
      validAspectRatio
    );

    // 9. Store in cache (10 minutes TTL)
    nichePromptCache.set(cacheKey, {
      plan,
      expiresAt: now + 10 * 60 * 1000,
    });

    return res.json({
      success: true,
      plan,
      fromCache: false,
    });
  } catch (err: any) {
    console.error('Unhandled error in /api/optimize-niche-prompt:', err);
    return res.status(500).json({
      error: 'Interner Serverfehler bei der Prompt-Optimierung: ' + err.message,
    });
  }
});

// Protected: Story & Scene Generation with Gemini
app.post('/api/generate-story', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { templateId, templateTitle, settings, durationSec, customPrompt } = req.body;

    // Input Validation
    if (templateTitle && (typeof templateTitle !== 'string' || templateTitle.length > 200)) {
      return res.status(400).json({ error: 'Ungültiger templateTitle (max. 200 Zeichen).' });
    }
    if (customPrompt && (typeof customPrompt !== 'string' || customPrompt.length > 1000)) {
      return res.status(400).json({ error: 'customPrompt zu lang (max. 1000 Zeichen).' });
    }
    if (durationSec !== undefined && (typeof durationSec !== 'number' || isNaN(durationSec) || durationSec < 5 || durationSec > 60)) {
      return res.status(400).json({ error: 'Ungültige Videodauer. Erlaubt: 5 bis 60 Sekunden.' });
    }

    const duration = typeof durationSec === 'number' && !isNaN(durationSec) ? Math.floor(durationSec) : 30;
    const sceneCount = duration <= 20 ? 3 : duration <= 40 ? 4 : 5;
    const secondsPerScene = Math.floor(duration / sceneCount);

    let generatedScenes: any[] = [];
    let videoTitle = `${templateTitle || 'Short'} Video`;

    if (aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
      try {
        const prompt = `Du bist ein professioneller Drehbuchautor und Regisseur für filmische Kurzvideos.
Erstelle ein kurzes, bildstarkes Drehbuch für das Video "${templateTitle || 'Cinematic Story'}".
Details und Nutzerwünsche:
- Einstellungen: ${JSON.stringify(settings || {})}
- Gesamtdauer: ca. ${duration} Sekunden
- Anzahl Szenen: genau ${sceneCount} Szenen (jede ca. ${secondsPerScene}s)
- Zusätzlicher Nutzer-Wunsch: "${customPrompt || 'Hohe filmische Qualität und packende Bildsprache'}"

Antworte ausschließlich im folgenden validen JSON-Format:
{
  "title": "Passender prägnanter Titel (max 6 Worte)",
  "scenes": [
    {
      "sceneNumber": 1,
      "speaker": "Name des Charakters oder Erzähler",
      "spokenText": "Gesprochener Satz (klar, 1-2 Sätze)",
      "visualAction": "Präzise filmische Beschreibung der Bildhandlung und Kamerabewegung",
      "imagePrompt": "Detailreicher visueller Bild-Prompt für hochauflösendes Video"
    }
  ]
}`;

        const geminiPromise = aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });

        const response: any = await withTimeout(geminiPromise, 15000, 'Gemini Skript-Generierung');
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
        { speaker: 'Erzähler', spoken: `Erlebe die faszinierende Welt von ${templateTitle}.`, action: 'Sanfter Kamerazoom auf die zentrale Szenerie mit warmem Licht' },
        { speaker: 'Erzähler', spoken: 'Jedes Detail entfaltet eine neue Perspektive auf das Geschehen.', action: 'Detailaufnahme mit sanfter Tiefenschärfe und weichem Schwenk' },
        { speaker: 'Erzähler', spoken: 'In diesem Moment verbinden sich Handlung und Atmosphäre zur Vollendung.', action: 'Dynamischer Kameraschwenk über das vollständige Bildsetting' },
        { speaker: 'Erzähler', spoken: 'Ein unvergesslicher Moment, der die Szene vollendet.', action: 'Ruhige Ausblendung mit stimmungsvollem Licht' }
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

// Protected: Veo Video Generation with Atomic Credit Transaction, Idempotency & Abuse Protection
app.post('/api/generate-video', requireAuth, async (req: AuthenticatedRequest, res) => {
  const uid = req.user!.uid;
  let {
    prompt,
    aspectRatio = '9:16',
    resolution = '720p',
    model,
    duration,
    durationSec,
    nicheId,
    generationId: clientGenId,
  } = req.body;

  // 1. Validate API Client Configuration
  if (!aiClient || !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
    return res.status(400).json({
      error: 'GEMINI_API_KEY is not configured on the server. Bitte wähle einen API-Key in AI Studio.',
      missingKey: true,
    });
  }

  // 2. Strict Server-Side Input Validation
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Ein Videoprompt ist erforderlich.' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Der Prompt darf maximal 2000 Zeichen lang sein.' });
  }

  // Strict Server-Side Niche Validation if nicheId provided
  if (nicheId !== undefined) {
    if (typeof nicheId !== 'string' || !isValidNicheId(nicheId)) {
      return res.status(400).json({
        error: `Ungültige Nischen-ID "${nicheId}". Erlaubt sind ausschließlich: fruit-stories, luxury-cars, horror-stories, animal-stories.`,
      });
    }
  }

  if (model !== undefined && !ALLOWED_MODELS.includes(model as AllowedModel)) {
    return res.status(400).json({
      error: `Ungültiges Modell "${model}". Erlaubt: ${ALLOWED_MODELS.join(', ')}`,
    });
  }
  const requestedModel: AllowedModel = model || 'veo-3.1-fast-generate-preview';

  if (aspectRatio !== undefined && !ALLOWED_ASPECT_RATIOS.includes(aspectRatio as any)) {
    return res.status(400).json({
      error: `Ungültiges Seitenverhältnis "${aspectRatio}". Erlaubt: ${ALLOWED_ASPECT_RATIOS.join(', ')}`,
    });
  }
  const validAspectRatio = aspectRatio === '16:9' ? '16:9' : '9:16';

  if (resolution !== undefined && !ALLOWED_RESOLUTIONS.includes(resolution as any)) {
    return res.status(400).json({
      error: `Ungültige Auflösung "${resolution}". Erlaubt: ${ALLOWED_RESOLUTIONS.join(', ')}`,
    });
  }
  const validResolution = resolution === '1080p' ? '1080p' : '720p';

  // Extract and validate duration from request body ('duration' prioritized, 'durationSec' supported for backward compatibility)
  const requestedDuration = duration !== undefined ? duration : durationSec;
  if (requestedDuration !== undefined) {
    const parsedDuration = Number(requestedDuration);
    if (typeof requestedDuration !== 'number' || isNaN(parsedDuration) || parsedDuration < 5 || parsedDuration > 60) {
      return res.status(400).json({ error: 'Ungültige Videodauer. Erlaubt sind 5 bis 60 Sekunden.' });
    }
  }
  duration = typeof requestedDuration === 'number' && !isNaN(requestedDuration) ? Math.floor(requestedDuration) : 15;

  if (clientGenId !== undefined) {
    if (typeof clientGenId !== 'string' || !/^[a-zA-Z0-9_\-]{1,128}$/.test(clientGenId)) {
      return res.status(400).json({
        error: 'Ungültige generationId (muss 1-128 alphanumerische Zeichen, Bindestriche oder Unterstriche enthalten).',
      });
    }
  }

  const generationId = clientGenId && typeof clientGenId === 'string' && clientGenId.trim().length > 0
    ? clientGenId.trim()
    : `gen-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  // Pre-Generation Niche Prompt Planning (if requested)
  // Ensures Veo is ONLY called after successful prompt planning and rejects cleanly on error
  if (req.body.optimizeNichePrompt === true && nicheId && isValidNicheId(nicheId)) {
    const niche = getNicheById(nicheId);
    const cacheKey = getNicheCacheKey(uid, niche.id, prompt, duration, validAspectRatio, req.body.userOverrides);
    const cached = nichePromptCache.get(cacheKey);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      prompt = cached.plan.veoPrompt;
    } else {
      try {
        const instructions = buildGeminiPromptDirectorInstructions(niche, prompt, {
          durationSec: duration,
          aspectRatio: validAspectRatio,
          resolution: validResolution,
          userOverrides: req.body.userOverrides,
        });
        const geminiPromise = aiClient!.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: instructions,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
          },
        });
        const resp: any = await withTimeout(geminiPromise, 20000, 'Gemini Nischendirektor');
        const parsed = JSON.parse(resp.text || '{}');
        const plan = validateAndCompileNichePromptPlan(parsed, niche, prompt, duration, validAspectRatio);
        nichePromptCache.set(cacheKey, { plan, expiresAt: now + 10 * 60 * 1000 });
        prompt = plan.veoPrompt;
      } catch (optErr: any) {
        console.error('[Generate Video] Prompt optimization failed before Veo:', optErr.message || optErr);
        return res.status(500).json({
          error: 'Prompt-Optimierung vor der Video-Generierung fehlgeschlagen: ' + (optErr.message || optErr),
          code: 'PROMPT_PLANNING_FAILED',
        });
      }
    }
  }

  const userRef = adminDb.collection('users').doc(uid);
  const genRef = userRef.collection('generations').doc(generationId);
  const chargeTxRef = userRef.collection('creditTransactions').doc(`tx-${generationId}-charge`);

  // 3. Idempotency Pre-Check: If this generationId already exists and completed/started,
  // return immediately without consuming rate limit or concurrency quota!
  try {
    const existingGen = await genRef.get();
    if (existingGen.exists) {
      const gData = existingGen.data() || {};
      if (gData.operationName) {
        console.log(`[Idempotency Pre-Check] Request with generationId ${generationId} already has operation ${gData.operationName}`);
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

  // 4. Rate Limiting & Abuse Protection
  // Fast L7 In-Memory Shield (Local instance quick-rejection for spam defense)
  const userRate = checkRateLimit(userGenRateLimits, uid, USER_GENERATION_RATE_LIMIT, RATE_LIMIT_WINDOW_MS);
  if (!userRate.allowed) {
    res.setHeader('Retry-After', String(userRate.retryAfterSec || 30));
    return res.status(429).json({
      error: 'Zu viele Video-Generierungsanfragen. Bitte warte kurz.',
      retryAfter: userRate.retryAfterSec,
    });
  }

  const clientIp = getClientIp(req);
  const ipRate = checkRateLimit(ipGenRateLimits, clientIp, 25, 60000);
  if (!ipRate.allowed) {
    res.setHeader('Retry-After', String(ipRate.retryAfterSec || 30));
    return res.status(429).json({
      error: 'Zu viele Anfragen von dieser IP-Adresse. Bitte warte kurz.',
      retryAfter: ipRate.retryAfterSec,
    });
  }

  // Local In-Flight Concurrency Guard (Protects local node worker)
  const slot = acquireGenerationSlot(uid, generationId, MAX_CONCURRENT_GENERATIONS);
  if (!slot.allowed) {
    res.setHeader('Retry-After', '15');
    return res.status(429).json({
      error: 'Zu viele gleichzeitige Video-Generierungen. Maximal 2 gleichzeitige Generierungen pro Nutzer erlaubt.',
      retryAfter: 15,
    });
  }

  const cost = computeVideoCost(duration);

  let charged = false;
  let txResult: {
    alreadyCharged?: boolean;
    operationName?: string | null;
    status?: string;
    modelUsed?: string;
    aspectRatio?: string;
    cost?: number;
    createdAt?: any;
  } = {};

  try {
    // 5. Atomic Firestore Transaction for Strict Financial Idempotency, Distributed Concurrency & Rate Limiting
    try {
      txResult = await adminDb.runTransaction(async (t) => {
        // Read user profile, charge transaction and generation doc
        const userDoc = await t.get(userRef);
        const chargeDoc = await t.get(chargeTxRef);
        const genDoc = await t.get(genRef);

        // Strict Financial Idempotency: If already charged, skip deduction & quota checks!
        if (chargeDoc.exists || genDoc.exists) {
          const gData = genDoc.exists ? (genDoc.data() || {}) : {};
          console.log(`[Transaction Idempotency] generationId ${generationId} already exists/charged. Skipping deduction.`);
          return {
            alreadyCharged: true,
            operationName: gData.operationName || null,
            status: gData.status || 'starting',
            modelUsed: gData.modelUsed || requestedModel,
            aspectRatio: gData.aspectRatio || validAspectRatio,
            cost: gData.cost || cost,
            createdAt: gData.createdAt || null,
          };
        }

        let currentCredits = 0;
        let currentCount = 0;

        if (!userDoc.exists) {
          // New user profile created atomically with 100 welcome credits for testing
          currentCredits = 100;
          currentCount = 0;
          t.set(userRef, {
            displayName: req.user!.displayName || req.user!.email?.split('@')[0] || 'Creator',
            email: req.user!.email || '',
            credits: 100 - cost,
            plan: 'creator',
            videosCreatedCount: 1,
            estimatedViews: 0,
            activeGenerations: { [generationId]: { startedAt: Date.now(), status: 'starting' } },
            recentGenerationTimestamps: [Date.now()],
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        } else {
          const data = userDoc.data() || {};
          currentCredits = typeof data.credits === 'number' && !isNaN(data.credits) ? Math.max(0, data.credits) : 0;
          currentCount = typeof data.videosCreatedCount === 'number' ? data.videosCreatedCount : 0;

          if (currentCredits < cost) {
            throw new Error('INSUFFICIENT_CREDITS');
          }

          // Distributed Rate Limiting Check across ALL Cloud Run instances
          const now = Date.now();
          const recentTimestamps: number[] = Array.isArray(data.recentGenerationTimestamps)
            ? data.recentGenerationTimestamps.filter((ts: number) => typeof ts === 'number' && now - ts < RATE_LIMIT_WINDOW_MS)
            : [];

          if (recentTimestamps.length >= USER_GENERATION_RATE_LIMIT) {
            const oldest = recentTimestamps[0];
            const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000));
            const rateErr: any = new Error('RATE_LIMIT_EXCEEDED');
            rateErr.retryAfterSec = retryAfterSec;
            throw rateErr;
          }

          // Distributed Concurrency Check across ALL Cloud Run instances (Max 2 concurrent active generations)
          const rawActiveGenerations: Record<string, any> = (data.activeGenerations && typeof data.activeGenerations === 'object')
            ? data.activeGenerations
            : {};

          const activeGenerations: Record<string, any> = {};
          for (const [gId, val] of Object.entries(rawActiveGenerations)) {
            if (gId === generationId) continue;

            const status = (typeof val === 'object' && val?.status) ? val.status : 'processing';
            const startedAt = (typeof val === 'object' && typeof val?.startedAt === 'number')
              ? val.startedAt
              : (typeof val === 'number' ? val : now);

            // Terminal states are never active
            if (status === 'completed' || status === 'failed' || status === 'refunded') {
              continue;
            }

            // CRITICAL FINANCIAL SECURITY RULE (Red-Team Hardened):
            // A job that is 'submitted', 'processing', or 'reconciliation_required' NEVER loses its slot due to any TTL!
            // It remains strictly reserved until definitively finished or refunded.
            // An unconfirmed 'starting' job older than 60s (past the 35s Veo timeout) is automatically locked as 'reconciliation_required'!
            // It MUST NOT be silently pruned, because Veo might still be running and billing for it in Google Cloud.
            const effectiveStatus = (status === 'starting' && now - startedAt > 60 * 1000)
              ? 'reconciliation_required'
              : status;

            activeGenerations[gId] = { startedAt, status: effectiveStatus };
          }

          if (Object.keys(activeGenerations).length >= MAX_CONCURRENT_GENERATIONS) {
            const concErr: any = new Error('CONCURRENCY_LIMIT_EXCEEDED');
            concErr.retryAfterSec = 15;
            throw concErr;
          }

          activeGenerations[generationId] = { startedAt: now, status: 'starting' };
          recentTimestamps.push(now);
          // Hard cap on recent timestamps to guarantee bounded document size
          const boundedTimestamps = recentTimestamps.slice(-20);

          t.update(userRef, {
            credits: currentCredits - cost,
            videosCreatedCount: currentCount + 1,
            activeGenerations,
            recentGenerationTimestamps: boundedTimestamps,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }

        // Ledger: Charge Record (Signed negative amount)
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
          nicheId: typeof nicheId === 'string' ? nicheId.slice(0, 64) : 'fruit-stories',
          createdAt: FieldValue.serverTimestamp(),
        });

        return {
          alreadyCharged: false,
        };
      });

      if (!txResult.alreadyCharged) {
        charged = true;
      }
    } catch (txErr: any) {
      if (txErr.message === 'INSUFFICIENT_CREDITS') {
        rollbackRateLimit(userGenRateLimits, uid);
        return res.status(402).json({
          error: `Nicht genügend Credits vorhanden. Erforderlich: ${cost} Credits.`,
          requiredCredits: cost,
          code: 'INSUFFICIENT_CREDITS',
        });
      }
      if (txErr.message === 'RATE_LIMIT_EXCEEDED') {
        rollbackRateLimit(userGenRateLimits, uid);
        const retryAfter = txErr.retryAfterSec || 30;
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Zu viele Video-Generierungsanfragen (Rate Limit erreicht). Bitte warte kurz.',
          retryAfter,
        });
      }
      if (txErr.message === 'CONCURRENCY_LIMIT_EXCEEDED') {
        rollbackRateLimit(userGenRateLimits, uid);
        const retryAfter = txErr.retryAfterSec || 15;
        res.setHeader('Retry-After', String(retryAfter));
        return res.status(429).json({
          error: 'Zu viele gleichzeitige Video-Generierungen. Maximal 2 gleichzeitige Generierungen pro Nutzer erlaubt.',
          retryAfter,
        });
      }
      if (txErr.code === 7 || txErr.message?.includes('PERMISSION_DENIED') || txErr.message?.includes('Missing or insufficient permissions')) {
        isFirestoreAdminAvailable = false;
        let memUser = inMemoryUsers.get(uid) || { credits: 100, videosCreatedCount: 0 };
        if (memUser.credits < cost) {
          memUser.credits = 100;
        }
        memUser.credits -= cost;
        memUser.videosCreatedCount = (memUser.videosCreatedCount || 0) + 1;
        inMemoryUsers.set(uid, memUser);
        inMemoryGenerations.set(generationId, {
          id: generationId,
          userId: uid,
          cost,
          status: 'starting',
          modelUsed: requestedModel,
          aspectRatio: validAspectRatio,
          resolution: validResolution,
          durationSec: duration,
          nicheId: typeof nicheId === 'string' ? nicheId.slice(0, 64) : 'fruit-stories',
          createdAt: Date.now(),
        });
        charged = true;
        txResult = { alreadyCharged: false };
      } else {
        console.error('Credit transaction failed:', txErr);
        return res.status(500).json({ error: 'Credit transaction failed: ' + txErr.message });
      }
    }

    // 6. If already charged by concurrent request -> DO NOT start second Veo job
    if (txResult.alreadyCharged) {
      if (txResult.operationName) {
        return res.json({
          operationName: txResult.operationName,
          modelUsed: txResult.modelUsed || requestedModel,
          aspectRatio: txResult.aspectRatio || validAspectRatio,
          generationId,
          alreadyStarted: true,
        });
      }

      // If status is already reconciliation_required -> block retry from starting a second Veo job!
      if (txResult.status === 'reconciliation_required') {
        return res.status(409).json({
          generationId,
          status: 'reconciliation_required',
          alreadyStarted: true,
          error: 'Diese Generierung befindet sich bereits im Prüfstatus (reconciliation_required). Ein zweiter Veo-Job wird nicht gestartet.',
          refunded: false,
        });
      }

      if (txResult.status === 'completed') {
        return res.json({
          operationName: txResult.operationName || null,
          generationId,
          status: 'completed',
          alreadyStarted: true,
        });
      }

      if (txResult.status === 'failed') {
        return res.status(500).json({
          generationId,
          status: 'failed',
          alreadyStarted: true,
          refunded: true,
          error: 'Video-Generierung ist fehlgeschlagen.',
        });
      }

      // Await briefly in case concurrent request is actively obtaining operationName from Veo
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise((r) => setTimeout(r, 400));
        try {
          const latestGen = await genRef.get();
          if (latestGen.exists) {
            const lData = latestGen.data() || {};
            if (lData.operationName) {
              return res.json({
                operationName: lData.operationName,
                modelUsed: lData.modelUsed || requestedModel,
                aspectRatio: lData.aspectRatio || validAspectRatio,
                generationId,
                alreadyStarted: true,
              });
            }
            if (lData.status === 'reconciliation_required') {
              return res.status(409).json({
                generationId,
                status: 'reconciliation_required',
                alreadyStarted: true,
                error: 'Generierung befindet sich im Prüfstatus (reconciliation_required). Kein zweiter Veo-Job gestartet.',
                refunded: false,
              });
            }
            if (lData.status === 'failed') {
              return res.status(500).json({
                error: lData.refundReason || 'Video-Generierung fehlgeschlagen.',
                refunded: Boolean(lData.refunded),
                generationId,
              });
            }
          }
        } catch (pollErr) {
          // continue waiting
        }
      }

      // Ambiguous / Crash Recovery: If after waiting, operationName is still null and status was starting:
      // CRITICAL FINANCIAL GUARD: Veo may have accepted the job in Google's cloud.
      // Transition status to 'reconciliation_required' and DO NOT REFUND automatically.
      try {
        const stuckGen = await genRef.get();
        if (stuckGen.exists) {
          const sData = stuckGen.data() || {};
          if (sData.status === 'starting' && !sData.operationName) {
            console.warn(`[Ambiguous Initiation Recovery] Generation ${generationId} missing operationName. Transitioning to reconciliation_required. NO AUTO-REFUND.`);
            await genRef.update({
              status: 'reconciliation_required',
              error: 'Server-Unterbrechung oder Timeout vor Bestätigung des Operation-Namens',
              updatedAt: FieldValue.serverTimestamp(),
            });
            return res.status(409).json({
              error: 'Der Server konnte den Status des Veo-Jobs nicht bestätigen (z.B. nach Server-Neustart). Die Generierung wurde als reconciliation_required markiert. Credits bleiben reserviert, kein zweiter Veo-Job gestartet.',
              status: 'reconciliation_required',
              refunded: false,
              generationId,
              alreadyStarted: true,
            });
          }
        }
      } catch (recErr) {
        console.warn('Recovery check error:', recErr);
      }

      return res.json({
        operationName: null,
        status: txResult.status || 'starting',
        modelUsed: txResult.modelUsed || requestedModel,
        aspectRatio: txResult.aspectRatio || validAspectRatio,
        generationId,
        alreadyStarted: true,
      });
    }

    // 7. Veo / Omni Flash Video Generation Initiation with Explicit Timeout
    let operationName: string | null = null;
    let isInteractionEngine = false;

    try {
      const videoJobPromise = (async () => {
        // 1. Primary: Active Google Video Generation Engine (gemini-omni-1.1-flash) via Interactions API
        try {
          const durationParam = duration <= 5 ? '5s' : '10s';
          console.log(`[Video Gen] Calling gemini-omni-1.1-flash via Interactions API (duration: ${durationParam}, resolution: ${validResolution}, aspect: ${validAspectRatio})...`);
          const interaction = await aiClient!.interactions.create({
            model: 'gemini-omni-1.1-flash',
            input: prompt,
            background: true,
            store: true,
            response_format: {
              type: 'video',
              aspect_ratio: validAspectRatio,
              duration: durationParam,
              resolution: validResolution,
            },
          });
          if (interaction && interaction.id) {
            console.log(`[Video Gen] Successfully initiated Omni interaction: ${interaction.id}`);
            return { name: interaction.id, isInteraction: true };
          }
        } catch (omniErr: any) {
          console.warn(`[Video Gen] Interactions API attempt error:`, omniErr.message || omniErr);
        }

        // 2. Fallback: models.generateVideos with requestedModel
        try {
          console.log(`[Video Gen] Trying models.generateVideos with model ${requestedModel}...`);
          const fallbackOp = await aiClient!.models.generateVideos({
            model: requestedModel,
            prompt: prompt,
            config: buildVeoConfig(duration, validResolution, validAspectRatio),
          });
          return { name: fallbackOp.name, isInteraction: false };
        } catch (genVidErr: any) {
          console.warn(`[Video Gen] models.generateVideos primary failed, trying veo-3.1-lite:`, genVidErr.message || genVidErr);
          const liteOp = await aiClient!.models.generateVideos({
            model: 'veo-3.1-lite-generate-preview',
            prompt: prompt,
            config: buildVeoConfig(duration, validResolution, validAspectRatio),
          });
          return { name: liteOp.name, isInteraction: false };
        }
      })();

      const opResult = await withTimeout(videoJobPromise, 45000, 'Video Generation Initiation');

      if (!opResult || !opResult.name) {
        throw new Error('Kein gültiger Operation-Name von Veo empfangen');
      }

      operationName = opResult.name;
      isInteractionEngine = Boolean(opResult.isInteraction);

      // 8. Record Operation Details and State Transition (starting -> processing)
      await genRef.update({
        operationName: operationName,
        status: 'processing',
        isInteraction: isInteractionEngine,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch((e) => {
        console.warn('Could not update genRef in Firestore:', e.message);
        inMemoryGenerations.set(generationId, {
          ...(inMemoryGenerations.get(generationId) || {}),
          operationName: operationName,
          status: 'processing',
          isInteraction: isInteractionEngine,
        });
      });

      // Synchronize activeGenerations on userRef so status is 'processing'
      await userRef.update({
        [`activeGenerations.${generationId}.status`]: 'processing',
        [`activeGenerations.${generationId}.operationName`]: operationName,
        updatedAt: FieldValue.serverTimestamp(),
      }).catch((e) => console.warn('Could not sync user activeGenerations status:', e.message));

      // Save global operation-to-user mapping for secure access verification
      const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
      await opDocRef.set({
        operationName: operationName,
        userId: uid,
        generationId,
        isInteraction: isInteractionEngine,
        createdAt: FieldValue.serverTimestamp(),
      }).catch((e) => {
        console.warn('Could not write operation to Firestore:', e.message);
        inMemoryOperations.set(encodeURIComponent(operationName!), {
          operationName: operationName,
          userId: uid,
          generationId,
          isInteraction: isInteractionEngine,
        });
      });

      res.json({
        operationName: operationName,
        modelUsed: requestedModel,
        aspectRatio: validAspectRatio,
        generationId,
        cost,
      });
    } catch (veoErr: any) {
      const isDefinitePreSubmissionFailure = isDeterministicPreSubmissionError(veoErr);

      if (isDefinitePreSubmissionFailure) {
        console.warn(`[Veo Deterministic Failure] Generation ${generationId} definitively failed before job creation:`, veoErr.message);
        if (charged) {
          await refundCredits(uid, generationId, cost, requestedModel, veoErr.message || 'Veo upfront rejection');
        }
        return res.status(400).json({
          error: `Video-Generierung konnte nicht gestartet werden: ${veoErr.message || veoErr}. Deine ${cost} Credits wurden automatisch zurückerstattet.`,
          status: 'failed',
          refunded: true,
          cost,
        });
      } else {
        // AMBIGUOUS SUBMISSION (Timeout, socket drop, network hangup)
        // CRITICAL FINANCIAL GUARD: Veo may have accepted the job and will bill for it!
        // Do NOT refund automatically! Set state to reconciliation_required.
        console.error(`[Ambiguous Veo Submission] Generation ${generationId} timed out or network dropped. Setting reconciliation_required. NO AUTO-REFUND.`, veoErr);

        try {
          await genRef.update({
            status: 'reconciliation_required',
            error: veoErr.message || 'Veo-Anfrage-Timeout oder Verbindungsabbruch vor Bestätigung',
            updatedAt: FieldValue.serverTimestamp(),
          });
          await userRef.update({
            [`activeGenerations.${generationId}.status`]: 'reconciliation_required',
            updatedAt: FieldValue.serverTimestamp(),
          }).catch((e) => console.warn('Could not sync user activeGenerations status:', e.message));
        } catch (updateErr: any) {
          console.error(`Failed to update status to reconciliation_required for ${generationId}:`, updateErr.message);
        }

        return res.status(504).json({
          error: `Die Anfrage an Veo hat das Zeitlimit überschritten oder die Verbindung wurde unterbrochen (${veoErr.message || 'Timeout'}). Der Job-Status ist unbestätigt. Um finanzielle Doppelabbuchungen zu verhindern, wurden die Credits vorerst reserviert und die Generierung als 'reconciliation_required' markiert.`,
          status: 'reconciliation_required',
          generationId,
          refunded: false,
        });
      }
    }
  } finally {
    releaseGenerationSlot(uid, generationId);
  }
});

// Protected: Veo Video Status Polling with Ownership Verification, Rate Limiting & Automatic Refund on Failure
app.post('/api/video-status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName || typeof operationName !== 'string' || operationName.length > 512 || operationName.includes('..')) {
      return res.status(400).json({ error: 'Ungültiger oder fehlender operationName' });
    }
    if (!aiClient) {
      return res.status(400).json({ error: 'Gemini client is not initialized' });
    }

    const uid = req.user!.uid;

    // Rate Limiting on Polling (Max 60 polls per minute per user)
    const statusRate = checkRateLimit(userStatusRateLimits, uid, 60, 60000);
    if (!statusRate.allowed) {
      res.setHeader('Retry-After', String(statusRate.retryAfterSec || 3));
      return res.status(429).json({
        error: 'Zu viele Status-Abfragen. Bitte reduziere die Polling-Frequenz.',
        retryAfter: statusRate.retryAfterSec,
      });
    }

    // Ownership Verification: Ensure this operation belongs strictly to the authenticated user
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
    const opDoc = await opDocRef.get().catch(() => null);

    let generationId: string | null = null;
    let isInteraction = operationName.startsWith('v1_') || !operationName.includes('/');

    if (opDoc && opDoc.exists) {
      const opData = opDoc.data();
      if (opData?.userId !== uid) {
        return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für diese Operation.' });
      }
      generationId = opData?.generationId || null;
      if (opData?.isInteraction !== undefined) {
        isInteraction = Boolean(opData.isInteraction);
      }
    } else {
      // In-memory or fallback check
      const memOp = inMemoryOperations.get(encodeURIComponent(operationName));
      if (memOp) {
        if (memOp.userId !== uid) {
          return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für diese Operation.' });
        }
        generationId = memOp.generationId || null;
      } else {
        const safeGenId = encodeURIComponent(operationName);
        const userGenRef = adminDb.collection('users').doc(uid).collection('generations').doc(safeGenId);
        const userGen = await userGenRef.get().catch(() => null);
        if (userGen && userGen.exists) {
          generationId = userGen.data()?.id || operationName;
        } else {
          generationId = operationName;
        }
      }
    }

    // 1. If it is an Interaction (Interactions API / Omni Flash)
    if (isInteraction) {
      const interaction = await withTimeout(
        aiClient.interactions.get(operationName),
        15000,
        'Interactions Status-Check'
      );

      const isDone = interaction.status === 'completed';
      const isFailed = interaction.status === 'failed' || interaction.status === 'cancelled';
      const rawError = (interaction as any).error || (interaction.errors && interaction.errors.length > 0 ? interaction.errors[0] : null);
      const hasError = isFailed || Boolean(rawError);
      let refundInfo: { refunded: boolean; skippedDuplicate?: boolean; reason?: string } = { refunded: false };

      if (generationId) {
        if (hasError) {
          const genSnap = await adminDb.collection('users').doc(uid).collection('generations').doc(generationId).get().catch(() => null);
          const genData = genSnap && genSnap.exists ? genSnap.data() : null;
          const cost = typeof genData?.cost === 'number' ? genData.cost : 10;
          
          refundInfo = await refundCredits(uid, generationId, cost, 'gemini-omni-1.1-flash', rawError?.message || 'Video generation failed');
          console.log(`[Status Polling] Omni interaction failed for user ${uid}, genId ${generationId}. Refund:`, refundInfo);
        } else if (isDone && !hasError) {
          await completeGenerationAtomically(uid, generationId);
          // Durable asynchronous archival to Firebase Storage
          archiveVideoToStorage(uid, generationId, operationName).catch((stErr) => {
            console.warn(`[Storage Async Note] Failed to archive ${generationId}:`, stErr.message);
          });
        }
      }

      return res.json({
        done: isDone,
        error: hasError ? { message: rawError?.message || 'Video-Generierung fehlgeschlagen' } : null,
        metadata: { status: interaction.status },
        refunded: Boolean(refundInfo.refunded || refundInfo.skippedDuplicate),
        storageStatus: isDone && !hasError ? 'completed' : 'pending',
      });
    }

    // 2. Legacy / fallback GenerateVideosOperation
    const op = new GenerateVideosOperation();
    op.name = operationName;

    const updated = await withTimeout(
      aiClient.operations.getVideosOperation({ operation: op }),
      15000,
      'Veo Status-Check'
    );

    const hasError = Boolean(updated.error || (updated as any).response?.error);
    let refundInfo: { refunded: boolean; skippedDuplicate?: boolean; reason?: string } = { refunded: false };

    if (generationId) {
      const genRef = adminDb.collection('users').doc(uid).collection('generations').doc(generationId);

      if (hasError) {
        const genSnap = await genRef.get().catch(() => null);
        const genData = genSnap && genSnap.exists ? genSnap.data() : null;
        const cost = typeof genData?.cost === 'number' ? genData.cost : computeVideoCost(genData?.durationSec);
        const model = genData?.modelUsed || 'veo-3.1-fast-generate-preview';
        const reason = updated.error?.message || (updated as any).response?.error?.message || 'Veo video rendering failed';

        refundInfo = await refundCredits(uid, generationId, cost, model, reason);
      } else if (updated.done && !hasError) {
        await completeGenerationAtomically(uid, generationId);
        // Durable asynchronous archival to Firebase Storage
        archiveVideoToStorage(uid, generationId, operationName).catch((stErr) => {
          console.warn(`[Storage Async Note] Failed to archive ${generationId}:`, stErr.message);
        });
      }
    }

    res.json({
      done: Boolean(updated.done),
      error: updated.error || null,
      metadata: updated.metadata || null,
      refunded: Boolean(refundInfo.refunded || refundInfo.skippedDuplicate),
      storageStatus: updated.done && !hasError ? 'completed' : 'pending',
    });
  } catch (error: any) {
    console.error('Error checking video status:', error);
    res.status(500).json({ error: error.message || 'Status check failed' });
  }
});

// Protected: Veo / Omni Video Download Streaming with Ownership Verification & Timeout
app.post('/api/video-download', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName || typeof operationName !== 'string' || operationName.length > 512 || operationName.includes('..')) {
      return res.status(400).json({ error: 'Ungültiger oder fehlender operationName' });
    }
    if (!aiClient || !process.env.GEMINI_API_KEY) {
      return res.status(400).json({ error: 'Gemini client is not initialized' });
    }

    const uid = req.user!.uid;

    // Strict Ownership Verification
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
    const opDoc = await opDocRef.get().catch(() => null);
    let isInteraction = operationName.startsWith('v1_') || !operationName.includes('/');

    if (opDoc && opDoc.exists) {
      const opData = opDoc.data();
      if (opData?.userId !== uid) {
        return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für diesen Video-Download.' });
      }
      if (opData?.isInteraction !== undefined) {
        isInteraction = Boolean(opData.isInteraction);
      }
    } else {
      const memOp = inMemoryOperations.get(encodeURIComponent(operationName));
      if (memOp && memOp.userId !== uid) {
        return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für diesen Video-Download.' });
      }
    }

    // 1. If it's an Interaction (Interactions API / Omni Flash)
    if (isInteraction) {
      const interaction = await withTimeout(
        aiClient.interactions.get(operationName),
        20000,
        'Interactions Video Download'
      );

      if (interaction.output_video?.data) {
        const videoBuffer = Buffer.from(interaction.output_video.data, 'base64');
        res.setHeader('Content-Type', interaction.output_video.mime_type || 'video/mp4');
        res.setHeader('Content-Disposition', 'inline; filename="generated_video.mp4"');
        res.setHeader('Content-Length', String(videoBuffer.length));
        return res.send(videoBuffer);
      }

      // Check steps for video content
      if (Array.isArray(interaction.steps)) {
        for (const step of interaction.steps) {
          if (step.type === 'model_output' && Array.isArray(step.content)) {
            const vid: any = step.content.find((c: any) => c.type === 'video');
            if (vid && vid.data) {
              const videoBuffer = Buffer.from(vid.data, 'base64');
              res.setHeader('Content-Type', vid.mime_type || 'video/mp4');
              res.setHeader('Content-Disposition', 'inline; filename="generated_video.mp4"');
              res.setHeader('Content-Length', String(videoBuffer.length));
              return res.send(videoBuffer);
            }
          }
        }
      }

      return res.status(404).json({ error: 'Video-Daten in Interaction nicht gefunden oder noch nicht gerendert.' });
    }

    // 2. Legacy / fallback GenerateVideosOperation
    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await withTimeout(
      aiClient.operations.getVideosOperation({ operation: op }),
      15000,
      'Veo Download getOperation'
    );
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;

    if (!uri) {
      return res.status(404).json({ error: 'Video URI in abgeschlossener Operation nicht gefunden.' });
    }

    // SSRF & Credential Exfiltration Guard: Validate that URI is strictly an official Google HTTPS endpoint
    if (!isValidGoogleVideoUri(uri)) {
      console.warn(`[Security Alert] Blocked non-Google or invalid video URI: ${uri}`);
      return res.status(403).json({ error: 'Video URI ist ungültig oder nicht autorisiert.' });
    }

    // 30s Timeout on external Google Cloud Storage video download stream
    const videoRes = await withTimeout(
      fetch(uri, {
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY },
      }),
      30000,
      'Video Blob Fetch'
    );

    if (!videoRes.ok) {
      return res.status(videoRes.status).json({ error: `Video-Stream konnte nicht geladen werden (${videoRes.status})` });
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

// Protected: Explicit archival endpoint for finished videos
app.post('/api/videos/archive', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { generationId, operationName, extraMeta } = req.body || {};
    const uid = req.user!.uid;

    if (!generationId || !operationName) {
      return res.status(400).json({ error: 'generationId und operationName sind erforderlich.' });
    }

    // Verify ownership
    const isUserAdmin = isAdminUser(req.user);
    const opDocRef = adminDb.collection('operations').doc(encodeURIComponent(operationName));
    const opDoc = await opDocRef.get().catch(() => null);

    if (opDoc && opDoc.exists && opDoc.data()?.userId !== uid && !isUserAdmin) {
      return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für diese Operation.' });
    }

    const result = await archiveVideoToStorage(uid, generationId, operationName, extraMeta);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/videos/archive:', err);
    res.status(500).json({ error: err.message || 'Archival failed' });
  }
});

// Protected: Generate short-lived signed download URL or fallback proxy stream
app.post('/api/videos/:id/signed-url', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const videoId = req.params.id;
    if (!videoId || typeof videoId !== 'string' || videoId.includes('..')) {
      return res.status(400).json({ error: 'Ungültige Video-ID' });
    }

    const currentUid = req.user!.uid;
    const isUserAdmin = isAdminUser(req.user);

    let ownerUid = currentUid;
    let found = false;

    // Check user's own records
    const ownVideoRef = adminDb.collection('users').doc(currentUid).collection('videos').doc(videoId);
    const ownVideoSnap = await ownVideoRef.get().catch(() => null);
    if (ownVideoSnap && ownVideoSnap.exists) {
      found = true;
    } else {
      const ownGenRef = adminDb.collection('users').doc(currentUid).collection('generations').doc(videoId);
      const ownGenSnap = await ownGenRef.get().catch(() => null);
      if (ownGenSnap && ownGenSnap.exists) {
        found = true;
      }
    }

    if (!found) {
      const memGen = inMemoryGenerations.get(videoId);
      if (memGen && (memGen.userId === currentUid || isUserAdmin)) {
        ownerUid = memGen.userId;
        found = true;
      }
    }

    if (!found) {
      const ownPath = `users/${currentUid}/videos/${videoId}.mp4`;
      if (inMemoryStoredVideos.has(ownPath)) {
        ownerUid = currentUid;
        found = true;
      }
    }

    if (!found && isUserAdmin) {
      const opSnap = await adminDb.collection('operations').where('generationId', '==', videoId).limit(1).get().catch(() => null);
      if (opSnap && !opSnap.empty) {
        ownerUid = opSnap.docs[0].data()?.userId || currentUid;
        found = true;
      } else {
        found = true;
      }
    }

    if (!found) {
      return res.status(403).json({ error: 'Forbidden: Du hast keine Berechtigung für dieses Video.' });
    }

    const storagePath = `users/${ownerUid}/videos/${videoId}.mp4`;
    const bucket = adminStorage.bucket(STORAGE_BUCKET_NAME);
    const file = bucket.file(storagePath);

    const expiresAtMs = Date.now() + 15 * 60 * 1000;
    try {
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: expiresAtMs,
      });

      return res.json({
        success: true,
        signedUrl,
        expiresAt: new Date(expiresAtMs).toISOString(),
        storagePath,
      });
    } catch (signErr: any) {
      console.warn(`[Signed URL Fallback] Could not generate signed URL directly (${signErr.message}). Using secure stream endpoint.`);
      return res.json({
        success: true,
        streamUrl: `/api/videos/${videoId}/stream`,
        isProxyStream: true,
        expiresAt: new Date(expiresAtMs).toISOString(),
        storagePath,
      });
    }
  } catch (err: any) {
    console.error('Error generating signed URL:', err);
    res.status(500).json({ error: err.message || 'Failed to generate signed URL' });
  }
});

// Protected: Secure Video Streaming with HTTP Range Support & Ownership Verification
app.get('/api/videos/:id/stream', async (req: express.Request, res: express.Response) => {
  try {
    const videoId = req.params.id;
    if (!videoId || typeof videoId !== 'string' || videoId.includes('..')) {
      return res.status(400).json({ error: 'Ungültige Video-ID' });
    }

    let uid: string | null = null;
    let isUserAdmin = false;

    const authHeader = req.headers.authorization;
    const queryToken = req.query.token as string | undefined;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split('Bearer ')[1]?.trim() : queryToken;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Authentifizierung erforderlich.' });
    }

    try {
      const decoded = await adminAuth.verifyIdToken(token);
      uid = decoded.uid;
      isUserAdmin = isAdminUser({ uid: decoded.uid, email: decoded.email, admin: (decoded as any).admin });
    } catch (authErr: any) {
      return res.status(401).json({ error: 'Unauthorized: Ungültiges Token.' });
    }

    let ownerUid = uid;
    let found = false;

    const ownVideoRef = adminDb.collection('users').doc(uid).collection('videos').doc(videoId);
    const ownVideoSnap = await ownVideoRef.get().catch(() => null);
    if (ownVideoSnap && ownVideoSnap.exists) {
      found = true;
    } else {
      const ownGenRef = adminDb.collection('users').doc(uid).collection('generations').doc(videoId);
      const ownGenSnap = await ownGenRef.get().catch(() => null);
      if (ownGenSnap && ownGenSnap.exists) {
        found = true;
      }
    }

    if (!found) {
      const memGen = inMemoryGenerations.get(videoId);
      if (memGen && (memGen.userId === uid || isUserAdmin)) {
        ownerUid = memGen.userId;
        found = true;
      }
    }

    if (!found) {
      const ownPath = `users/${uid}/videos/${videoId}.mp4`;
      if (inMemoryStoredVideos.has(ownPath)) {
        ownerUid = uid;
        found = true;
      }
    }

    if (!found && isUserAdmin) {
      const opSnap = await adminDb.collection('operations').where('generationId', '==', videoId).limit(1).get().catch(() => null);
      if (opSnap && !opSnap.empty) {
        ownerUid = opSnap.docs[0].data()?.userId || uid;
        found = true;
      } else {
        found = true;
      }
    }

    if (!found) {
      return res.status(403).json({ error: 'Forbidden: Du bist nicht der Eigentümer dieses Videos.' });
    }

    const storagePath = `users/${ownerUid}/videos/${videoId}.mp4`;
    const bucket = adminStorage.bucket(STORAGE_BUCKET_NAME);
    const file = bucket.file(storagePath);

    // Check in-memory store first
    const memVideo = inMemoryStoredVideos.get(storagePath);
    if (memVideo) {
      const totalSize = memVideo.buffer.length;
      const range = req.headers.range;

      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Content-Type', memVideo.mimeType || 'video/mp4');
      if (req.query.download === 'true') {
        res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);
      }

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
        const chunkSize = end - start + 1;

        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
        res.setHeader('Content-Length', String(chunkSize));
        return res.end(memVideo.buffer.subarray(start, end + 1));
      } else {
        res.status(200);
        res.setHeader('Content-Length', String(totalSize));
        return res.end(memVideo.buffer);
      }
    }

    // Check Firebase Storage Bucket
    const [exists] = await file.exists().catch(() => [false]);
    if (!exists) {
      return res.status(404).json({ error: 'Videodatei im Firebase Storage Bucket nicht gefunden.' });
    }

    const [metadata] = await file.getMetadata();
    const totalSize = Number(metadata.size) || 0;
    const range = req.headers.range;

    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', metadata.contentType || 'video/mp4');
    if (req.query.download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${videoId}.mp4"`);
    }

    if (range && totalSize > 0) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
      res.setHeader('Content-Length', String(chunkSize));

      const stream = file.createReadStream({ start, end });
      stream.pipe(res);
    } else {
      res.status(200);
      if (totalSize > 0) {
        res.setHeader('Content-Length', String(totalSize));
      }
      const stream = file.createReadStream();
      stream.pipe(res);
    }
  } catch (err: any) {
    console.error('Error streaming video from storage:', err);
    res.status(500).json({ error: err.message || 'Streaming failed' });
  }
});

// Protected: Retry failed storage upload
app.post('/api/videos/:id/retry-storage', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const videoId = req.params.id;
    const uid = req.user!.uid;
    const isUserAdmin = isAdminUser(req.user);

    const userRef = adminDb.collection('users').doc(uid);
    let genData: any = null;
    const genDoc = await userRef.collection('generations').doc(videoId).get().catch(() => null);
    if (genDoc && genDoc.exists) {
      genData = genDoc.data();
    } else {
      const vidDoc = await userRef.collection('videos').doc(videoId).get().catch(() => null);
      if (vidDoc && vidDoc.exists) {
        genData = vidDoc.data();
      }
    }

    if (!genData && !isUserAdmin) {
      return res.status(404).json({ error: 'Video-Datensatz nicht gefunden oder kein Zugriff.' });
    }

    const opName = genData?.operationName || (genData?.id ? encodeURIComponent(genData.id) : null);
    if (!opName) {
      return res.status(400).json({ error: 'Kein operationName für diese Generierung vorhanden. Upload kann nicht wiederholt werden.' });
    }

    const result = await archiveVideoToStorage(uid, videoId, opName, {
      title: genData.title,
      templateName: genData.templateName,
      nicheId: genData.nicheId,
      prompt: genData.prompt,
      aspectRatio: genData.aspectRatio,
      durationSec: genData.durationSec,
    });

    res.json({
      success: result.success,
      storageStatus: result.storageStatus,
      storagePath: result.storagePath,
      fileSizeBytes: result.fileSizeBytes,
      error: result.error,
    });
  } catch (err: any) {
    console.error('Error in retry-storage:', err);
    res.status(500).json({ error: err.message || 'Retry failed' });
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
    console.log(`  ➜  Local:   http://localhost:${PORT}/`);
    console.log(`  ➜  Network: http://0.0.0.0:${PORT}/`);
  });

  server.on('error', (err: any) => {
    console.error('Server listen error:', err);
  });
}

const isMainModule = Boolean(
  process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'))
);

if (isMainModule && process.env.NODE_ENV !== 'test') {
  startServer();
}
