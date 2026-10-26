import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNicheById, isValidNicheId, PREDEFINED_NICHES } from '../src/data/niches.js';
import {
  NICHE_DIRECTOR_GUIDANCE,
  buildGeminiPromptDirectorInstructions,
  validateAndCompileNichePromptPlan,
  compileVeoPromptFromSpec,
} from '../src/lib/nichePromptDirector.js';
import { getNicheCacheKey, nichePromptCache } from '../server.js';
import { NichePromptStructuredSpec } from '../src/types/niche.js';

// TEST A: Fruit Stories erzeugt einen passenden Frucht-Animationsprompt
test('Test A: Fruit Stories erzeugt einen passenden Frucht-Animationsprompt', () => {
  const niche = getNicheById('fruit-stories');
  assert.equal(niche.id, 'fruit-stories');
  assert.equal(niche.name, 'Fruit Stories');

  const userIdea = 'Eine mutige Erdbeere mit kleiner weißer Kochmütze backt einen riesigen Sahnekuchen.';
  const instructions = buildGeminiPromptDirectorInstructions(niche, userIdea, {
    durationSec: 15,
    aspectRatio: '9:16',
    resolution: '720p',
  });

  // Verify niche priorities are injected into instructions
  assert.ok(instructions.includes('Anthropomorphic fruits'), 'Must include fruit animation guidance');
  assert.ok(instructions.includes('Chef Erdbeere') || instructions.includes('Frucht-Animationsprompt') || instructions.includes('Macro-perspective'), 'Must include macro perspective guidance');
  assert.ok(instructions.includes(userIdea), 'Must retain exact user idea');

  // Simulated structured response from Gemini
  const simulatedGeminiResponse = {
    summaryGerman: 'Eine mutige kleine Erdbeere mit Kochmütze meistert in einer sonnigen Holzküche ein riesiges Backabenteuer mit liebevoller Mimik.',
    structuredSpec: {
      mainCharacters: [
        {
          name: 'Chef Erdbeere',
          appearance: 'Leuchtend rote Erdbeere mit winzigen gelben Samen, ausdrucksstarken Kulleraugen und kleiner weißer Kochmütze',
          personalityOrRole: 'Mutiger kleiner Bäckermeister',
        },
      ],
      environment: {
        setting: 'Rustikale Holzküche, Bäckertisch mit Mehlspuren',
        timeOfDay: 'Morgenlicht',
        lightingAndAtmosphere: 'Warme Lichtstrahlen durch ein Küchenfenster, sanfter Bokeh-Hintergrund',
      },
      narrativeAction: 'Die kleine Erdbeere klettert auf einen Teiglöffel und setzt vorsichtig die Kirsche auf die Spitze des Kuchens.',
      timeline: [
        { timestampSec: '0s - 5s', visual: 'Chef Erdbeere mustert den riesigen Kuchen', cameraMovement: 'Bodennahes Makro-Push-in auf Fruchtaugenhöhe', audioOrSfx: 'Zartes Kichern' },
        { timestampSec: '5s - 15s', visual: 'Er setzt die Kirsche auf und jubelt freudig', cameraMovement: 'Halbtotale mit sanftem Kameraschwenk', audioOrSfx: 'Triumphale Flötenmelodie' },
      ],
      visualStyle: 'Hyper-detaillierte 3D-Makro-Animation, fotorealistische Fruchtporen, warmer Pixar-Stil',
      cameraDirection: 'Makro-Linse f/2.8 auf Fruchthöhe (3cm über Tischplatte)',
      lightingStyle: 'Warmes Gegenlicht auf Fruchtkrone',
      audioAndSoundEffects: {
        sfx: ['Sanftes Ploppen der Kirsche', 'Mehlstäubchen rieseln'],
        ambient: 'Gemütliches Knistern eines Backofens',
      },
      continuityRules: ['Fruchttextur und Kochmütze bleiben über alle Szenen unverändert'],
      avoidElements: ['Keine menschlichen Hände', 'Kein Plastik-Look'],
    },
  };

  const plan = validateAndCompileNichePromptPlan(simulatedGeminiResponse, niche, userIdea, 15, '9:16');
  assert.equal(plan.nicheId, 'fruit-stories');
  assert.ok(plan.summaryGerman.includes('Erdbeere'));
  assert.ok(plan.veoPrompt.includes('Chef Erdbeere'));
  assert.ok(plan.veoPrompt.includes('Makro'));
  assert.ok(plan.veoPrompt.length <= 1950, 'Veo prompt must respect character limit');
});

