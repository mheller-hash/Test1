export type TemplateCategory = 
  | 'all'
  | 'trending'
  | 'stories'
  | 'characters'
  | 'satisfying'
  | 'asmr'
  | 'comedy'
  | 'cinematic'
  | 'experimental';

export interface TemplateOptionField {
  id: string;
  label: string;
  description?: string;
  type: 'select' | 'radio' | 'slider' | 'toggle' | 'text';
  options?: { value: string; label: string; icon?: string }[];
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface VideoTemplate {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: TemplateCategory;
  badge?: 'Trending' | 'New' | 'Popular' | 'Viral';
  thumbnailUrl: string;
  aspectRatio: '9:16';
  defaultDurationSec: number;
  creditCost: number;
  presetScenarios: {
    title: string;
    description: string;
    config: Record<string, any>;
  }[];
  customizableFields: TemplateOptionField[];
  sampleScriptPreview: {
    character: string;
    line: string;
    visualPrompt: string;
  }[];
}

export interface SceneData {
  sceneNumber: number;
  durationSec: number;
  imagePrompt: string;
  imageUrl: string;
  speaker: string;
  spokenText: string;
  subtitles: {
    word: string;
    startSec: number;
    endSec: number;
  }[];
  visualAction: string;
  soundEffect?: string;
}

export interface GeneratedVideo {
  id: string;
  title: string;
  templateId: string;
  templateName: string;
  thumbnailUrl: string;
  videoUrl?: string;
  modelUsed?: string;
  durationSec: number;
  createdAt: string;
  status: 'completed' | 'generating' | 'failed';
  creditUsed: number;
  scenes: SceneData[];
  settings: Record<string, any>;
  aspectRatio: '9:16' | '16:9';
}

export interface UserProfile {
  name: string;
  email: string;
  credits: number;
  plan: 'free' | 'creator' | 'pro';
  videosCreatedCount: number;
  estimatedViews: number;
}
