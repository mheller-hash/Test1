import {
  VideoNiche,
  NichePromptPlan,
  NichePromptStructuredSpec,
  PredefinedNicheId,
} from '../types/niche';
import { fitPromptLength } from './promptEngine';

/**
 * Niche-specific director guidance rules according to section 3 of requirements.
 */
export const NICHE_DIRECTOR_GUIDANCE: Record<
  PredefinedNicheId,
  {
    role: string;
    priorities: string[];
    technicalAdvice: string;
  }
> = {
  'fruit-stories': {
    role: 'Lead Animation Director for Anthropomorphic Fruit Drama',
    priorities: [
      'Anthropomorphic fruits with consistent, recognizable physical features and tiny micro-accessories.',
      'Expressive facial animations and lively reactions (laughter, shock, determination) with high emotional stakes.',
      'Macro-perspective cinematography inside kitchens, pantries, or dining tables with realistic fruit skin textures (pores, seeds, gloss).',
      'Understandable mini-story arcs with a quick visual hook and charming comedic or heartwarming payoffs.',
    ],
    technicalAdvice:
      'Keep scale tiny and camera low at fruit eye level. Combine macro depth-of-field (f/2.8) with high-detail fruit pulp textures. If the user explicitly asks for realistic vs animated, respect their style choice while keeping the fruit characters.',
  },
  'luxury-cars': {
    role: 'Commercial Automotive Director for High-End Hypercars',
    priorities: [
      'Accurate vehicle proportions, authentic aerodynamic contours, pristine paintwork and real carbon-fiber weaves.',
      'High-end automotive cinematography: Low-angle tracking shots, rolling road shots, anamorphic lens flares, and dynamic 360-degree orbit passes.',
      'Realistic vehicle physics: Suspensions compressing under turn, tires gripping wet asphalt, visible brake calipers, and exhaust flames/notes.',
      'Sophisticated reflective environments: Wet city streets reflecting neon, sunset coastlines, or futuristic architectural hangars.',
    ],
    technicalAdvice:
      'Emphasize ray-traced reflections on glossy metallic clear-coats and wet asphalt. Synchronize camera speed to the vehicle momentum.',
  },
  'horror-stories': {
    role: 'Psychological Horror & Suspense Cinematographer',
    priorities: [
      'Atmospheric dread and slow-burning psychological tension over cheap jump scares.',
      'Believable, decaying or uncanny environments: Abandoned corridors, foggy pine woods, candlelit chambers, or flickering basement server rooms.',
      'Masterful low-key lighting: Cold cyan shadows, eerie warm flashlight beams, volumetric drifting fog, and high-contrast darkness.',
      'Precise camera movements: Agonizing slow dolly push-ins, subtle focus shifts, and POV angles that hint at something lurking just out of frame.',
    ],
    technicalAdvice:
      'Focus on shadows, ambient fog, and what is implied rather than explicit gore. Sound design should feature deep sub-bass drones and discrete foley.',
  },
  'animal-stories': {
    role: 'Wildlife & Emotional Animal Cinema Director',
    priorities: [
      'Anatomically and visually consistent animals with natural fur, feather textures, and realistic eye reflections.',
      'Naturalistic or intentionally stylized motion matching the story concept without distorted limbs or robotic stiffness.',
      'Emotional character bonds: Heartwarming interactions, loyalty, curiosity, and expressive animal body language.',
      'Believable outdoor or cozy indoor environments with dog-level or cat-level camera perspectives.',
    ],
    technicalAdvice:
      'Ground the camera at animal eye level. Use golden-hour rim lighting on fur and whiskers. Highlight genuine emotional resonance and authentic animal behavior.',
  },
};

/**
 * Builds the comprehensive prompt director prompt for Gemini 3.8 Flash.
 */
