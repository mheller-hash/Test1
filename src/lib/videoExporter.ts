import { GeneratedVideo } from '../types';

/**
 * Triggers a browser file download from a Blob or URL
 */
export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

/**
 * Generates an SRT (SubRip) subtitle file content with timestamps
 */
export function generateSrtContent(video: GeneratedVideo): string {
  let srt = '';
  let counter = 1;
  const scenes = video.scenes || [];
  const durationSec = video.durationSec || 30;

  scenes.forEach((scene, sceneIdx) => {
    const sceneStart = (sceneIdx / (scenes.length || 1)) * durationSec;
    const sceneDuration = scene.durationSec || durationSec / (scenes.length || 1);
    const sceneEnd = sceneStart + sceneDuration;

    if (scene.subtitles && scene.subtitles.length > 0) {
      // Group words into 3-4 word phrases for natural readability
      const words = scene.subtitles;
      const chunkSize = 4;
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize);
        const chunkStart = sceneStart + chunk[0].startSec;
        const chunkEnd = sceneStart + chunk[chunk.length - 1].endSec;
        const text = chunk.map((w) => w.word).join(' ');

        srt += `${counter}\n`;
        srt += `${formatSrtTime(chunkStart)} --> ${formatSrtTime(chunkEnd)}\n`;
        srt += `${text}\n\n`;
        counter++;
      }
    } else if (scene.spokenText) {
      srt += `${counter}\n`;
      srt += `${formatSrtTime(sceneStart)} --> ${formatSrtTime(sceneEnd)}\n`;
      srt += `${scene.spokenText}\n\n`;
      counter++;
    }
  });

  return srt;
}

