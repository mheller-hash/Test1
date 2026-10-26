/**
 * Definition and specifications for predetermined video niches in Veyro.ai.
 * Users cannot create, edit, or delete niches - they are centrally configured in code.
 */

export type PredefinedNicheId =
  | 'fruit-stories'
  | 'luxury-cars'
  | 'horror-stories'
  | 'animal-stories';

export interface VideoNiche {
  /** Unique immutable identifier */
  id: PredefinedNicheId;
  /** Display name of the niche */
  name: string;
  /** Catchy one-sentence subtitle */
  tagline: string;
  /** Full descriptive explanation of what makes this niche compelling */
  description: string;
  /** Visual preview image URL for the selection card */
  previewImage: string;
  /** Alias for previewImage */
  previewImageUrl?: string;
  /** Icon representation */
  icon?: string;
  /** Badge label (e.g. "Viral Trend", "High CPM", etc.) */
  badge?: string;
  /** UI Theme accent styling */
  accent: {
    color: string;
    border: string;
    bgSoft: string;
    gradient: string;
    icon: string;
  };

  // =========================================================================
  // Section 4: Specifications for Future Specialized Prompt Engines
  // =========================================================================
  
  /** Visueller Stil: Core visual aesthetics, rendering style, textures, lighting */
  visualStyle: string;

  /** Typische Figuren und Objekte: Common characters, props, recurring elements */
  typicalCharactersAndObjects: string[];

  /** Kamerastil: Cinematic movements, lenses, framing habits typical for this genre */
  cameraStyle: string;

  /** Storytelling-Regeln: Hook pacing, conflict, comedic/dramatic rhythm */
  storytellingRules: string[];

  /** Audio-Regeln: Sound design, music genre, voice tone guidelines */
  audioRules: string[];

  /** Unerwünschte Elemente: Negative prompts / forbidden aesthetic pitfalls */
  negativeElements: string[];

  /** Sample ideas to inspire user in the workflow */
  sampleIdeas: {
    title: string;
    hook: string;
    promptSnippet: string;
  }[];

  /** Suggested default duration */
  defaultDurationSec: number;
}

export interface NichePromptCharacter {
  name: string;
  appearance: string;
  personalityOrRole?: string;
}

export interface NichePromptTimelineItem {
  timestampSec: string;
  visual: string;
  cameraMovement: string;
  audioOrSfx?: string;
}

export interface NichePromptStructuredSpec {
  mainCharacters: NichePromptCharacter[];
  environment: {
    setting: string;
    timeOfDay: string;
    lightingAndAtmosphere: string;
  };
  narrativeAction: string;
  timeline: NichePromptTimelineItem[];
  visualStyle: string;
  cameraDirection: string;
  lightingStyle: string;
  audioAndSoundEffects: {
    sfx: string[];
    ambient: string;
    dialogueOrVoiceover?: string;
  };
  continuityRules: string[];
  avoidElements: string[];
}

export interface NichePromptPlan {
  nicheId: PredefinedNicheId;
  nicheName: string;
  userIdea: string;
  summaryGerman: string;
  structuredSpec: NichePromptStructuredSpec;
  veoPrompt: string;
  createdAtMillis: number;
}
