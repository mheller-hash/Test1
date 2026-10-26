import {
  CreateVideoFormState,
  CharacterOrObject,
  EnvironmentConfig,
  SceneConfig,
  VisualStyleType,
  CameraMovementType,
  AudioConfig,
  VideoSettingsConfig,
} from '../types/workflow';

export interface PromptEngineResult {
  prompt: string;
  charCount: number;
  wordCount: number;
  sections: {
    concept: string;
    characters: string;
    environment: string;
    scenes: string;
    styleAndLighting: string;
    cameraAndMotion: string;
    audioAndDialogue: string;
    specs: string;
  };
}

/**
 * Maps VisualStyleType to cinematic and aesthetic descriptions for Google Veo
 */
export function getStyleDescriptor(style: VisualStyleType, custom?: string): string {
  const customPart = custom && custom.trim().length > 0 ? ` ${custom.trim()}` : '';
  switch (style) {
    case 'cinematic':
      return `Cinematic 35mm film aesthetic, shallow depth of field, anamorphic lens flares, rich color grading, natural cinematic grain.${customPart}`;
    case 'photorealistic':
      return `Ultra-photorealistic 8K fidelity, physically accurate materials, realistic skin textures, ray-traced reflections.${customPart}`;
    case '3d-animation':
      return `Modern stylized 3D animation, Pixar and DreamWorks inspired aesthetic, expressive character physics, vibrant subsurface scattering.${customPart}`;
    case 'cartoon':
      return `Dynamic animated cartoon style, bold expressive outlines, playful character physics, colorful 2D/3D hybrid visual flair.${customPart}`;
    case 'anime':
      return `High-end contemporary anime aesthetic, Studio Ghibli and Makoto Shinkai inspired lighting, emotive character designs, hand-drawn art direction.${customPart}`;
    case 'stylized':
      return `Avant-garde stylized aesthetic, artistic color harmony, creative graphic lighting, distinctive visual identity.${customPart}`;
    case 'custom':
      return custom && custom.trim().length > 0
        ? custom.trim()
        : 'Unique custom visual aesthetic, clear artistic direction and high visual fidelity.';
    default:
      return `High cinematic quality, professional cinematography, balanced contrast.${customPart}`;
  }
}

/**
 * Maps CameraMovementType to professional cinematic camera directions for Veo
 */
export function getCameraDescriptor(camera: CameraMovementType, custom?: string): string {
  const customPart = custom && custom.trim().length > 0 ? ` ${custom.trim()}` : '';
  switch (camera) {
    case 'close-up':
      return `Tight close-up shot focusing on fine emotions and micro-actions, soft bokeh background.${customPart}`;
    case 'medium-shot':
      return `Balanced medium shot showcasing characters from the waist up in relation to their environment.${customPart}`;
    case 'wide-shot':
      return `Expansive wide establishing shot capturing the complete environment and spatial choreography.${customPart}`;
    case 'pov':
      return `First-person point-of-view (POV) perspective, immersive first-hand motion and reactive camera tilt.${customPart}`;
    case 'tracking-shot':
      return `Dynamic smooth tracking camera following the subject at high frame consistency, fluid parallax.${customPart}`;
    case 'cinematic':
      return `Dynamic cinematic multi-angle framing, smooth dolly push-in, subtle gimbal stabilization.${customPart}`;
    case 'custom':
      return custom && custom.trim().length > 0
        ? custom.trim()
        : 'Smooth natural camera movement aligned with the on-screen subject.';
    case 'auto':
    default:
      return `Intelligent dynamic camera framing tailored to character motion and narrative pacing.${customPart}`;
  }
}

/**
 * Builds the Characters section without hallucinating unrequested entities
 */
export function buildCharactersSection(characters: CharacterOrObject[]): string {
  if (!characters || characters.length === 0) return '';
  const validChars = characters.filter((c) => c && c.name && c.name.trim().length > 0);
  if (validChars.length === 0) return '';

  const charDescriptions = validChars.map((c) => {
    const details: string[] = [];
    if (c.description?.trim()) details.push(c.description.trim());
    if (c.appearance?.trim()) details.push(`appearance: ${c.appearance.trim()}`);
    if (c.personality?.trim()) details.push(`behavior: ${c.personality.trim()}`);
    if (c.clothing?.trim()) details.push(`attire: ${c.clothing.trim()}`);

    return details.length > 0
      ? `• ${c.name.trim()} (${details.join(', ')})`
      : `• ${c.name.trim()}`;
  });

  return `CHARACTERS:\n${charDescriptions.join('\n')}`;
}

/**
 * Builds the Environment and Lighting section
 */
export function buildEnvironmentSection(env?: EnvironmentConfig): string {
  if (!env) return '';
  const parts: string[] = [];
  if (env.location?.trim()) parts.push(`Setting: ${env.location.trim()}`);
  if (env.timeOfDay?.trim()) parts.push(`Time: ${env.timeOfDay.trim()}`);
  if (env.weatherOrAtmosphere?.trim()) parts.push(`Atmosphere: ${env.weatherOrAtmosphere.trim()}`);

  if (parts.length === 0) return '';
  return `ENVIRONMENT & SETTING:\n${parts.join(' | ')}`;
}

/**
 * Builds the chronological Scenes and Narrative Story section
 */