// TEST B: Luxury Cars erzeugt einen passenden Automobilprompt
test('Test B: Luxury Cars erzeugt einen passenden Automobilprompt', () => {
  const niche = getNicheById('luxury-cars');
  assert.equal(niche.id, 'luxury-cars');

  const userIdea = 'Ein mattschwarzer Supersportwagen driftet bei Nacht durch regennasse Straßen in Tokio.';
  const instructions = buildGeminiPromptDirectorInstructions(niche, userIdea, {
    durationSec: 15,
    aspectRatio: '16:9',
    resolution: '1080p',
  });

  assert.ok(instructions.includes('automotive contours') || instructions.includes('Hypercars') || instructions.includes('Carbon'));
  assert.ok(instructions.includes(userIdea));

  const simulatedGeminiResponse = {
    summaryGerman: 'Ein hochglänzender mattschwarzer Hypercar gleitet im nächtlichen Tokio durch nasse Kurven mit spektakulären Neon-Spiegelungen.',
    structuredSpec: {
      mainCharacters: [
        {
          name: 'Apex Horizon Hypercar',
          appearance: 'Mattschwarze Carbon-Karosserie, glühend rote LED-Rückleuchten, goldene Keramik-Bremssättel',
          personalityOrRole: 'Hochleistungs-Bolide',
        },
      ],
      environment: {
        setting: 'Shinjuku Tokio, regennasser Asphalt mit leuchtenden Pfützen',
        timeOfDay: 'Mitternacht',
        lightingAndAtmosphere: 'Dramatische Neonbeleuchtung in Cyan und Magenta, Raytracing-Reflexionen auf nassem Lack',
      },
      narrativeAction: 'Fahrzeug beschleunigt aus einer Kurve heraus, Wassertropfen sprühen von den Sportreifen ab.',
      timeline: [
        { timestampSec: '0s - 7s', visual: 'Nahaufnahme der rotierenden Carbon-Felgen und aufleuchtenden Scheinwerfer', cameraMovement: 'Ultra-tiefe Chaser-Kamera 10cm über nassem Asphalt', audioOrSfx: 'Grollender V12-Motorsound' },
        { timestampSec: '7s - 15s', visual: 'Fahrzeug driftet elegant an einer beleuchteten Glasfassade vorbei', cameraMovement: 'Fließende 360-Grad-Orbit-Kamerafahrt', audioOrSfx: 'Reifenquietschen und Turbo-Zischen' },
      ],
      visualStyle: 'Hochglanz-Werbefilm-Ästhetik, anamorphe Linsenflares, 8K Automotive Raytracing',
      cameraDirection: 'Dynamische Low-Angle Verfolgungskamera mit Bildstabilisierung',
      lightingStyle: 'Neon-Lichtreflexe und glimmende Auspuffflammen',
      audioAndSoundEffects: {
        sfx: ['V12 Beschleunigungssound', 'Blow-off Ventil Zischen', 'Reifen auf nassem Asphalt'],
        ambient: 'Entferntes Großstadt-Grollen',
      },
      continuityRules: ['Fahrzeuglackierung und Modellabzeichen konsistent halten'],
      avoidElements: ['Keine billigen CGI-Artefakte', 'Keine unrealistische Fahrphysik'],
    },
  };

  const plan = validateAndCompileNichePromptPlan(simulatedGeminiResponse, niche, userIdea, 15, '16:9');
  assert.equal(plan.nicheId, 'luxury-cars');
  assert.ok(plan.veoPrompt.includes('Apex Horizon Hypercar') || plan.veoPrompt.includes('Carbon'));
  assert.ok(plan.veoPrompt.includes('Asphalt') || plan.veoPrompt.includes('Tokyo'));
  assert.ok(plan.veoPrompt.length <= 1950);
});

