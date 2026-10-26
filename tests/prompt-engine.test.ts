import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateVeoPrompt,
  buildCharactersSection,
  buildScenesSection,
  buildAudioSection,
  fitPromptLength,
} from '../src/lib/promptEngine.js';
import { CreateVideoFormState } from '../src/types/workflow.js';

// =========================================================================
// TEST SUITE: SHORTSCRAFT AI VEO PROMPT ENGINE COMPREHENSIVE TESTS (1 - 7)
// =========================================================================

test('Test 1: Simple idea — no phantom characters hallucinated', () => {
  const form: CreateVideoFormState = {
    idea: 'A strawberry eats an apple.',
    characters: [],
    environment: { location: '' },
    scenes: [],
    style: 'cinematic',
    camera: 'auto',
    audio: { enableAudio: false },
    settings: {
      aspectRatio: '9:16',
      durationSec: 15,
      resolution: '720p',
      model: 'veo-3.1-fast-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  assert.ok(result.prompt.includes('strawberry'));
  assert.ok(result.prompt.includes('apple'));
  // Ensure no unrequested characters like banana, car, human are injected
  assert.strictEqual(result.prompt.includes('banana'), false);
  assert.strictEqual(result.prompt.includes('car'), false);
  assert.strictEqual(result.prompt.includes('human'), false);
  assert.ok(result.charCount <= 1950);
});

test('Test 2: Multiple characters with attributes are all preserved', () => {
  const form: CreateVideoFormState = {
    idea: 'A fruit triathlon championship race.',
    characters: [
      {
        id: 'c1',
        name: 'Strawberry Speedster',
        appearance: 'bright red with gold racing stripes',
        personality: 'hyperactive and determined',
        clothing: 'tiny green sweatband',
      },
      {
        id: 'c2',
        name: 'Banana Rocket',
        appearance: 'ripe yellow with aerodynamic peel',
        personality: 'cocky veteran racer',
        clothing: 'dark sunglasses',
      },
      {
        id: 'c3',
        name: 'Apple Goliath',
        appearance: 'giant polished granny smith',
        personality: 'calm powerhouse',
        clothing: 'heavy lifting belt',
      },
    ],
    environment: {
      location: 'Olympic Supermarket Produce Aisle',
      timeOfDay: 'Midnight after closing',
      weatherOrAtmosphere: 'Electrifying stadium ambience',
    },
    scenes: [],
    style: '3d-animation',
    camera: 'tracking-shot',
    audio: { enableAudio: false },
    settings: {
      aspectRatio: '9:16',
      durationSec: 30,
      resolution: '720p',
      model: 'veo-3.1-fast-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  assert.ok(result.prompt.includes('Strawberry Speedster'));
  assert.ok(result.prompt.includes('Banana Rocket'));
  assert.ok(result.prompt.includes('Apple Goliath'));
  assert.ok(result.prompt.includes('sweatband'));
  assert.ok(result.prompt.includes('sunglasses'));
  assert.ok(result.prompt.includes('heavy lifting belt'));
  assert.ok(result.prompt.includes('Olympic Supermarket'));
  assert.ok(result.charCount <= 1950);
});

test('Test 3: Multiple scenes retain strict chronological sequence', () => {
  const form: CreateVideoFormState = {
    idea: 'Supermarket fruit chase.',
    characters: [],
    environment: { location: 'Supermarket' },
    scenes: [
      {
        id: 's1',
        sceneNumber: 1,
        description: 'Strawberry enters the supermarket entrance.',
        action: 'Strawberry looks around nervously.',
      },
      {
        id: 's2',
        sceneNumber: 2,
        description: 'Banana challenges Strawberry to a high-speed sprint.',
        dialogue: 'Eat my peel, berry!',
      },
      {
        id: 's3',
        sceneNumber: 3,
        description: 'They race through the cereal and snack aisles.',
        action: 'Cereal boxes topple over as they drift through corners.',
      },
      {
        id: 's4',
        sceneNumber: 4,
        description: 'Strawberry slides across checkout register #4 to win.',
        dialogue: 'First place is sweet!',
      },
    ],
    style: 'cartoon',
    camera: 'cinematic',
    audio: { enableAudio: false },
    settings: {
      aspectRatio: '9:16',
      durationSec: 25,
      resolution: '720p',
      model: 'veo-3.1-fast-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  const idx1 = result.prompt.indexOf('Scene 1: Strawberry enters the supermarket');
  const idx2 = result.prompt.indexOf('Scene 2: Banana challenges Strawberry');
  const idx3 = result.prompt.indexOf('Scene 3: They race through the cereal');
  const idx4 = result.prompt.indexOf('Scene 4: Strawberry slides across checkout');

  assert.ok(idx1 !== -1, 'Scene 1 must be present');
  assert.ok(idx2 !== -1, 'Scene 2 must be present');
  assert.ok(idx3 !== -1, 'Scene 3 must be present');
  assert.ok(idx4 !== -1, 'Scene 4 must be present');
  assert.ok(idx1 < idx2 && idx2 < idx3 && idx3 < idx4, 'Scenes must remain in strict chronological order');
});

test('Test 4: Audio and Dialogue are cleanly separated from visual action', () => {
  const form: CreateVideoFormState = {
    idea: 'Cyberpunk street vendor making ramen.',
    characters: [],
    environment: { location: 'Neo Tokyo Alley', timeOfDay: 'Rainy Night' },
    scenes: [
      {
        id: 's1',
        sceneNumber: 1,
        description: 'Chef pours glowing neon broth into a bowl.',
        action: 'Steam rises into the rain.',
      },
    ],
    style: 'cinematic',
    camera: 'close-up',
    audio: {
      enableAudio: true,
      dialogue: "Order up! Extra spice for tonight's run.",
      soundEffects: 'Sizzling wok, neon buzzing, rain droplets splashing on metal',
      ambientSound: 'Distant hovercar traffic and synth city chatter',
      musicMood: 'Lo-fi cyberpunk beat with deep bass groove',
    },
    settings: {
      aspectRatio: '9:16',
      durationSec: 15,
      resolution: '720p',
      model: 'veo-3.1-fast-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  assert.ok(result.prompt.includes('AUDIO DESIGN:'));
  assert.ok(result.prompt.includes('Spoken Dialogue: "Order up! Extra spice for tonight\'s run."'));
  assert.ok(result.prompt.includes('SFX: Sizzling wok'));
  assert.ok(result.prompt.includes('Ambience: Distant hovercar'));
  assert.ok(result.prompt.includes('Score / Mood: Lo-fi cyberpunk'));

  // Ensure Audio section is distinct from VISUAL STYLE and CAMERA sections
  const audioIndex = result.prompt.indexOf('AUDIO DESIGN:');
  const visualIndex = result.prompt.indexOf('VISUAL STYLE');
  const cameraIndex = result.prompt.indexOf('CAMERA & MOTION');

  assert.ok(audioIndex !== -1);
  assert.ok(visualIndex !== -1);
  assert.ok(cameraIndex !== -1);
  assert.notStrictEqual(audioIndex, visualIndex);
});

test('Test 5: Missing optional fields work smoothly with sensible defaults', () => {
  const form: CreateVideoFormState = {
    idea: 'A simple magical floating lantern drifting into misty mountains.',
    characters: [],
    environment: { location: '' },
    scenes: [],
    style: 'cinematic',
    camera: 'auto',
    audio: { enableAudio: false },
    settings: {
      aspectRatio: '9:16',
      durationSec: 15,
      resolution: '720p',
      model: 'veo-3.1-fast-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  assert.ok(result.prompt.length > 50, 'Prompt should have substantial content');
  assert.ok(result.prompt.includes('magical floating lantern'));
  assert.ok(result.prompt.includes('Cinematic 35mm film aesthetic'));
  assert.ok(result.prompt.includes('Aspect Ratio: 9:16'));
  assert.strictEqual(result.prompt.includes('undefined'), false);
  assert.strictEqual(result.prompt.includes('null'), false);
});

test('Test 6: Very long user inputs strictly respect the <= 2000 backend limit', () => {
  const massiveParagraph = 'Extremely detailed high-speed chaotic chase with hundreds of particles flying everywhere. '.repeat(40);
  const form: CreateVideoFormState = {
    idea: massiveParagraph,
    characters: [
      {
        id: 'c1',
        name: 'Super Long Character Name With Lots Of Superfluous Descriptions '.repeat(10),
        appearance: 'Detailed appearance with infinite adjectives and descriptive phrases '.repeat(10),
      },
    ],
    environment: {
      location: 'An endless procedural neon corridor stretching to infinity '.repeat(10),
      timeOfDay: 'Constant twilight with fractal rainbows '.repeat(5),
      weatherOrAtmosphere: 'Dense volumetric fog with quantum lightning strikes '.repeat(5),
    },
    scenes: [
      {
        id: 's1',
        sceneNumber: 1,
        description: 'First scene with incredible verbosity and endless prose '.repeat(10),
      },
    ],
    style: 'photorealistic',
    customStyleInstructions: 'Ultra crisp rendering instructions repeated multiple times '.repeat(10),
    camera: 'cinematic',
    customCameraInstructions: 'Complex multi-axis rotational camera moves '.repeat(10),
    audio: {
      enableAudio: true,
      dialogue: 'Long speech by the protagonist detailing their entire backstory '.repeat(5),
      soundEffects: 'Endless explosions and sound effects '.repeat(5),
    },
    settings: {
      aspectRatio: '9:16',
      durationSec: 60,
      resolution: '1080p',
      model: 'veo-3.1-generate-preview',
    },
  };

  const result = generateVeoPrompt(form);

  assert.ok(result.charCount <= 1950, `Prompt length ${result.charCount} must be <= 1950 (safe backend limit 2000)`);
  assert.ok(result.prompt.length <= 1950);
});

test('Test 7: Backend validation constraints and parameter compatibility', () => {
  // Test valid models, aspect ratios, and durations supported by server.ts
  const allowedModels = ['veo-3.1-fast-generate-preview', 'veo-3.1-generate-preview', 'veo-2.0-generate-001'];
  const allowedAspectRatios = ['9:16', '16:9'];
  const allowedResolutions = ['720p', '1080p'];

  for (const m of allowedModels) {
    for (const ar of allowedAspectRatios) {
      for (const res of allowedResolutions) {
        const form: CreateVideoFormState = {
          idea: 'Valid test prompt concept',
          characters: [],
          environment: { location: 'Studio' },
          scenes: [],
          style: 'cinematic',
          camera: 'auto',
          audio: { enableAudio: false },
          settings: {
            aspectRatio: ar as any,
            durationSec: 15,
            resolution: res as any,
            model: m as any,
          },
        };

        const result = generateVeoPrompt(form);
        assert.ok(result.prompt.includes(`Aspect Ratio: ${ar}`));
        assert.ok(result.prompt.includes(`Target Resolution: ${res}`));
      }
    }
  }
});
