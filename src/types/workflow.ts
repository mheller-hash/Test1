export interface CharacterOrObject {
  id: string;
  name: string;
  description?: string;
  appearance?: string;
  personality?: string;
  clothing?: string;
}

export interface EnvironmentConfig {
  location: string;
  timeOfDay?: string;
  weatherOrAtmosphere?: string;
}

export interface SceneConfig {
  id: string;
  sceneNumber: number;
  description: string;
  action?: string;
  dialogue?: string;
}

export type VisualStyleType =
  | 'cinematic'
  | 'photorealistic'
  | '3d-animation'
  | 'cartoon'
  | 'anime'
  | 'stylized'
  | 'custom';

export type CameraMovementType =
  | 'auto'
  | 'close-up'
  | 'medium-shot'
  | 'wide-shot'
  | 'pov'
  | 'tracking-shot'
  | 'cinematic'
  | 'custom';

export interface AudioConfig {
  enableAudio: boolean;
  dialogue?: string;
  soundEffects?: string;
  ambientSound?: string;
  musicMood?: string;
}

export interface VideoSettingsConfig {
  aspectRatio: '9:16' | '16:9';
  durationSec: number;
  resolution: '720p' | '1080p';
  model: 'veo-3.1-fast-generate-preview' | 'veo-3.1-generate-preview' | 'veo-2.0-generate-001';
}

export interface CreateVideoFormState {
  idea: string;
  characters: CharacterOrObject[];
  environment: EnvironmentConfig;
  scenes: SceneConfig[];
  style: VisualStyleType;
  customStyleInstructions?: string;
  camera: CameraMovementType;
  customCameraInstructions?: string;
  audio: AudioConfig;
  settings: VideoSettingsConfig;
  editedPrompt?: string; // Optional manual override on review step
}