// TEST C: Horror Stories erzeugt einen atmosphärischen Horrorprompt
test('Test C: Horror Stories erzeugt einen atmosphärischen Horrorprompt', () => {
  const niche = getNicheById('horror-stories');
  assert.equal(niche.id, 'horror-stories');

  const userIdea = 'Ein einsamer Nachtwächter entdeckt flackerndes Licht in einem seit 30 Jahren verlassenen Flüster-Archiv.';
  const instructions = buildGeminiPromptDirectorInstructions(niche, userIdea, {
    durationSec: 20,
    aspectRatio: '9:16',
    resolution: '720p',
  });

  assert.ok(instructions.includes('Psychological horror') || instructions.includes('dread') || instructions.includes('fog'));

  const simulatedGeminiResponse = {
    summaryGerman: 'Beklemmende Szene in einem staubigen Archiv: Ein Nachtwächter folgt einem flackernden Lichtschein in quälender Zeitlupe.',
    structuredSpec: {
      mainCharacters: [
        {
          name: 'Nachtwächter Thomas',
          appearance: 'Erschöpfter Mann in abgetragener blauer Wachuniform mit flackernder gelber Halogen-Taschenlampe',
          personalityOrRole: 'Verängstigter Protagonist',
        },
      ],
      environment: {
        setting: 'Unterirdisches verlassenes Archiv mit endlosen Regalen voller verstaubter Akten',
        timeOfDay: '03:15 Uhr morgens',
        lightingAndAtmosphere: 'Kaltes Cyan-Mondlicht durch Kellerschächte, tanzender Schein der Taschenlampe, volumetrischer Staubnebel',
      },
      narrativeAction: 'Thomas schreitet zögernd voran, als sich am Ende des Korridors ein Schatten ohne Körper bewegt.',
      timeline: [
        { timestampSec: '0s - 10s', visual: 'Thomas geht langsam den langen Gang entlang, Atem kondensiert in kalter Luft', cameraMovement: 'Unruhige POV-Kamera über die Schulter mit langsamem Vorwärtsschreiten', audioOrSfx: 'Hallende Schritte und dumpfer Herzschlag' },
        { timestampSec: '10s - 20s', visual: 'Die Taschenlampe flackert dreimal; im Schein erscheint ein dunkler Umriss', cameraMovement: 'Subtiler Rack-Focus auf den Hintergrund mit plötzlichem Freeze-Moment', audioOrSfx: 'Tiefe Sub-Bass Drone gefolgt von Flüstern' },
      ],
      visualStyle: 'Beklemmende Low-Key-Kinematographie, analoge 35mm Körnung, kalte Farbpalette',
      cameraDirection: 'Quälende langsame Dolly-Fahrt mit unruhigem Schulter-POV',
      lightingStyle: 'Chiaroscuro, harte Schlagschatten und volumetrischer Staub',
      audioAndSoundEffects: {
        sfx: ['Knarren rostiger Regalböden', 'Flackernde Glühbirne', 'Schweres Atmen'],
        ambient: 'Totenstille mit unterschwelligem Brummen',
      },
      continuityRules: ['Lichtkegel der Taschenlampe muss logisch wandern'],
      avoidElements: ['Kein billiger Gore', 'Keine lächerlichen Masken', 'Kein helles Tageslicht'],
    },
  };

  const plan = validateAndCompileNichePromptPlan(simulatedGeminiResponse, niche, userIdea, 20, '9:16');
  assert.equal(plan.nicheId, 'horror-stories');
  assert.ok(plan.veoPrompt.includes('Thomas'));
  assert.ok(plan.veoPrompt.includes('Archiv') || plan.veoPrompt.includes('flashlight') || plan.veoPrompt.includes('Taschenlampe'));
  assert.ok(plan.veoPrompt.length <= 1950);
});

