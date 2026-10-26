import { VideoNiche } from '../types/niche';

/**
 * Centrally configured, predetermined video niches for Veyro.ai.
 * 
 * CRITICAL ARCHITECTURAL RULE:
 * Users CANNOT create, edit, or delete niches.
 * Only developers add or modify niches directly in this configuration file.
 */

function deepFreeze<T>(obj: T): T {
  if (obj && typeof obj === 'object') {
    Object.freeze(obj);
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val && typeof val === 'object' && !Object.isFrozen(val)) {
        deepFreeze(val);
      }
    }
  }
  return obj;
}

const RAW_NICHES: VideoNiche[] = [
  {
    id: 'fruit-stories',
    name: 'Fruit Stories',
    tagline: 'Lebendige Miniatur-Früchte in dramatischen Küchen-Abenteuern',
    description:
      'Emotionale, witzige und packende Kurzgeschichten aus der Makro-Perspektive von lebendigen Früchten mit ausdrucksstarken Gesichtern, Mini-Kochmützen und winzigen Requisiten.',
    previewImage:
      'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80',
    previewImageUrl:
      'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80',
    icon: '🍓',
    badge: 'Viraler TikTok Trend',
    accent: {
      color: 'rose',
      border: 'border-rose-200 hover:border-rose-400',
      bgSoft: 'bg-rose-50 text-rose-700',
      gradient: 'from-rose-500 to-amber-500',
      icon: '🍓',
    },
    // Section 4: Specifications for Future Specialized Prompt Engine
    visualStyle:
      'Hyper-detaillierte Makro-Kinematographie mit fotorealistischen Texturen (feuchte Poren, Fruchtfleisch, winzige Samen), warmer Küchen-Lichtstimmung, sanfter Tiefenschärfe (f/2.8 Bokeh) und satten Farben.',
    typicalCharactersAndObjects: [
      'Chef Erdbeere (mit kleiner weißer Kochmütze & Holzlöffel)',
      'Banana Racer (aerodynamische gelbe Schale, Schutzbrille)',
      'Heidelbeer-Zwillinge (schelmische Gehilfen)',
      'Zitrone der Weise (runzlige Schale, Monokel)',
      'Miniatur-Küchenutensilien (Zahnstocher-Schwerter, Kronkorken-Schalen, Teelöffel-Katapulte)',
    ],
    cameraStyle:
      'Bodennahe Makro-Kamera auf Augenhöhe der Früchte, weiche Push-Ins bei emotionalen Reaktionen, dynamische Verfolgungsfahrten bei Küchenrennen.',
    storytellingRules: [
      'Klarer Hook in Sekunde 0-2 (z. B. Erdbeere steht vor einer riesigen Rührschüssel)',
      'Großes Problem in kleiner Welt (Kuchen droht zu verbrennen oder Zutat fehlt)',
      'Unerwartete Pointe oder herzerwärmender Triumph am Ende',
    ],
    audioRules: [
      'Niedliche, ausdrucksstarke Fruchtdialoge mit hoher, charmanter Intonation',
      'Makro-Soundeffekte: Klickende Fruchtsamen, zischender Ofendampf, platschende Sahnetupfer',
      'Beschwingte, orchestrale oder spielerische Akustik-Hintergrundmusik',
    ],
    negativeElements: [
      'Keine menschlichen Hände oder Gesichter, die die Immersion brechen',
      'Kein unnatürliches Plastik-Aussehen (keine Low-Poly-Animation)',
      'Keine statischen, bewegungslosen Szenen ohne Mimik',
    ],
    sampleIdeas: [
      {
        title: 'Der perfekte Erdbeerkuchen',
        hook: 'Eine mutige Erdbeere versucht, den höchsten Kuchen der Bäckerei zu verzieren.',
        promptSnippet:
          'Eine winzige Erdbeere mit kleiner weißer Kochmütze balanciert vorsichtig auf einem hölzernen Schneidebrett und versucht, einen perfekten Sahnekuchen zu vollenden.',
      },
      {
        title: 'Das große Kühlschrank-Rennen',
        hook: 'Wenn das Licht ausgeht, verwandelt sich das Gemüsefach in eine Formel-1-Strecke.',
        promptSnippet:
          'Eine aufgeregte Zitrone und eine sportliche Banane rasen auf winzigen Rollschuhen durch ein frostig beleuchtetes Kühlschrankregal.',
      },
      {
        title: 'Die Rettung der Blaubeere',
        hook: 'Eine kleine Blaubeere rollt vom Küchentisch und wird im letzten Moment gerettet.',
        promptSnippet:
          'Dramatische Zeitlupenaufnahme: Eine runde Blaubeere rollt auf die Tischkante zu, während Chef Erdbeere mit ausgestrecktem Holzlöffel hechtet.',
      },
    ],
    defaultDurationSec: 15,
  },
  {
    id: 'luxury-cars',
    name: 'Luxury Cars',
    tagline: 'High-End Supersportwagen & nächtliche Cinema-Rollouts',
    description:
      'Filmreife Automobil-Ästhetik: Exklusive Hypercars in goldenem Sonnenuntergangslicht, neonbeleuchtete Nachtfahrten durch Metropolen und spektakuläre Detailaufnahmen von Carbon & Lack.',
    previewImage:
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
    previewImageUrl:
      'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80',
    icon: '🏎️',
    badge: 'High CPM & Prestige',
    accent: {
      color: 'amber',
      border: 'border-amber-200 hover:border-amber-400',
      bgSoft: 'bg-amber-50 text-amber-700',
      gradient: 'from-amber-500 to-orange-600',
      icon: '🏎️',
    },
    // Section 4: Specifications for Future Specialized Prompt Engine
    visualStyle:
      'Hochglanz-Commercial-Ästhetik, anamorphen Linsenflares, spiegelnde Regentropfen auf makellosem Metallic-Lack, sichtbare Carbon-Webung, Raytracing-Reflexionen von Neonwerbungen.',
    typicalCharactersAndObjects: [
      'Mattschwarzer Hypercar mit aktiver Aerodynamik',
      'Klassischer Vintage 1960er Roadster in British Racing Green',
      'Futuristischer Elektro-Sportler mit durchgehendem LED-Lichtband',
      'Wet Asphalt, beleuchtete Tunnelkurven, verlassene Hangars',
      'Präzise Felgen-Close-ups mit glühenden Carbon-Keramik-Bremsscheiben',
    ],
    cameraStyle:
      'Fließende Russian-Arm-Kamerafahrten knapp über dem Asphalt, dynamischer Orbit-Schwenk um das stehende Fahrzeug, dramatischer Low-Angle Hero-Shot mit Zoom-Out.',
    storytellingRules: [
      'Hook: Majestätischer Start des Motors mit aufleuchtenden Tagfahrlichtern im Dunkeln',
      'Pacing: Steigerung von edlen Detailaufnahmen zu rasanter Kurvenbeschleunigung',
      'Abschluss: Statussymbol-Silhouette im Gegenlicht der Skyline',
    ],
    audioRules: [
      'Tieffrequentes V8/V12-Grollen mit feinem Turbolader-Pfeifen',
      'Reifenschlupf auf nassem Asphalt, metallisches Schalten der Doppelkupplung',
      'Basslastiger Synthwave- oder epischer Trap-Beat mit Premium-Vibe',
    ],
    negativeElements: [
      'Keine billigen Spielzeugauto-Proportionen',
      'Keine verschwommenen Kennzeichen oder verformten Räder',
      'Keine ruckartigen oder amateurhaften Handkamerawackler',
    ],
    sampleIdeas: [
      {
        title: 'Midnight Tokyo Hypercar Run',
        hook: 'Ein mattschwarzer Supersportwagen durchbricht die regennasse Nacht von Shibuya.',
        promptSnippet:
          'Cinematic tracking shot of a matte-black luxury hypercar accelerating through neon-lit wet Tokyo streets at midnight, rain reflections on pristine carbon fiber.',
      },
      {
        title: 'Sunset Coastline Cruise',
        hook: 'Goldene Stunde auf einer kurvigen Klippenstraße am Mittelmeer.',
        promptSnippet:
          'Low-angle gliding shot of an open-top vintage sports car cruising along a scenic coastal cliff at golden hour sunset, warm cinematic lighting.',
      },
      {
        title: 'Cyberpunk Alpine Pass',
        hook: 'Ein silberner Supersportler driftet durch schneebedeckte Serpentinen bei Dämmerung.',
        promptSnippet:
          'High-speed low-shutter drift of a silver hybrid supercar around a snow-dusted Alpine hairpin at dusk, glowing red brake calipers and exhaust sparks.',
      },
    ],
    defaultDurationSec: 15,
  },
  {
    id: 'horror-stories',
    name: 'Horror Stories',
    tagline: 'Psychologischer Grusel & unheimliche Mystery-Begegnungen',
    description:
      'Atmosphärischer Nervenkitzel: Nebelverhangene Wälder, flackernde Laternen, verlassene Korridore und plötzliche paranormale Phänomene, die den Atem stocken lassen.',
    previewImage:
      'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=800&auto=format&fit=crop&q=80',
    previewImageUrl:
      'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=800&auto=format&fit=crop&q=80',
    icon: '👻',
    badge: 'Extreme Retention',
    accent: {
      color: 'purple',
      border: 'border-purple-200 hover:border-purple-400',
      bgSoft: 'bg-purple-50 text-purple-700',
      gradient: 'from-purple-600 to-indigo-800',
      icon: '👻',
    },
    // Section 4: Specifications for Future Specialized Prompt Engine
    visualStyle:
      'Düstere Low-Key-Beleuchtung mit kaltem Cyan- und Mondlicht, flackerndem warmem Glühlampenlicht, volumetrischem Nebel, körniger Film-Noir-Textur und beklemmenden Schatten.',
    typicalCharactersAndObjects: [
      'Ein einsamer Nachtwächter mit flackernder Taschenlampe',
      'Verlassene Psychiatrie / abgelegene Holzhütte im Kiefernwald',
      'Unheimliche Silhouette hinter beschlagenem Fensterglas',
      'Unerwartet knarrende alte Holztüren und pendelnde Deckenlampen',
      'Alte Familienporträts, deren Augen dem Betrachter zu folgen scheinen',
    ],
    cameraStyle:
      'Langsame, quälende Dolly-In-Fahrten in dunkle Korridore, unruhige POV-Schulterkamera des Protagonisten, plötzlicher subtiler Focus-Pull auf den Hintergrund.',
    storytellingRules: [
      'Hook: Ein unerklärliches Geräusch oder visueller Hinweis im ersten Moment',
      'Suspense: Langsamer Aufbau von Anspannung ("Geh nicht in diesen Raum")',
      'Climax: Unerwarteter Twist oder schaurige Enthüllung kurz vor dem Freeze-Frame',
    ],
    audioRules: [
      'Beklemmende Stille, gefolgt von tiefem Sub-Bass-Grollen (Drones)',
      'Knarren von Dielen, entfernter dumpfer Herzschlag, flüsternde Stimmen im Hall',
      'Plötzlicher Schreck-Akkord (Stinger) präzise platziert',
    ],
    negativeElements: [
      'Kein platter, billiger Pixel-Gore oder Trash-Slapstick',
      'Keine helle Tageslichtstimmung ohne Kontrast',
      'Keine comichaften oder lächerlichen Monster-Masken',
    ],
    sampleIdeas: [
      {
        title: 'Der Schatten im Serverraum',
        hook: 'Um 3 Uhr morgens registrieren die Bewegungsmelder Bewegung im abgesperrten Archiv.',
        promptSnippet:
          'Eerie slow dolly-forward down a dimly lit server corridor with flickering fluorescent tubes, volumetric cold fog on the floor and an unsettling elongated silhouette at the far end.',
      },
      {
        title: 'Das flüsternde Gemälde',
        hook: 'In einer verlassenen viktorianischen Villa verändert sich jede Nacht das Porträt.',
        promptSnippet:
          'Moody gothic chamber with a candle-lit antique oil portrait whose painted eyes slowly turn directly towards the camera lens.',
      },
      {
        title: 'Der Nebel im Spiegelsaal',
        hook: 'Im antiken Spiegelsaal eines Schlosses bewegt sich das Spiegelbild eine Sekunde zu spät.',
        promptSnippet:
          'Atmospheric tracking shot through an abandoned ballroom of cracked baroque mirrors, where a lantern reflection hesitates and stares back directly.',
      },
    ],
    defaultDurationSec: 15,
  },
  {
    id: 'animal-stories',
    name: 'Animal Stories',
    tagline: 'Herzerwärmende Tier-Abenteuer & berührende Freundschaften',
    description:
      'Faszinierende Geschichten aus dem Tierreich: Treue Hunde-Helden, neugierige Katzen in Großstadt-Entdeckungen und majestätische Begegnungen wilder Tiere mit emotionaler Tiefe.',
    previewImage:
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
    previewImageUrl:
      'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80',
    icon: '🐾',
    badge: 'Universal Viral Appeal',
    accent: {
      color: 'emerald',
      border: 'border-emerald-200 hover:border-emerald-400',
      bgSoft: 'bg-emerald-50 text-emerald-700',
      gradient: 'from-emerald-500 to-teal-600',
      icon: '🐾',
    },
    // Section 4: Specifications for Future Specialized Prompt Engine
    visualStyle:
      'Lebendige, warme Naturfarben, sonniges Bokeh, fein aufgelöstes Fell und Schnurrhaare mit sichtbarem Sonnen-Gegenlicht (Rim-Light), ausdrucksstarke Augen mit Glanzpunkten.',
    typicalCharactersAndObjects: [
      'Goldener Retriever-Welpe mit riesigen treuen Augen',
      'Neugierige rote Katze mit weißer Brust und aufmerksamen Ohren',
      'Kleiner Igel mit Blättern auf dem Rücken',
      'Majestätischer Polarfuchs im glitzernden Pulverschnee',
      'Bunte Blumenwiesen, gemütliche Teppiche vor Kaminfeuer, herbstliche Waldwege',
    ],
    cameraStyle:
      'Tieraugenhöhe (Dog-Level / Cat-Level Kamera), sanfte Aufnahmeschwenks mit Weitwinkel, fließende Verfolgung beim ausgelassenen Toben.',
    storytellingRules: [
      'Hook: Niedliche oder berührende Ausgangssituation sofort etablieren',
      'Emotion: Eine kleine Herausforderung (z. B. scheuer Freund gewinnt Vertrauen)',
      'Happy End: Tröstender, herzerwärmender Moment, der zum Teilen anregt',
    ],
    audioRules: [
      'Authentische Tierlaute: Leises Schnurren, freudiges Hecheln, tapsende Pfoten',
      'Sanfte Naturgeräusche: Raschelndes Herbstlaub, Vogelgezwitscher, prasselndes Kaminfeuer',
      'Herzerwärmende Akustikgitarre oder gefühlvolle Klavier-Melodie',
    ],
    negativeElements: [
      'Keine Grausamkeit oder verängstigte Tiere',
      'Keine unnatürliche, ungelenke Gliedmaßen-Verformung',
      'Keine statischen Tierpräparate',
    ],
    sampleIdeas: [
      {
        title: 'Der Beschützer des Kätzchens',
        hook: 'Ein großer sanfter Golden Retriever nimmt ein verirrtes Kätzchen in den Regenmonaten auf.',
        promptSnippet:
          'Warm cinematic scene of a large gentle Golden Retriever sharing his cozy dry porch with a tiny shivering orange kitten during a summer rain shower, heartwarming eye contact.',
      },
      {
        title: 'Der erste Schnee des Fuchses',
        hook: 'Ein junger roter Waldbrandfuchs entdeckt zum ersten Mal glitzernde Schneeflocken.',
        promptSnippet:
          'Playful red fox kit jumping with delight into fresh powdery white snow in an enchanted sunlit pine forest, golden rim lighting on fur.',
      },
      {
        title: 'Der Igel und das Eichhörnchen',
        hook: 'Ein neugieriger kleiner Igel teilt seine gefundenen Eicheln mit einem hungrigen Eichhörnchen.',
        promptSnippet:
          'Ultra-cute close-up of a tiny hedgehog with golden autumn leaves stuck to his quills, politely offering an acorn to an inquisitive fluffy squirrel on mossy ground.',
      },
    ],
    defaultDurationSec: 15,
  },
];

export const PREDEFINED_NICHES: readonly VideoNiche[] = deepFreeze(RAW_NICHES);

/**
 * Returns all predefined niches (read-only immutable array).
 */
export function getAllNiches(): readonly VideoNiche[] {
  return PREDEFINED_NICHES;
}

/**
 * Safely looks up a niche by ID. Returns the first niche as fallback if not found.
 */
export function getNicheById(id: string | undefined): VideoNiche {
  if (!id) return PREDEFINED_NICHES[0];
  const found = PREDEFINED_NICHES.find((n) => n.id === id);
  return found || PREDEFINED_NICHES[0];
}

/**
 * Validates if a given string is a valid predefined niche ID.
 */
export function isValidNicheId(id: string): id is VideoNiche['id'] {
  return PREDEFINED_NICHES.some((n) => n.id === id);
}