export function buildGeminiPromptDirectorInstructions(
  niche: VideoNiche,
  userIdea: string,
  options: {
    durationSec: number;
    aspectRatio: string;
    resolution: string;
    userOverrides?: {
      style?: string;
      camera?: string;
      customStyle?: string;
      characters?: any[];
      environment?: any;
    };
  }
): string {
  const guidance = NICHE_DIRECTOR_GUIDANCE[niche.id] || NICHE_DIRECTOR_GUIDANCE['fruit-stories'];

  const overridesSummary = options.userOverrides
    ? `
NUTZER-STIL- UND REGIEWÜNSCHE (Höchste Priorität für Ästhetik-Details):
- Bevorzugter Stil: ${options.userOverrides.style || 'Standard der Nische'}
- Eigene Stil-Instruktionen: ${options.userOverrides.customStyle || 'Keine'}
- Kamera-Präferenz: ${options.userOverrides.camera || 'Standard der Nische'}
- Spezifizierte Figuren vom Nutzer: ${
        options.userOverrides.characters && options.userOverrides.characters.length > 0
          ? JSON.stringify(options.userOverrides.characters)
          : 'Keine Vorgaben'
      }
- Schauplatz-Details: ${
        options.userOverrides.environment && options.userOverrides.environment.location
          ? JSON.stringify(options.userOverrides.environment)
          : 'Frei passend zur Idee'
      }
`
    : '';

  return `Du bist der offizielle KI-Prompt-Director für die spezialisierte Video-Nische "${niche.name}" bei ShortsCraft AI.
Deine Rolle: ${guidance.role}.

ZIEL:
Transformiere die originale Videoidee des Nutzers in einen extrem präzisen, filmischen und für Google Veo optimierten Videoprompt.

KRITISCHE REGELN:
1. DIE ORIGINALE NUTZERIDEE MUSS INHALTLICH VOLLSTÄNDIG ERHALTEN BLEIBEN:
   - Nutzeridee: "${userIdea.trim()}"
   - Überschreibe oder lösche niemals die Absicht, die Figuren oder den Kern der Nutzeridee!
   - Ergänze die Idee professionell mit den visuellen und filmischen Stärken der Nische "${niche.name}".
   - Falls der Nutzer ausdrücklich einen bestimmten Stil wünscht (z. B. fotorealistisch statt Zeichentrick), respektiere diesen Wunsch absolut.

2. NISCHENSPEZIFISCHE PRIORITÄTEN FÜR "${niche.name}":
${guidance.priorities.map((p, idx) => `   ${idx + 1}. ${p}`).join('\n')}
   Technische Regie-Notiz: ${guidance.technicalAdvice}

3. NISCHENPROFIL-VORGABEN:
- Typische Elemente der Nische: ${niche.typicalCharactersAndObjects.join(', ')}
- Visueller Basis-Stil: ${niche.visualStyle}
- Typischer Kamerastil: ${niche.cameraStyle}
- Storytelling-Regeln: ${niche.storytellingRules.join(' | ')}
- Audio-Regeln: ${niche.audioRules.join(' | ')}
- Unerwünschte Elemente (Negative Guidance): ${niche.negativeElements.join(' | ')}

4. TECHNISCHE VORGABEN:
- Videodauer: genau ${options.durationSec} Sekunden
- Seitenverhältnis: ${options.aspectRatio}
- Auflösung: ${options.resolution}
${overridesSummary}

5. AUSGABEFORMAT:
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt ohne zusätzliche Erläuterungen.
Das JSON-Objekt muss zwingend folgender Struktur entsprechen:

{
  "summaryGerman": "Eine verständliche, 2 bis maximal 3 Sätze lange Zusammenfassung der geplanten Szene auf Deutsch für den Nutzer, inklusive geplanter Stimmung und visueller Highlights.",
  "structuredSpec": {
    "mainCharacters": [
      {
        "name": "Name der Hauptfigur oder des Hauptobjekts",
        "appearance": "Präzise visuelle Beschreibung (Material, Textur, Farben, Kleidung, Ausdruck)",
        "personalityOrRole": "Rolle oder Charaktereigenschaft"
      }
    ],
    "environment": {
      "setting": "Präziser Schauplatz (z.B. rustikale Holzküche, nasse Neon-Metropole, nebliger Nadelwald)",
      "timeOfDay": "Tageszeit oder Lichtsituation",
      "lightingAndAtmosphere": "Lichtstimmung, Beleuchtungswinkel, Schatten, Atmosphäre"
    },
    "narrativeAction": "Konkrete, sichtbare Handlung im Video von Anfang bis Ende",
    "timeline": [
      {
        "timestampSec": "0s - 3s",
        "visual": "Eröffnungsszene / visueller Hook",
        "cameraMovement": "Kamerabewegung (z.B. Low-angle slow push-in)",
        "audioOrSfx": "Soundeffekt oder Audiohinweis"
      },
      {
        "timestampSec": "3s - ${options.durationSec}s",
        "visual": "Höhepunkt und Abschlussaktion",
        "cameraMovement": "Kamerabewegung (z.B. Dynamic tracking)",
        "audioOrSfx": "Soundeffekt oder musikalischer Akzent"
      }
    ],
    "visualStyle": "Filmischer Stil, Rendering, Farbpalette und Tiefenschärfe",
    "cameraDirection": "Genaue Kameraoptik, Linsenwahl, Bewegung und Winkel",
    "lightingStyle": "Lichtquellen, Farbtemperatur, Highlights und Reflexionen",
    "audioAndSoundEffects": {
      "sfx": ["Soundeffekt 1", "Soundeffekt 2"],
      "ambient": "Umgebungsgeräusche / Atmosphäre",
      "dialogueOrVoiceover": "Gesprochener Satz falls passend, sonst leer lassen"
    },
    "continuityRules": [
      "Wichtige Kontinuitätsregel 1 für Veo",
      "Wichtige Kontinuitätsregel 2 für Veo"
    ],
    "avoidElements": [
      "Negative Vorgabe 1 (z.B. no distorted hands)",
      "Negative Vorgabe 2 (z.B. no low-poly artifacts)"
    ]
  }
}`;
}