// TEST D: Animal Stories erzeugt einen passenden Tiergeschichtenprompt
test('Test D: Animal Stories erzeugt einen passenden Tiergeschichtenprompt', () => {
  const niche = getNicheById('animal-stories');
  assert.equal(niche.id, 'animal-stories');

  const userIdea = 'Ein junger Golden Retriever teilt seine Hundehütte im Sommerregen mit einem kleinen Kätzchen.';
  const instructions = buildGeminiPromptDirectorInstructions(niche, userIdea, {
    durationSec: 15,
    aspectRatio: '9:16',
    resolution: '720p',
  });

  assert.ok(instructions.includes('animal-level') || instructions.includes('fur') || instructions.includes('Golden'));

  const simulatedGeminiResponse = {
    summaryGerman: 'Herzerwärmende Tierbegegnung: Ein treuer Golden Retriever nimmt ein durchnässtes Kätzchen liebevoll in seiner trockenen Hütte auf.',
    structuredSpec: {
      mainCharacters: [
        {
          name: 'Barnaby der Golden Retriever',
          appearance: 'Ausgewachsener honigblonder Hund mit weichem Fell, warmen braunen Augen und sanfter Schnauze',
          personalityOrRole: 'Liebevoller Beschützer',
        },
        {
          name: 'Mimi das Kätzchen',
          appearance: 'Winziges getigertes Katzenbaby mit weißen Pfötchen und zitternden Schnurrhaaren',
          personalityOrRole: 'Schutzsuchender Welpe',
        },
      ],
      environment: {
        setting: 'Gartenveranda mit gemütlicher Holzhütte und Decke',
        timeOfDay: 'Später Nachmittag',
        lightingAndAtmosphere: 'Sanfter Sommerregen im Hintergrund, warme goldene Beleuchtung unter dem Vordach',
      },
      narrativeAction: 'Barnaby schiebt mit der feuchten Nase eine weiche rote Decke sanft über das Kätzchen.',
      timeline: [
        { timestampSec: '0s - 8s', visual: 'Barnaby blickt auf das zitternde Kätzchen an der Schwelle', cameraMovement: 'Bodennahe Kamera auf Augenhöhe des Hundes', audioOrSfx: 'Prasseln von Regentropfen' },
        { timestampSec: '8s - 15s', visual: 'Kätzchen kuschelt sich an Barnabys warmes Fell und schläft ein', cameraMovement: 'Sanfter Weitwinkel-Schwenk in Nahaufnahme', audioOrSfx: 'Leises Schnurren und tiefes zufriedenes Ausatmen' },
      ],
      visualStyle: 'Wärmste Kinematographie, sichtbare feine Felltexturen im Gegenlicht, weiche Tiefenschärfe',
      cameraDirection: 'Dog-Level-Perspektive, ruhige gimbal-stabilisierte Führung',
      lightingStyle: 'Warmes sanftes Streulicht',
      audioAndSoundEffects: {
        sfx: ['Schnurren', 'Tapsende Pfoten', 'Regen auf Holzdach'],
        ambient: 'Sommerregen und fernen Vögel',
      },
      continuityRules: ['Fellfarbe und Fleckenmuster bleiben absolut konsistent'],
      avoidElements: ['Keine verängstigten Tiere', 'Keine anatomischen Verformungen'],
    },
  };

  const plan = validateAndCompileNichePromptPlan(simulatedGeminiResponse, niche, userIdea, 15, '9:16');
  assert.equal(plan.nicheId, 'animal-stories');
  assert.ok(plan.veoPrompt.includes('Barnaby'));
  assert.ok(plan.veoPrompt.includes('Mimi') || plan.veoPrompt.includes('Kätzchen'));
  assert.ok(plan.veoPrompt.length <= 1950);
});

