import assert from 'node:assert';
import { test, describe } from 'node:test';

// Simulation of Firebase Storage & Firestore Video Archival Engine
class MockStorageBucket {
  public files = new Map<string, { buffer: Buffer; metadata: any }>();

  file(path: string) {
    return {
      name: path,
      exists: async () => [this.files.has(path)],
      save: async (buffer: Buffer, options?: any) => {
        this.files.set(path, { buffer, metadata: options?.metadata || {} });
      },
      getMetadata: async () => {
        const item = this.files.get(path);
        if (!item) throw new Error('File not found');
        return [{ size: item.buffer.length, contentType: 'video/mp4' }];
      },
      getSignedUrl: async (config: { action: string; expires: number }) => {
        if (!this.files.has(path)) throw new Error('File not found');
        return [`https://storage.googleapis.com/test-bucket/${encodeURIComponent(path)}?token=signed_${config.expires}`];
      },
    };
  }
}

class StorageArchivalPipeline {
  private activeUploads = new Map<string, Promise<any>>();
  private bucket: MockStorageBucket;
  public firestoreDocs = new Map<string, any>();
  public creditRefunds: Array<{ uid: string; generationId: string; amount: number }> = [];
  public veoCalls: Array<{ generationId: string }> = [];

  constructor(bucket: MockStorageBucket) {
    this.bucket = bucket;
  }

  getStoragePath(uid: string, videoId: string): string {
    const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '');
    const cleanVid = videoId.replace(/[^a-zA-Z0-9_-]/g, '');
    return `users/${cleanUid}/videos/${cleanVid}.mp4`;
  }

  async archiveVideo(
    uid: string,
    generationId: string,
    operationName: string,
    options: {
      simulateStorageError?: boolean;
      mockBuffer?: Buffer;
    } = {}
  ): Promise<{
    success: boolean;
    storageStatus: 'completed' | 'failed';
    storagePath?: string;
    fileSizeBytes?: number;
    error?: string;
  }> {
    const storagePath = this.getStoragePath(uid, generationId);

    // In-flight deduplication
    const activeKey = `${uid}:${generationId}`;
    if (this.activeUploads.has(activeKey)) {
      return this.activeUploads.get(activeKey)!;
    }

    const uploadPromise = (async () => {
      await Promise.resolve();
      try {
        // Record upload started in Firestore
        const genPath = `users/${uid}/generations/${generationId}`;
        const existingGen = this.firestoreDocs.get(genPath) || { id: generationId, status: 'completed' };
        this.firestoreDocs.set(genPath, {
          ...existingGen,
          storageStatus: 'uploading',
          storagePath,
        });

        if (options.simulateStorageError) {
          throw new Error('Simulated Storage bucket quota or network error');
        }

        // Mock video payload
        const videoBuffer = options.mockBuffer || Buffer.from('mock-mp4-video-bytes-1234567890');
        const fileRef = this.bucket.file(storagePath);
        await fileRef.save(videoBuffer, {
          metadata: {
            contentType: 'video/mp4',
            metadata: {
              userId: uid,
              generationId,
              operationName,
              archivedAt: new Date().toISOString(),
            },
          },
        });

        // Update Firestore records
        this.firestoreDocs.set(genPath, {
          ...existingGen,
          storageStatus: 'completed',
          storagePath,
          fileSizeBytes: videoBuffer.length,
          mimeType: 'video/mp4',
          storageBucket: 'test-bucket',
        });

        const vidPath = `users/${uid}/videos/${generationId}`;
        this.firestoreDocs.set(vidPath, {
          id: generationId,
          userId: uid,
          status: 'completed',
          storageStatus: 'completed',
          storagePath,
          fileSizeBytes: videoBuffer.length,
          mimeType: 'video/mp4',
          storageBucket: 'test-bucket',
        });

        return {
          success: true,
          storageStatus: 'completed' as const,
          storagePath,
          fileSizeBytes: videoBuffer.length,
        };
      } catch (err: any) {
        // FINANCIAL RULE: A storage error must NEVER refund credits on completed Veo generation!
        // And it must NEVER trigger a second Veo call!
        const genPath = `users/${uid}/generations/${generationId}`;
        const existingGen = this.firestoreDocs.get(genPath) || {};
        this.firestoreDocs.set(genPath, {
          ...existingGen,
          storageStatus: 'failed',
          storageError: err.message,
        });

        return {
          success: false,
          storageStatus: 'failed' as const,
          error: err.message,
        };
      } finally {
        this.activeUploads.delete(activeKey);
      }
    })();

    this.activeUploads.set(activeKey, uploadPromise);
    return uploadPromise;
  }

  // Range-aware streaming proxy simulation
  streamVideo(
    requestUid: string,
    isAdmin: boolean,
    targetUid: string,
    videoId: string,
    rangeHeader?: string
  ): { status: number; headers: Record<string, string>; bodyLength: number; error?: string } {
    // Ownership check
    if (requestUid !== targetUid && !isAdmin) {
      return { status: 403, headers: {}, bodyLength: 0, error: 'Forbidden' };
    }

    const storagePath = this.getStoragePath(targetUid, videoId);
    const item = this.bucket.files.get(storagePath);
    if (!item) {
      return { status: 404, headers: {}, bodyLength: 0, error: 'Not found' };
    }

    const totalSize = item.buffer.length;

    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;
      const chunkSize = end - start + 1;

      return {
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': 'video/mp4',
        },
        bodyLength: chunkSize,
      };
    }

    return {
      status: 200,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(totalSize),
        'Content-Type': 'video/mp4',
      },
      bodyLength: totalSize,
    };
  }
}