/**
 * Compiles a clean, highly effective Google Veo prompt from the structured spec.
 * Respects strict prompt boundaries (max 1950 characters) and enforces all 10 areas.
 */
export function compileVeoPromptFromSpec(
  spec: NichePromptStructuredSpec,
  userIdea: string,
  durationSec: number = 15,
  aspectRatio: string = '9:16'
): string {
  const sections: string[] = [];

  // 1. Core Visual Concept & Action (preserving user idea)
  const ideaLead = userIdea?.trim() ? `CONCEPT: ${userIdea.trim()}` : '';
  const actionLine = spec.narrativeAction?.trim() ? `ACTION: ${spec.narrativeAction.trim()}` : '';
  const conceptSection = [ideaLead, actionLine].filter(Boolean).join('\n');
  if (conceptSection) sections.push(conceptSection);

  // 2. Characters & Visual Identity
  if (Array.isArray(spec.mainCharacters) && spec.mainCharacters.length > 0) {
    const charLines = spec.mainCharacters.map((c) => {
      const parts = [c.name];
      if (c.appearance) parts.push(c.appearance);
      if (c.personalityOrRole) parts.push(`role: ${c.personalityOrRole}`);
      return `• ${parts.join(' — ')}`;
    });
    sections.push(`SUBJECTS:\n${charLines.join('\n')}`);
  }

  // 3. Environment & Setting
  if (spec.environment) {
    const envParts = [
      spec.environment.setting ? `Location: ${spec.environment.setting}` : '',
      spec.environment.timeOfDay ? `Time: ${spec.environment.timeOfDay}` : '',
      spec.environment.lightingAndAtmosphere ? `Lighting: ${spec.environment.lightingAndAtmosphere}` : '',
    ].filter(Boolean);
    if (envParts.length > 0) {
      sections.push(`ENVIRONMENT:\n${envParts.join(' | ')}`);
    }
  }

  // 4. Temporal Choreography / Timeline
  if (Array.isArray(spec.timeline) && spec.timeline.length > 0) {
    const timelineLines = spec.timeline.map((t) => {
      const parts = [`[${t.timestampSec}] ${t.visual}`];
      if (t.cameraMovement) parts.push(`Camera: ${t.cameraMovement}`);
      if (t.audioOrSfx) parts.push(`Audio: ${t.audioOrSfx}`);
      return parts.join(' | ');
    });
    sections.push(`CHOREOGRAPHY & TIMELINE:\n${timelineLines.join('\n')}`);
  }

  // 5. Visual Style & Camera Movement
  const styleLines = [
    spec.visualStyle ? `Style: ${spec.visualStyle}` : '',
    spec.cameraDirection ? `Camera: ${spec.cameraDirection}` : '',
    spec.lightingStyle ? `Lighting: ${spec.lightingStyle}` : '',
  ].filter(Boolean);
  if (styleLines.length > 0) {
    sections.push(`CINEMATOGRAPHY:\n${styleLines.join('\n')}`);
  }

  // 6. Audio Design
  if (spec.audioAndSoundEffects) {
    const audioParts: string[] = [];
    if (spec.audioAndSoundEffects.ambient) audioParts.push(`Ambience: ${spec.audioAndSoundEffects.ambient}`);
    if (spec.audioAndSoundEffects.sfx && spec.audioAndSoundEffects.sfx.length > 0) {
      audioParts.push(`SFX: ${spec.audioAndSoundEffects.sfx.join(', ')}`);
    }
    if (spec.audioAndSoundEffects.dialogueOrVoiceover) {
      audioParts.push(`Dialogue: "${spec.audioAndSoundEffects.dialogueOrVoiceover}"`);
    }
    if (audioParts.length > 0) {
      sections.push(`AUDIO DESIGN:\n${audioParts.join(' | ')}`);
    }
  }

  // 7. Negative Guidance / Quality Constraints
  if (Array.isArray(spec.avoidElements) && spec.avoidElements.length > 0) {
    sections.push(`NEGATIVE CONSTRAINTS: Avoid ${spec.avoidElements.join(', ')}`);
  }

  // 8. Technical Parameters
  sections.push(`SPECS: ${aspectRatio} format, ${durationSec}s duration, high cinematic consistency`);

  const rawPrompt = sections.join('\n\n');
  return fitPromptLength(rawPrompt, 1950);
}