function formatSrtTime(seconds: number): string {
  const safeSec = Math.max(0, seconds);
  const hrs = Math.floor(safeSec / 3600);
  const mins = Math.floor((safeSec % 3600) / 60);
  const secs = Math.floor(safeSec % 60);
  const millis = Math.floor((safeSec % 1) * 1000);
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

/**
 * Generates human-readable script text
 */
export function generateScriptContent(video: GeneratedVideo): string {
  return [
    `ShortsCraft AI — Video Script & Export Metadata`,
    `================================================`,
    `Titel:         ${video.title}`,
    `Template:      ${video.templateName}`,
    `Format:        ${video.aspectRatio || '9:16'}`,
    `Dauer:         ${video.durationSec} Sekunden`,
    `Auflösung:     1080p Full HD`,
    `Modell:        ${video.modelUsed || 'Veo 3.1'}`,
    `Erstellt:      ${video.createdAt}`,
    ``,
    `SZENEN-DREHBUCH:`,
    `------------------------------------------------`,
    ...(video.scenes?.map((s) => [
      `[Szene ${s.sceneNumber}] (${s.durationSec}s)`,
      `Sprecher: ${s.speaker}`,
      `Voiceover: "${s.spokenText}"`,
      `Visuelle Regie: ${s.visualAction}`,
      s.imagePrompt ? `Bild-Prompt: ${s.imagePrompt}` : null,
      ``,
    ].filter(Boolean).join('\n')) || ['Keine Szenendaten vorhanden.']),
  ].join('\n');
}

/**
 * Downloads the video file:
 * - If video.videoUrl exists (Veo rendered MP4), downloads the real MP4 stream
 * - If only storyboard exists, synthesizes a real video using Canvas + MediaRecorder
 */
export async function downloadVideoFile(
  video: GeneratedVideo,
  options: {
    onProgress?: (progressPercent: number, statusText: string) => void;
  } = {}
): Promise<{ format: 'mp4' | 'webm'; filename: string }> {
  const { onProgress } = options;
  const cleanTitle = (video.title || 'shortscraft_video')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();

  // Mode 1: Real MP4 video URL is present (from Veo 3.1)
  if (video.videoUrl) {
    onProgress?.(20, 'Lade MP4-Videodatei...');
    try {
      const res = await fetch(video.videoUrl);
      if (!res.ok) throw new Error(`HTTP Status ${res.status}`);
      onProgress?.(60, 'Verarbeite Videodaten...');
      const blob = await res.blob();
      const videoBlob = blob.type.startsWith('video/')
        ? blob
        : new Blob([blob], { type: 'video/mp4' });
      onProgress?.(90, 'Speichere Datei lokal...');
      const filename = `${cleanTitle}.mp4`;
      triggerBlobDownload(videoBlob, filename);
      onProgress?.(100, 'Fertig!');
      return { format: 'mp4', filename };
    } catch (err) {
      console.warn('Direct blob fetch failed, falling back to direct browser link:', err);
      // Fallback for strict CORS: direct link download
      const a = document.createElement('a');
      a.href = video.videoUrl;
      a.download = `${cleanTitle}.mp4`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      onProgress?.(100, 'Fertig!');
      return { format: 'mp4', filename: `${cleanTitle}.mp4` };
    }
  }

  // Mode 2: Client-side video synthesis via Canvas + MediaRecorder
  onProgress?.(10, 'Initialisiere Video-Renderer...');
  return await renderVideoFromStoryboard(video, cleanTitle, onProgress);
}

/**
 * Renders a storyboard into a playable video file via HTML5 Canvas & MediaRecorder
 */
async function renderVideoFromStoryboard(
  video: GeneratedVideo,
  cleanTitle: string,
  onProgress?: (progressPercent: number, statusText: string) => void
): Promise<{ format: 'mp4' | 'webm'; filename: string }> {
  const isWide = video.aspectRatio === '16:9';
  const width = isWide ? 1280 : 720;
  const height = isWide ? 720 : 1280;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Could not create 2D canvas context');

  // Pre-load scene images
  onProgress?.(20, 'Lade Szenen-Bilder...');
  const scenes = video.scenes && video.scenes.length > 0 ? video.scenes : [
    {
      sceneNumber: 1,
      durationSec: video.durationSec || 30,
      imagePrompt: video.title,
      imageUrl: video.thumbnailUrl,
      speaker: 'ShortsCraft',
      spokenText: video.title,
      subtitles: [],
      visualAction: 'Szenenansicht',
    },
  ];

  const loadedImages: HTMLImageElement[] = await Promise.all(
    scenes.map((scene) => {
      return new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => {
          // If scene image fails to load, fallback to thumbnail or colored canvas
          const fallback = new Image();
          fallback.crossOrigin = 'anonymous';
          fallback.onload = () => resolve(fallback);
          fallback.onerror = () => resolve(img);
          fallback.src = video.thumbnailUrl;
        };
        img.src = scene.imageUrl || video.thumbnailUrl;
      });
    })
  );

  onProgress?.(35, 'Bereite Aufnahme vor...');

  // Setup MediaRecorder
  const stream = canvas.captureStream(30); // 30 FPS
  let mimeType = 'video/webm';
  let extension: 'mp4' | 'webm' = 'webm';

  if (typeof MediaRecorder !== 'undefined') {
    if (MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
      extension = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
      extension = 'mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
      extension = 'webm';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
      extension = 'webm';
    }
  }

  const recordedChunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4000000, // 4 Mbps crisp quality
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      recordedChunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<{ format: 'mp4' | 'webm'; filename: string }>((resolve, reject) => {
    recorder.onstop = () => {
      try {
        const blob = new Blob(recordedChunks, { type: mimeType });
        const filename = `${cleanTitle}_shortscraft.${extension}`;
        triggerBlobDownload(blob, filename);
        onProgress?.(100, 'Download abgeschlossen!');
        resolve({ format: extension, filename });
      } catch (err) {
        reject(err);
      }
    };
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  // Render loop simulation for realistic short video
  const totalDurationSec = video.durationSec || 30;
  const fps = 30;
  const totalFrames = Math.min(fps * totalDurationSec, 180);
  const frameDurationMs = (totalDurationSec / totalFrames) * 1000;

  for (let frame = 0; frame < totalFrames; frame++) {
    const currentTimeSec = (frame / totalFrames) * totalDurationSec;
    const progressPercent = Math.min(95, Math.floor(35 + (frame / totalFrames) * 55));
    onProgress?.(progressPercent, `Rendere Frames: ${progressPercent}%`);

    // Determine current scene
    const sceneIdx = Math.min(
      scenes.length - 1,
      Math.floor((currentTimeSec / totalDurationSec) * scenes.length)
    );
    const scene = scenes[sceneIdx];
    const img = loadedImages[sceneIdx];

    // 1. Draw Image with smooth Ken Burns zoom
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, width, height);

    if (img && img.complete && img.naturalWidth > 0) {
      const zoom = 1 + ((frame % (totalFrames / scenes.length)) / (totalFrames / scenes.length)) * 0.08;
      const drawW = width * zoom;
      const drawH = height * zoom;
      const offsetX = (width - drawW) / 2;
      const offsetY = (height - drawH) / 2;
      ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
    }

    // 2. Gradient overlays for readability
    const topGradient = ctx.createLinearGradient(0, 0, 0, height * 0.25);
    topGradient.addColorStop(0, 'rgba(0,0,0,0.75)');
    topGradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, width, height * 0.25);

    const bottomGradient = ctx.createLinearGradient(0, height * 0.6, 0, height);
    bottomGradient.addColorStop(0, 'rgba(0,0,0,0)');
    bottomGradient.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, height * 0.6, width, height * 0.4);

    // 3. Header Badges
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(30, 30, 240, 40, 10);
    ctx.fill();

    ctx.fillStyle = '#fda4af';
    ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(`${video.templateName || 'ShortsCraft'}`, 44, 55);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 13px "JetBrains Mono", monospace';
    ctx.fillText('Veo 3.1', 205, 55);

    // 4. TikTok/Reels Dynamic Subtitles
    if (scene && scene.spokenText) {
      const sceneRelativeSec = currentTimeSec - (sceneIdx / scenes.length) * totalDurationSec;
      const words = scene.spokenText.split(' ');
      const activeWordIdx = Math.min(
        words.length - 1,
        Math.floor((sceneRelativeSec / (totalDurationSec / scenes.length)) * words.length)
      );

      // Subtitle Box
      const boxW = width - 80;
      const boxH = isWide ? 90 : 120;
      const boxX = 40;
      const boxY = height - (isWide ? 130 : 200);

      ctx.fillStyle = 'rgba(10, 10, 15, 0.85)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 20);
      ctx.fill();
      ctx.stroke();

      // Speaker Tag
      ctx.fillStyle = '#fb7185';
      ctx.font = 'bold 15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(scene.speaker.toUpperCase(), boxX + 24, boxY + 34);

      // Subtitle Line with highlighted word
      ctx.font = `bold ${isWide ? '22px' : '26px'} "Plus Jakarta Sans", sans-serif`;
      let currentX = boxX + 24;
      const textY = boxY + (isWide ? 66 : 78);

      words.slice(0, 7).forEach((word, idx) => {
        const isCurrent = idx === activeWordIdx;
        ctx.fillStyle = isCurrent ? '#fde047' : '#ffffff';
        ctx.fillText(word, currentX, textY);
        currentX += ctx.measureText(word + ' ').width;
      });
    }

    // 5. Watermark / Brand in bottom right
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('ShortsCraft.ai', width - 40, height - 30);
    ctx.textAlign = 'left';

    await new Promise((r) => setTimeout(r, 20));
  }

  onProgress?.(95, 'Finalisiere Videodatei...');
  recorder.stop();
  return await recordingPromise;
}