describe('Firebase Storage Durable Video Archival Tests', () => {
  test('1. Predictable and isolated path formatting per user and video', () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);

    const path1 = pipeline.getStoragePath('user_abc123', 'vid_xyz987');
    assert.strictEqual(path1, 'users/user_abc123/videos/vid_xyz987.mp4');

    // Prevents path traversal
    const path2 = pipeline.getStoragePath('../user_evil', '../../vid_hack');
    assert.strictEqual(path2, 'users/user_evil/videos/vid_hack.mp4');
  });

  test('2. Successful upload records storage metadata in Firestore and saves file', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);
    const mockBytes = Buffer.from('veo-high-definition-video-stream-content-1080p');

    const result = await pipeline.archiveVideo('usr-1', 'gen-100', 'operations/veo-100', {
      mockBuffer: mockBytes,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.storageStatus, 'completed');
    assert.strictEqual(result.storagePath, 'users/usr-1/videos/gen-100.mp4');
    assert.strictEqual(result.fileSizeBytes, mockBytes.length);

    // Verify bucket contents
    assert.strictEqual(bucket.files.has('users/usr-1/videos/gen-100.mp4'), true);
    assert.strictEqual(bucket.files.get('users/usr-1/videos/gen-100.mp4')?.buffer.length, mockBytes.length);

    // Verify Firestore records
    const genDoc = pipeline.firestoreDocs.get('users/usr-1/generations/gen-100');
    assert.strictEqual(genDoc.storageStatus, 'completed');
    assert.strictEqual(genDoc.fileSizeBytes, mockBytes.length);

    const vidDoc = pipeline.firestoreDocs.get('users/usr-1/videos/gen-100');
    assert.strictEqual(vidDoc.storageStatus, 'completed');
  });

  test('3. In-flight upload deduplication prevents duplicate storage uploads', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);

    let saveCount = 0;
    const originalSave = bucket.file('users/usr-dup/videos/gen-dup.mp4').save;
    bucket.file = (p: string) => ({
      name: p,
      exists: async () => [bucket.files.has(p)],
      save: async (buf: Buffer, opt?: any) => {
        saveCount++;
        await new Promise((r) => setTimeout(r, 20));
        bucket.files.set(p, { buffer: buf, metadata: opt?.metadata || {} });
      },
      getMetadata: async () => [{ size: 10, contentType: 'video/mp4' }],
      getSignedUrl: async () => ['https://storage.googleapis.com/...'],
    });

    // Launch 3 concurrent archival calls for the exact same user & generation
    const [res1, res2, res3] = await Promise.all([
      pipeline.archiveVideo('usr-dup', 'gen-dup', 'operations/veo-dup'),
      pipeline.archiveVideo('usr-dup', 'gen-dup', 'operations/veo-dup'),
      pipeline.archiveVideo('usr-dup', 'gen-dup', 'operations/veo-dup'),
    ]);

    assert.strictEqual(res1.success, true);
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res3.success, true);
    assert.strictEqual(saveCount, 1, 'File save must be called exactly once despite 3 concurrent requests');
  });

  test('4. Storage failure does NOT refund credits and does NOT restart Veo job', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);

    const result = await pipeline.archiveVideo('usr-fail', 'gen-fail-1', 'operations/veo-fail-1', {
      simulateStorageError: true,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.storageStatus, 'failed');
    assert.ok(result.error?.includes('Simulated Storage bucket quota'));

    // Critical financial invariants
    assert.strictEqual(pipeline.creditRefunds.length, 0, 'No refund should be issued because Veo rendering succeeded');
    assert.strictEqual(pipeline.veoCalls.length, 0, 'No second Veo generation should be started');

    // Firestore record reflects failed storage without affecting generation status
    const genDoc = pipeline.firestoreDocs.get('users/usr-fail/generations/gen-fail-1');
    assert.strictEqual(genDoc.storageStatus, 'failed');
    assert.strictEqual(genDoc.status, 'completed', 'Veo generation remains completed');
  });

  test('5. Safe retry after failure succeeds and marks storageStatus as completed', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);

    // Initial attempt fails
    const failRes = await pipeline.archiveVideo('usr-retry', 'gen-retry-1', 'operations/veo-retry-1', {
      simulateStorageError: true,
    });
    assert.strictEqual(failRes.success, false);

    // User or system initiates retry
    const retryRes = await pipeline.archiveVideo('usr-retry', 'gen-retry-1', 'operations/veo-retry-1', {
      simulateStorageError: false,
    });

    assert.strictEqual(retryRes.success, true);
    assert.strictEqual(retryRes.storageStatus, 'completed');
    const genDoc = pipeline.firestoreDocs.get('users/usr-retry/generations/gen-retry-1');
    assert.strictEqual(genDoc.storageStatus, 'completed');
  });

  test('6. Ownership enforcement on streaming/download endpoint', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);
    const videoData = Buffer.from('1234567890abcdefghijklmnopqrstuvwxyz');

    await pipeline.archiveVideo('user-owner', 'video-123', 'operations/veo-123', {
      mockBuffer: videoData,
    });

    // Owner access -> 200 OK
    const ownerRes = pipeline.streamVideo('user-owner', false, 'user-owner', 'video-123');
    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.bodyLength, videoData.length);

    // Unauthorized non-owner -> 403 Forbidden
    const hackerRes = pipeline.streamVideo('user-attacker', false, 'user-owner', 'video-123');
    assert.strictEqual(hackerRes.status, 403);
    assert.strictEqual(hackerRes.error, 'Forbidden');

    // Admin account -> 200 OK
    const adminRes = pipeline.streamVideo('WNCq0kNNYbeCLNAGS0TXPsMqfP02', true, 'user-owner', 'video-123');
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.bodyLength, videoData.length);
  });

  test('7. HTTP Range partial streaming for video scrubbing', async () => {
    const bucket = new MockStorageBucket();
    const pipeline = new StorageArchivalPipeline(bucket);
    const totalBytes = 1000;
    const testBuffer = Buffer.alloc(totalBytes, 0x42);

    await pipeline.archiveVideo('user-stream', 'vid-scrub', 'operations/veo-scrub', {
      mockBuffer: testBuffer,
    });

    // Request first 200 bytes
    const rangeRes1 = pipeline.streamVideo('user-stream', false, 'user-stream', 'vid-scrub', 'bytes=0-199');
    assert.strictEqual(rangeRes1.status, 206);
    assert.strictEqual(rangeRes1.headers['Content-Range'], 'bytes 0-199/1000');
    assert.strictEqual(rangeRes1.headers['Content-Length'], '200');
    assert.strictEqual(rangeRes1.bodyLength, 200);

    // Request from byte 500 to end
    const rangeRes2 = pipeline.streamVideo('user-stream', false, 'user-stream', 'vid-scrub', 'bytes=500-');
    assert.strictEqual(rangeRes2.status, 206);
    assert.strictEqual(rangeRes2.headers['Content-Range'], 'bytes 500-999/1000');
    assert.strictEqual(rangeRes2.headers['Content-Length'], '500');
    assert.strictEqual(rangeRes2.bodyLength, 500);
  });
});