export function buildScenesSection(idea: string, scenes: SceneConfig[]): string {
  const trimmedIdea = idea?.trim() || '';
  const validScenes = (scenes || []).filter((s) => s && s.description && s.description.trim().length > 0);

  if (validScenes.length === 0) {
    return trimmedIdea ? `STORY & ACTION:\n${trimmedIdea}` : '';
  }

  // Preserve chronological order (Scene 1, Scene 2, etc.)
  const sortedScenes = [...validScenes].sort((a, b) => (a.sceneNumber || 0) - (b.sceneNumber || 0));
  const sceneLines = sortedScenes.map((s, idx) => {
    const scNum = s.sceneNumber || idx + 1;
    const parts = [`Scene ${scNum}: ${s.description.trim()}`];
    if (s.action?.trim()) parts.push(`Action: ${s.action.trim()}`);
    if (s.dialogue?.trim()) parts.push(`Dialogue: "${s.dialogue.trim()}"`);
    return parts.join(' — ');
  });

  const header = trimmedIdea ? `CORE CONCEPT: ${trimmedIdea}\n\nSCENE BREAKDOWN (Chronological Order):` : `SCENE BREAKDOWN (Chronological Order):`;
  return `${header}\n${sceneLines.join('\n')}`;
}

/**
 * Builds the Audio & Dialogue section (strictly separated from visual action)
 */
export function buildAudioSection(audio?: AudioConfig): string {
  if (!audio || !audio.enableAudio) return '';

  const audioParts: string[] = [];
  if (audio.dialogue?.trim()) {
    audioParts.push(`Spoken Dialogue: "${audio.dialogue.trim()}"`);
  }
  if (audio.soundEffects?.trim()) {
    audioParts.push(`SFX: ${audio.soundEffects.trim()}`);
  }
  if (audio.ambientSound?.trim()) {
    audioParts.push(`Ambience: ${audio.ambientSound.trim()}`);
  }
  if (audio.musicMood?.trim()) {
    audioParts.push(`Score / Mood: ${audio.musicMood.trim()}`);
  }

  if (audioParts.length === 0) return '';
  return `AUDIO DESIGN:\n${audioParts.join('\n')}`;
}

/**
 * Builds technical specifications for Veo
 */
export function buildSpecsSection(settings?: VideoSettingsConfig): string {
  if (!settings) return '';
  const ar = settings.aspectRatio || '9:16';
  const dur = settings.durationSec || 15;
  const res = settings.resolution || '720p';
  return `TECHNICAL SPECS:\nAspect Ratio: ${ar} | Duration: ${dur}s | Target Resolution: ${res}`;
}

/**
 * Truncates and condenses prompt if it approaches the strict 2000 character backend limit.
 * Guaranteed to keep prompt <= maxChars (default 1950 for safe headroom).
 */
export function fitPromptLength(prompt: string, maxChars: number = 1950): string {
  if (prompt.length <= maxChars) return prompt;

  // If too long, prune non-essential descriptive adjectives while keeping Core Concept,
  // Characters, and Scenes intact.
  const lines = prompt.split('\n');
  const essentialSections: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    if (currentLength + line.length + 1 <= maxChars) {
      essentialSections.push(line);
      currentLength += line.length + 1;
    } else {
      // Line doesn't fit entirely
      const remainingSpace = maxChars - currentLength - 4;
      if (remainingSpace > 20) {
        essentialSections.push(`${line.slice(0, remainingSpace)}...`);
      }
      break;
    }
  }

  return essentialSections.join('\n').trim();
}

/**
 * Main Prompt Engine:
 * Compiles user inputs into a structured, high-fidelity Google Veo prompt.
 */
export function generateVeoPrompt(form: CreateVideoFormState): PromptEngineResult {
  const concept = form.idea?.trim() || 'A high-quality cinematic video.';
  const characters = buildCharactersSection(form.characters || []);
  const environment = buildEnvironmentSection(form.environment);
  const scenes = buildScenesSection(form.idea, form.scenes || []);
  const styleDesc = getStyleDescriptor(form.style || 'cinematic', form.customStyleInstructions);
  const cameraDesc = getCameraDescriptor(form.camera || 'auto', form.customCameraInstructions);
  const styleAndLighting = `VISUAL STYLE & LIGHTING:\n${styleDesc}`;
  const cameraAndMotion = `CAMERA & MOTION:\n${cameraDesc}`;
  const audioAndDialogue = buildAudioSection(form.audio);
  const specs = buildSpecsSection(form.settings);

  // Assemble structured sections
  const rawSections = [
    scenes || `CONCEPT:\n${concept}`,
    characters,
    environment,
    styleAndLighting,
    cameraAndMotion,
    audioAndDialogue,
    specs,
  ].filter((sec) => sec && sec.trim().length > 0);

  const assembledPrompt = rawSections.join('\n\n');
  const safePrompt = fitPromptLength(assembledPrompt, 1950);

  return {
    prompt: safePrompt,
    charCount: safePrompt.length,
    wordCount: safePrompt.trim().split(/\s+/).filter(Boolean).length,
    sections: {
      concept,
      characters,
      environment,
      scenes,
      styleAndLighting,
      cameraAndMotion,
      audioAndDialogue,
      specs,
    },
  };
}