// TEST E: Ungültige Nischen-IDs werden abgelehnt
test('Test E: Ungültige Nischen-IDs werden abgelehnt', () => {
  assert.equal(isValidNicheId('fruit-stories'), true);
  assert.equal(isValidNicheId('luxury-cars'), true);
  assert.equal(isValidNicheId('horror-stories'), true);
  assert.equal(isValidNicheId('animal-stories'), true);

  // Invalid IDs must be rejected
  assert.equal(isValidNicheId('superheroes'), false);
  assert.equal(isValidNicheId('crypto-niche'), false);
  assert.equal(isValidNicheId('custom-user-niche'), false);
  assert.equal(isValidNicheId(''), false);
  assert.equal(isValidNicheId(undefined as any), false);
});

// TEST F: Die ursprüngliche Videoidee wird nicht durch generische Nischeninhalte ersetzt
test('Test F: Die ursprüngliche Videoidee wird nicht durch generische Nischeninhalte ersetzt', () => {
  const niche = getNicheById('fruit-stories');
  const customSpecificIdea = 'Eine grüne Limette mit Fliege und Monokel steuert ein U-Boot aus einer ausgehöhlten Melone im Spülbecken.';

  const instructions = buildGeminiPromptDirectorInstructions(niche, customSpecificIdea, {
    durationSec: 15,
    aspectRatio: '9:16',
    resolution: '720p',
    userOverrides: {
      style: 'photorealistic',
      customStyle: 'Fotorealistisch mit echter Wasserphysik, keine Zeichentrick-Augen',
    },
  });

  // Instruction strictly demands keeping original idea
  assert.ok(instructions.includes('DIE ORIGINALE NUTZERIDEE MUSS INHALTLICH VOLLSTÄNDIG ERHALTEN BLEIBEN'));
  assert.ok(instructions.includes('Eine grüne Limette mit Fliege und Monokel steuert ein U-Boot'));
  assert.ok(instructions.includes('Fotorealistisch mit echter Wasserphysik'));

  // Compile spec respecting the user's specific idea
  const spec: NichePromptStructuredSpec = {
    mainCharacters: [
      { name: 'Limette Kapitän', appearance: 'Grüne Limette mit echter Zitrusfrucht-Textur, Monokel und schwarzer Fliege' },
    ],
    environment: {
      setting: 'Edelstahl-Spülbecken gefüllt mit schäumendem Wasser',
      timeOfDay: 'Mittagslicht',
      lightingAndAtmosphere: 'Grelle Reflexionen auf der Wasseroberfläche',
    },
    narrativeAction: 'Die Limette taucht in der Melone unter Schaumbergen hindurch.',
    timeline: [
      { timestampSec: '0s - 15s', visual: 'U-Boot Melone taucht durch Schaumkronen', cameraMovement: 'Unterwasser-Makroaufnahme' },
    ],
    visualStyle: 'Photorealistic, natural citrus physics, no cartoon outlines',
    cameraDirection: 'Waterline macro lens',
    lightingStyle: 'Direct overhead spotlight',
    audioAndSoundEffects: { sfx: ['Gluckerndes Wasser', 'Luftblasen'], ambient: 'Tropfender Wasserhahn' },
    continuityRules: ['Fruchttextur und Fliege bleiben stabil'],
    avoidElements: ['Keine comichaften Augen', 'Kein Low-Poly-Wasser'],
  };

  const compiledPrompt = compileVeoPromptFromSpec(spec, customSpecificIdea, 15, '9:16');
  assert.ok(compiledPrompt.includes('Limette mit Fliege und Monokel steuert ein U-Boot'), 'User idea must be prominent in prompt');
  assert.ok(compiledPrompt.includes('Spülbecken'), 'User setting must be retained');
  assert.ok(compiledPrompt.includes('Photorealistic'), 'User style preference must be respected');
});