/**
 * Validates the Gemini response JSON and builds a safe, complete NichePromptPlan.
 */
export function validateAndCompileNichePromptPlan(
  parsed: any,
  niche: VideoNiche,
  userIdea: string,
  durationSec: number = 15,
  aspectRatio: string = '9:16'
): NichePromptPlan {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Ungültige Antwort von Gemini: Objekt erwartet.');
  }

  const rawSpec = parsed.structuredSpec || {};

  // Validate and sanitize mainCharacters
  const mainCharacters = Array.isArray(rawSpec.mainCharacters)
    ? rawSpec.mainCharacters
        .filter((c: any) => c && typeof c === 'object')
        .map((c: any) => ({
          name: typeof c.name === 'string' && c.name.trim().length > 0 ? c.name.trim().slice(0, 100) : 'Charakter',
          appearance:
            typeof c.appearance === 'string' && c.appearance.trim().length > 0
              ? c.appearance.trim().slice(0, 300)
              : 'Detailliert gerendert passend zur Szene',
          personalityOrRole:
            typeof c.personalityOrRole === 'string' ? c.personalityOrRole.trim().slice(0, 100) : undefined,
        }))
    : [];

  // Fallback characters if empty: infer from typical characters
  if (mainCharacters.length === 0) {
    mainCharacters.push({
      name: niche.typicalCharactersAndObjects[0] || 'Protagonist',
      appearance: `Passend zur Nische ${niche.name} und Idee: ${userIdea.slice(0, 100)}`,
      personalityOrRole: 'Hauptfigur',
    });
  }

  // Validate environment
  const rawEnv = rawSpec.environment || {};
  const environment = {
    setting:
      typeof rawEnv.setting === 'string' && rawEnv.setting.trim().length > 0
        ? rawEnv.setting.trim().slice(0, 200)
        : 'Cinematic Setting passend zur Szene',
    timeOfDay:
      typeof rawEnv.timeOfDay === 'string' && rawEnv.timeOfDay.trim().length > 0
        ? rawEnv.timeOfDay.trim().slice(0, 100)
        : 'Golden hour or cinematic lighting',
    lightingAndAtmosphere:
      typeof rawEnv.lightingAndAtmosphere === 'string' && rawEnv.lightingAndAtmosphere.trim().length > 0
        ? rawEnv.lightingAndAtmosphere.trim().slice(0, 250)
        : 'Dynamische filmische Lichtführung',
  };

  // Validate narrative action
  const narrativeAction =
    typeof rawSpec.narrativeAction === 'string' && rawSpec.narrativeAction.trim().length > 0
      ? rawSpec.narrativeAction.trim().slice(0, 500)
      : userIdea.trim();

  // Validate timeline
  const timeline = Array.isArray(rawSpec.timeline) && rawSpec.timeline.length > 0
    ? rawSpec.timeline
        .filter((t: any) => t && typeof t === 'object')
        .map((t: any, idx: number) => ({
          timestampSec: typeof t.timestampSec === 'string' ? t.timestampSec.slice(0, 20) : `${idx * 5}s - ${(idx + 1) * 5}s`,
          visual: typeof t.visual === 'string' ? t.visual.trim().slice(0, 300) : 'Szenenverlauf',
          cameraMovement: typeof t.cameraMovement === 'string' ? t.cameraMovement.trim().slice(0, 150) : 'Smooth cinematic camera',
          audioOrSfx: typeof t.audioOrSfx === 'string' ? t.audioOrSfx.trim().slice(0, 150) : undefined,
        }))
    : [
        {
          timestampSec: `0s - ${durationSec}s`,
          visual: narrativeAction,
          cameraMovement: niche.cameraStyle.slice(0, 100),
          audioOrSfx: niche.audioRules[0] || 'Atmosphärischer Sound',
        },
      ];

  // Validate visualStyle, cameraDirection, lightingStyle
  const visualStyle =
    typeof rawSpec.visualStyle === 'string' && rawSpec.visualStyle.trim().length > 0
      ? rawSpec.visualStyle.trim().slice(0, 300)
      : niche.visualStyle.slice(0, 250);

  const cameraDirection =
    typeof rawSpec.cameraDirection === 'string' && rawSpec.cameraDirection.trim().length > 0
      ? rawSpec.cameraDirection.trim().slice(0, 250)
      : niche.cameraStyle.slice(0, 200);

  const lightingStyle =
    typeof rawSpec.lightingStyle === 'string' && rawSpec.lightingStyle.trim().length > 0
      ? rawSpec.lightingStyle.trim().slice(0, 250)
      : 'Stimmungsvolle Ausleuchtung mit klaren Akzenten';

  // Validate audioAndSoundEffects
  const rawAudio = rawSpec.audioAndSoundEffects || {};
  const audioAndSoundEffects = {
    sfx: Array.isArray(rawAudio.sfx)
      ? rawAudio.sfx.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim().slice(0, 80))
      : ['Präzise Foley-Effekte'],
    ambient:
      typeof rawAudio.ambient === 'string' && rawAudio.ambient.trim().length > 0
        ? rawAudio.ambient.trim().slice(0, 200)
        : 'Subtile Raum-Atmosphäre',
    dialogueOrVoiceover:
      typeof rawAudio.dialogueOrVoiceover === 'string' && rawAudio.dialogueOrVoiceover.trim().length > 0
        ? rawAudio.dialogueOrVoiceover.trim().slice(0, 200)
        : undefined,
  };

  // Continuity & Avoid elements
  const continuityRules = Array.isArray(rawSpec.continuityRules)
    ? rawSpec.continuityRules.filter((r: any) => typeof r === 'string').map((r: string) => r.trim().slice(0, 150))
    : ['Konsistente Anatomie und Kleidung über alle Sekunden'];

  const avoidElements = Array.isArray(rawSpec.avoidElements) && rawSpec.avoidElements.length > 0
    ? rawSpec.avoidElements.filter((e: any) => typeof e === 'string').map((e: string) => e.trim().slice(0, 100))
    : niche.negativeElements.slice(0, 4);

  const structuredSpec: NichePromptStructuredSpec = {
    mainCharacters,
    environment,
    narrativeAction,
    timeline,
    visualStyle,
    cameraDirection,
    lightingStyle,
    audioAndSoundEffects,
    continuityRules,
    avoidElements,
  };

  // German summary for user preview
  let summaryGerman =
    typeof parsed.summaryGerman === 'string' && parsed.summaryGerman.trim().length > 0
      ? parsed.summaryGerman.trim().slice(0, 500)
      : `Geplante Szene für ${niche.name}: ${narrativeAction.slice(0, 200)}. Stil: ${visualStyle.slice(0, 100)}.`;

  // Compile final Veo prompt
  const veoPrompt = compileVeoPromptFromSpec(structuredSpec, userIdea, durationSec, aspectRatio);

  return {
    nicheId: niche.id,
    nicheName: niche.name,
    userIdea: userIdea.trim(),
    summaryGerman,
    structuredSpec,
    veoPrompt,
    createdAtMillis: Date.now(),
  };
}