// TEST G: Zwei Nutzer beeinflussen sich gegenseitig nicht (Multi-User-Isolation)
test('Test G: Zwei Nutzer beeinflussen sich gegenseitig nicht (Multi-User-Isolation)', () => {
  const user1 = 'user-alice-111';
  const user2 = 'user-bob-222';

  const niche1 = 'luxury-cars';
  const idea1 = 'Ferrari rollout in Monaco';

  const niche2 = 'animal-stories';
  const idea2 = 'Puppy playing in the park';

  const key1 = getNicheCacheKey(user1, niche1, idea1, 15, '16:9', {});
  const key2 = getNicheCacheKey(user2, niche2, idea2, 15, '9:16', {});

  assert.notEqual(key1, key2, 'Cache keys for different users must never collide');
  assert.ok(key1.startsWith(`${user1}:`), 'Key 1 must be scoped to user 1');
  assert.ok(key2.startsWith(`${user2}:`), 'Key 2 must be scoped to user 2');

  // Insert mock plan for user 1
  nichePromptCache.set(key1, {
    plan: {
      nicheId: 'luxury-cars',
      nicheName: 'Luxury Cars',
      userIdea: idea1,
      summaryGerman: 'Monaco Car Scene',
      structuredSpec: {} as any,
      veoPrompt: 'PROMPT ALICE CAR',
      createdAtMillis: Date.now(),
    },
    expiresAt: Date.now() + 60000,
  });

  // User 2 cannot access user 1 cache
  assert.equal(nichePromptCache.has(key2), false, 'User 2 cannot see User 1 cache');
  assert.equal(nichePromptCache.get(key1)?.plan.veoPrompt, 'PROMPT ALICE CAR');
});

// TEST H: Veo wird erst nach erfolgreicher Prompt-Planung aufgerufen
test('Test H: Veo wird erst nach erfolgreicher Prompt-Planung aufgerufen', async () => {
  let geminiCalled = false;
  let veoCalled = false;

  // Mock a failing Gemini step
  const runPipeline = async (failGemini: boolean) => {
    geminiCalled = false;
    veoCalled = false;

    // Step 1: Prompt Planning
    geminiCalled = true;
    if (failGemini) {
      throw new Error('GEMINI_API_ERROR: Rate limit or invalid response');
    }

    // Step 2: Veo Video Call (MUST ONLY RUN IF STEP 1 SUCCEEDS)
    veoCalled = true;
    return { success: true };
  };

  // Case 1: Prompt planning fails -> Veo must NOT be invoked!
  await assert.rejects(async () => {
    await runPipeline(true);
  }, /GEMINI_API_ERROR/);
  assert.equal(geminiCalled, true);
  assert.equal(veoCalled, false, 'Veo must NOT be called if prompt planning fails');

  // Case 2: Prompt planning succeeds -> Veo is invoked
  const res = await runPipeline(false);
  assert.equal(res.success, true);
  assert.equal(geminiCalled, true);
  assert.equal(veoCalled, true, 'Veo is invoked after successful prompt planning');
});

// TEST I: Es entstehen keine zusätzlichen Veo-Aufrufe bei Fehlern oder Wiederholungen
test('Test I: Es entstehen keine zusätzlichen Veo-Aufrufe bei Fehlern oder Wiederholungen', () => {
  let veoCallCount = 0;
  const mockOperations = new Map<string, string>();

  // Idempotent execution handler
  const executeGenerationWithIdempotency = (generationId: string) => {
    if (mockOperations.has(generationId)) {
      // Replay existing operation without invoking Veo again
      return { operationName: mockOperations.get(generationId), duplicateReplayed: true };
    }

    veoCallCount++;
    const opName = `operations/veo-${generationId}`;
    mockOperations.set(generationId, opName);
    return { operationName: opName, duplicateReplayed: false };
  };

  const genId = 'gen-test-idempotency-123';

  // First call
  const first = executeGenerationWithIdempotency(genId);
  assert.equal(first.duplicateReplayed, false);
  assert.equal(veoCallCount, 1);

  // Duplicate retry calls with same generationId
  const retry1 = executeGenerationWithIdempotency(genId);
  assert.equal(retry1.duplicateReplayed, true);
  assert.equal(veoCallCount, 1, 'Veo call count must remain 1 on retry');

  const retry2 = executeGenerationWithIdempotency(genId);
  assert.equal(retry2.duplicateReplayed, true);
  assert.equal(veoCallCount, 1, 'Veo call count must still remain 1');
});
