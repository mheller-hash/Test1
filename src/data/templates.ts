import { VideoTemplate } from '../types';

import fruitDramaThumb from '../assets/images/template_fruit_drama_1792235239676.jpg';
import constructionThumb from '../assets/images/template_ai_construction_1792235241726.jpg';
import storyThumb from '../assets/images/template_ai_story_1792235242330.jpg';
import asmrThumb from '../assets/images/template_satisfying_asmr_1792235242258.jpg';
import comedyThumb from '../assets/images/template_animal_comedy_1792235243117.jpg';

export const VIDEO_TEMPLATES: VideoTemplate[] = [
  {
    id: 'fruit-drama',
    title: 'AI Fruit Drama',
    tagline: 'Vermenschlichte Früchte im packenden Beziehungs- oder Mafia-Drama',
    description: 'Erstelle virale vertikale Kurzvideos mit emotionalen, animierten Früchten oder Lebensmitteln. Perfekt für dramatische Wendungen, Beziehungsstreitigkeiten und Mafia-Stories.',
    category: 'characters',
    badge: 'Trending',
    thumbnailUrl: fruitDramaThumb,
    aspectRatio: '9:16',
    defaultDurationSec: 30,
    creditCost: 15,
    presetScenarios: [
      {
        title: 'Der Verrat beim Edel-Dinner',
        description: 'Erdbeere im Smoking stellt die Mafia-Banane zur Rede.',
        config: {
          mainCharacter: 'Erdbeere',
          secondaryCharacter: 'Banane',
          location: 'Luxusrestaurant',
          mood: 'Dramatisch',
          storyTopic: 'Die Banane hat geheime Konten in der Schweiz versteckt',
          language: 'Deutsch',
          duration: 30,
          subtitles: true,
          voiceStyle: 'Film Noir Erzähler & Heisere Stimmen'
        }
      },
      {
        title: 'Gerichtssaal-Showdown',
        description: 'Avocado verklagt Zitrone wegen sauerem Verhalten.',
        config: {
          mainCharacter: 'Avocado',
          secondaryCharacter: 'Zitrone',
          location: 'Hohes Gericht',
          mood: 'Spannungsgeladen',
          storyTopic: 'Der Kern der Wahrheit kommt ans Licht',
          language: 'Deutsch',
          duration: 25,
          subtitles: true,
          voiceStyle: 'Juristischer Richter & Angeklagter'
        }
      },
      {
        title: 'Liebeskummer im Kühlschrank',
        description: 'Eine Himbeere trauert um den Käsekuchen.',
        config: {
          mainCharacter: 'Himbeere',
          secondaryCharacter: 'Blaubeere',
          location: 'Kühlschrank-Nachtclub',
          mood: 'Melancholisch-Komödiantisch',
          storyTopic: 'Unerwiderte Liebe im obersten Fach',
          language: 'Deutsch',
          duration: 20,
          subtitles: true,
          voiceStyle: 'Sanft & Emotional'
        }
      }
    ],
    customizableFields: [
      {
        id: 'mainCharacter',
        label: 'Hauptfigur',
        type: 'select',
        defaultValue: 'Erdbeere',
        options: [
          { value: 'Erdbeere', label: 'Erdbeere (emotional & nobel)' },
          { value: 'Banane', label: 'Banane (lässiger Gangsterboss)' },
          { value: 'Avocado', label: 'Avocado (wohlhabend & stur)' },
          { value: 'Zitrone', label: 'Zitrone (sauer & unberechenbar)' },
          { value: 'Wassermelone', label: 'Wassermelone (gutmütiger Riese)' },
          { value: 'Brokkoli', label: 'Brokkoli (strenger Professor)' }
        ]
      },
      {
        id: 'secondaryCharacter',
        label: 'Gegenspieler / Nebenfigur',
        type: 'select',
        defaultValue: 'Banane',
        options: [
          { value: 'Banane', label: 'Banane (Mafia-Boss mit Zigarre)' },
          { value: 'Apfel', label: 'Apfel (hochnäsiger Aristokrat)' },
          { value: 'Blaubeere', label: 'Blaubeere (nervöser Informant)' },
          { value: 'Chili', label: 'Chili (explosiver Hitzkopf)' },
          { value: 'Traube', label: 'Traube (zwielichtiger Zeuge)' }
        ]
      },
      {
        id: 'mood',
        label: 'Stimmung & Atmosphäre',
        type: 'select',
        defaultValue: 'Dramatisch',
        options: [
          { value: 'Dramatisch', label: 'Dramatischer Thriller' },
          { value: 'Comedic', label: 'Schwarzer Humor / Satire' },
          { value: 'Emotional', label: 'Tragische Romanze' },
          { value: 'Mystery', label: 'Dunkles Geheimnis' }
        ]
      },
      {
        id: 'location',
        label: 'Umgebung / Location',
        type: 'select',
        defaultValue: 'Luxusrestaurant',
        options: [
          { value: 'Luxusrestaurant', label: 'Gourmet-Restaurant bei Kerzenschein' },
          { value: 'Kühlschrank-Bar', label: 'Verrauchte Kellerbar im Gemüsefach' },
          { value: 'Gerichtssaal', label: 'Ehrwürdiger Gerichtssaal' },
          { value: 'Supermarkt-Regal', label: 'Bio-Markt zur Mitternachtsstunde' },
          { value: 'Penthouse', label: 'Modernes Designer-Penthouse' }
        ]
      },
      {
        id: 'storyTopic',
        label: 'Thema der Story (Kurze Idee)',
        type: 'text',
        defaultValue: 'Die Erdbeere erfährt, dass die Banane sie beim großen Deal betrogen hat.',
        description: 'Formuliere in einem Satz, worum es im Video geht.'
      },
      {
        id: 'language',
        label: 'Sprache',
        type: 'select',
        defaultValue: 'Deutsch',
        options: [
          { value: 'Deutsch', label: 'Deutsch' },
          { value: 'Englisch', label: 'Englisch (US)' },
          { value: 'Spanisch', label: 'Spanisch' },
          { value: 'Französisch', label: 'Französisch' }
        ]
      },
      {
        id: 'duration',
        label: 'Videolänge',
        type: 'slider',
        defaultValue: 30,
        min: 15,
        max: 60,
        step: 5,
        unit: 'Sekunden'
      },
      {
        id: 'voiceStyle',
        label: 'Synchronstimme / Erzähler',
        type: 'select',
        defaultValue: 'Film Noir & Heisere Stimmen',
        options: [
          { value: 'Film Noir & Heisere Stimmen', label: 'Tiefe Mafia-Stimme (Dramatisch)' },
          { value: 'Vibrant Cartoon', label: 'Expressive Zeichentrickstimmen' },
          { value: 'True Crime Doku', label: 'Ernsthafte Dokumentar-Erzählerin' },
          { value: 'TikTok Trend Voice', label: 'Moderne virale Kurzvideo-Stimme' }
        ]
      },
      {
        id: 'subtitles',
        label: 'Animierte Untertitel (TikTok / Reels Style)',
        type: 'toggle',
        defaultValue: true,
        description: 'Hebt jedes gesprochene Wort dynamisch hervor für maximale Watchtime.'
      }
    ],
    sampleScriptPreview: [
      {
        character: 'Erdbeere',
        line: 'Du dachtest wirklich, ich finde die Akten über das Kühlhaus nie, Matteo?',
        visualPrompt: 'Close-up auf die Erdbeere im Smoking mit wütendem Blick.'
      },
      {
        character: 'Banane',
        line: 'In dieser Stadt überlebt nur, wer reif genug ist für die Wahrheit.',
        visualPrompt: 'Banane nimmt einen Zug von der Zigarre, Rauch steigt im Restaurant auf.'
      }
    ]
  },
  {
    id: 'ai-construction',
    title: 'AI Construction / Building',
    tagline: 'Monumentale, unmögliche Bauwerke im Zeitraffer erschaffen',
    description: 'Gigantische Golems, futuristische Maschinen oder antike Arbeiter errichten surreale Wunderbauten. Eines der viralsten Satisfying-Formate auf Kurzvideoplattformen.',
    category: 'satisfying',
    badge: 'Popular',
    thumbnailUrl: constructionThumb,
    aspectRatio: '9:16',
    defaultDurationSec: 30,
    creditCost: 15,
    presetScenarios: [
      {
        title: 'Der schwebende Spiralturm',
        description: 'Steingolems setzen leuchtende Marmorblöcke bei Sonnenuntergang ein.',
        config: {
          whatIsBuilt: 'Endlose Spiral-Kathedrale in den Wolken',
          buildingStyle: 'Antik-Futuristisch mit leuchtenden Glyphen',
          materials: 'Weißer Marmor & Cyan-Energieadern',
          location: 'Nebelige Schlucht bei Sonnenuntergang',
          builders: 'Kolossale Steingolems',
          atmosphere: 'Episch & Beruhigend',
          language: 'Deutsch',
          duration: 30,
          subtitles: true
        }
      },
      {
        title: 'Die Cyberpunk-Wabenstadt',
        description: 'Schwarm-Drohnen schweißen eine vertikale Neon-Metropole.',
        config: {
          whatIsBuilt: 'Vertikale Waben-Megastruktur',
          buildingStyle: 'Cyberpunk Neon Industrial',
          materials: 'Schwarzes Titan & Hologramm-Glas',
          location: 'Regenverhangener Nachthimmel',
          builders: 'Autonome Bau-Drohnenschwärme',
          atmosphere: 'Hypnotisch & Zukunftsweisend',
          language: 'Deutsch',
          duration: 35,
          subtitles: true
        }
      }
    ],
    customizableFields: [
      {
        id: 'whatIsBuilt',
        label: 'Was gebaut wird',
        type: 'select',
        defaultValue: 'Endlose Spiral-Kathedrale in den Wolken',
        options: [
          { value: 'Endlose Spiral-Kathedrale in den Wolken', label: 'Endlose Spiral-Kathedrale in den Wolken' },
          { value: 'Schwebende Kristall-Pyramide', label: 'Schwebende Kristall-Pyramide' },
          { value: 'Unterwasser-Glasmetropole', label: 'Unterwasser-Glasmetropole' },
          { value: 'Baumhaus-Palast im Riesenmammutbaum', label: 'Baumhaus-Palast im Riesenmammutbaum' },
          { value: 'Kosmischer Orbit-Aufzug', label: 'Kosmischer Orbit-Aufzug' }
        ]
      },
      {
        id: 'buildingStyle',
        label: 'Baustil',
        type: 'select',
        defaultValue: 'Antik-Futuristisch mit leuchtenden Glyphen',
        options: [
          { value: 'Antik-Futuristisch mit leuchtenden Glyphen', label: 'Antik-Futuristisch (Griechisch / Sci-Fi)' },
          { value: 'Gothic Dark Fantasy', label: 'Gothic Dark Fantasy' },
          { value: 'Cyberpunk & Hologramme', label: 'Cyberpunk & Hologramme' },
          { value: 'Organisch-Biophil (Solarpunk)', label: 'Organisch-Biophil (Solarpunk)' },
          { value: 'Minimalistischer Brutalismus', label: 'Minimalistischer Brutalismus' }
        ]
      },
      {
        id: 'materials',
        label: 'Hauptmaterialien',
        type: 'select',
        defaultValue: 'Weißer Marmor & Cyan-Energieadern',
        options: [
          { value: 'Weißer Marmor & Cyan-Energieadern', label: 'Weißer Marmor & leuchtendes Cyan' },
          { value: 'Obsidian & flüssiges Gold', label: 'Obsidian & flüssiges Gold' },
          { value: 'Geschliffener Smaragd & Messing', label: 'Geschliffener Smaragd & Messing' },
          { value: 'Karbonfaser & Neon-Lichtleisten', label: 'Karbonfaser & Neon-Lichtleisten' }
        ]
      },
      {
        id: 'builders',
        label: 'Wer oder was baut?',
        type: 'select',
        defaultValue: 'Kolossale Steingolems',
        options: [
          { value: 'Kolossale Steingolems', label: 'Uralte Steingolems' },
          { value: 'KI-gesteuerte Nanodrohnen', label: 'KI-gesteuerte Nanodrohnen' },
          { value: 'Goldene Zwerge & Alchemisten', label: 'Goldene Zwerge & Alchemisten' },
          { value: 'Futuristische Industrieroboter', label: 'Futuristische Industrieroboter' }
        ]
      },
      {
        id: 'timeOfDay',
        label: 'Tageszeit & Beleuchtung',
        type: 'select',
        defaultValue: 'Goldener Sonnenuntergang',
        options: [
          { value: 'Goldener Sonnenuntergang', label: 'Goldene Stunde / Sonnenuntergang' },
          { value: 'Sternenklare Polarnacht', label: 'Sternenklare Polarnacht mit Nordlichtern' },
          { value: 'Morgendämmerung im Hochgebirge', label: 'Morgendämmerung im Hochgebirge' },
          { value: 'Dramatischer Gewittersturm', label: 'Dramatischer Gewittersturm' }
        ]
      },
      {
        id: 'duration',
        label: 'Videolänge',
        type: 'slider',
        defaultValue: 30,
        min: 15,
        max: 60,
        step: 5,
        unit: 'Sekunden'
      },
      {
        id: 'subtitles',
        label: 'Erklärende Begleit-Untertitel',
        type: 'toggle',
        defaultValue: true,
        description: 'Blendet faszinierende architektonische Fakten und Story-Schnipsel ein.'
      }
    ],
    sampleScriptPreview: [
      {
        character: 'Erzähler',
        line: 'Vor zehntausend Jahren begannen die Golems mit dem Bau des Himmelsturms.',
        visualPrompt: 'Zeitrafferaufnahme: Massive Felsblöcke heben sich wie von Geisterhand in die Luft.'
      },
      {
        character: 'Erzähler',
        line: 'Jeder Stein ist mit uralten Runen versiegelt, die pure Energie kanalisieren.',
        visualPrompt: 'Nahaufnahme auf die leuchtenden cyanblauen Rillen im weißen Marmor.'
      }
    ]
  },
  {
    id: 'ai-story',
    title: 'AI Story',
    tagline: 'Fesselnde vertikale Kurzgeschichten & Mystery-Chroniken',
    description: 'Automatisch erzeugte, hochspannende Kurzgeschichten im vertikalen Kinoformat. Perfekt für Creepypasta, Sci-Fi-Twists, Reddit-Stories und philosophische Rätsel.',
    category: 'stories',
    badge: 'Trending',
    thumbnailUrl: storyThumb,
    aspectRatio: '9:16',
    defaultDurationSec: 40,
    creditCost: 20,
    presetScenarios: [
      {
        title: 'Das Relikt von Sektor 9',
        description: 'Ein Detektiv im Regen findet ein Artefakt, das die Zeit anhält.',
        config: {
          genre: 'Cyberpunk Noir Mystery',
          theme: 'Ein Wanderer findet ein Artefakt, das die Realität umschreibt',
          mood: 'Düster & Fesselnd',
          narrativeStyle: 'Ich-Perspektive mit packendem Cliffhanger',
          language: 'Deutsch',
          duration: 40,
          subtitles: true,
          voiceStyle: 'Tiefe atmosphärische Erzählstimme'
        }
      },
      {
        title: 'Der letzte Anruf aus dem Weltall',
        description: 'Eine verlassene Raumstation sendet ein Notsignal aus der Vergangenheit.',
        config: {
          genre: 'Kosmischer Sci-Fi Horror',
          theme: 'Ein Astronaut empfängt seine eigene Stimme aus der Zukunft',
          mood: 'Psychologischer Thriller',
          narrativeStyle: 'Gefundene Tonaufnahmen (Found Footage)',
          language: 'Deutsch',
          duration: 35,
          subtitles: true,
          voiceStyle: 'Statisch verzerrtes Funkgerät & Erzähler'
        }
      }
    ],
    customizableFields: [
      {
        id: 'genre',
        label: 'Genre',
        type: 'select',
        defaultValue: 'Cyberpunk Noir Mystery',
        options: [
          { value: 'Cyberpunk Noir Mystery', label: 'Cyberpunk Noir Mystery' },
          { value: 'Dark Fantasy & Magie', label: 'Dark Fantasy & Magie' },
          { value: 'Kosmischer Horror & Creepypasta', label: 'Kosmischer Horror & Creepypasta' },
          { value: 'Historischer Mystery-Thriller', label: 'Historischer Mystery-Thriller' },
          { value: 'Philosophisches Gedankenspiel', label: 'Philosophisches Gedankenspiel' }
        ]
      },
      {
        id: 'theme',
        label: 'Thema / Ausgangslage',
        type: 'text',
        defaultValue: 'Ein Detektiv findet im Dauerregen ein Artefakt, das die Zeit um 10 Sekunden zurückspult.',
        description: 'Der zündende Funke deiner Geschichte.'
      },
      {
        id: 'mood',
        label: 'Stimmung',
        type: 'select',
        defaultValue: 'Düster & Fesselnd',
        options: [
          { value: 'Düster & Fesselnd', label: 'Düster & Fesselnd' },
          { value: 'Melancholisch & Tiefgründig', label: 'Melancholisch & Tiefgründig' },
          { value: 'Adrenalingeladen & Rasend', label: 'Adrenalingeladen & Rasend' },
          { value: 'Unerwarteter Twist am Ende', label: 'Unerwarteter Twist am Ende' }
        ]
      },
      {
        id: 'narrativeStyle',
        label: 'Erzählstil',
        type: 'select',
        defaultValue: 'Ich-Perspektive mit packendem Cliffhanger',
        options: [
          { value: 'Ich-Perspektive mit packendem Cliffhanger', label: 'Ich-Perspektive („Ich hätte es nie berühren dürfen...“)' },
          { value: 'Allwissender Dokumentar-Erzähler', label: 'Allwissender Dokumentar-Erzähler' },
          { value: 'Schnelle TikTok-Hook Erzählung', label: 'Schnelle Hook („Was würdest du tun, wenn...?“)' }
        ]
      },
      {
        id: 'language',
        label: 'Sprache',
        type: 'select',
        defaultValue: 'Deutsch',
        options: [
          { value: 'Deutsch', label: 'Deutsch' },
          { value: 'Englisch', label: 'Englisch (US)' },
          { value: 'Spanisch', label: 'Spanisch' }
        ]
      },
      {
        id: 'duration',
        label: 'Videolänge',
        type: 'slider',
        defaultValue: 40,
        min: 20,
        max: 60,
        step: 5,
        unit: 'Sekunden'
      },
      {
        id: 'subtitles',
        label: 'Dynamische Untertitel',
        type: 'toggle',
        defaultValue: true,
        description: 'TikTok-typische springende Untertitel für maximale Bindung.'
      }
    ],
    sampleScriptPreview: [
      {
        character: 'Detektiv',
        line: 'Sie sagten mir, das Relikt sei zerstört worden. Sie haben gelogen.',
        visualPrompt: 'Regentropfen perlen an der Ledermütze ab, das Artefakt pulsiert bernsteinfarben.'
      },
      {
        character: 'Detektiv',
        line: 'Als ich es berührte, blieb der Regen in der Luft stehen.',
        visualPrompt: 'Gefrorene Regentropfen schweben reglos in der Luft vor den bunten Neonschildern.'
      }
    ]
  },
  {
    id: 'satisfying-asmr',
    title: 'Satisfying Crystal Slicing ASMR',
    tagline: 'Hypnotische Makro-Aufnahmen, kinetischer Sand & Schmelzen',
    description: 'Extrem virale Videos ohne Sprachbarriere. Schneiden von kinetischem Kristallgel, Glühdraht durch Regenbogensand und Makro-Texturen mit beruhigenden Soundeffekten.',
    category: 'asmr',
    badge: 'Viral',
    thumbnailUrl: asmrThumb,
    aspectRatio: '9:16',
    defaultDurationSec: 25,
    creditCost: 12,
    presetScenarios: [
      {
        title: 'Glühdraht-Präzisionsschnitt',
        description: 'Ein rotglühender Draht gleitet durch Regenbogen-Kristallschichten.',
        config: {
          slicingTool: 'Rotglühender Präzisionsdraht',
          objectToSlice: 'Regenbogen-Kristallsandwürfel',
          soundProfile: 'Knisterndes Schmelzen & Tiefbass',
          visualPacing: 'Slow-Motion Makro (60fps Feeling)',
          language: 'Deutsch',
          duration: 25,
          subtitles: false
        }
      },
      {
        title: 'Geometrische Schleim-Zerstörung',
        description: 'Perfekt symmetrische Gelee-Kuben werden hydraulisch zerdrückt.',
        config: {
          slicingTool: 'Hydraulische Diamant-Presse',
          objectToSlice: 'Transluzente Neon-Geleekugeln',
          soundProfile: 'Squishy Pops & Knall-Effekte',
          visualPacing: 'Rythmischer Zeitraffer',
          language: 'Deutsch',
          duration: 20,
          subtitles: false
        }
      }
    ],
    customizableFields: [
      {
        id: 'objectToSlice',
        label: 'Objekt / Textur',
        type: 'select',
        defaultValue: 'Regenbogen-Kristallsandwürfel',
        options: [
          { value: 'Regenbogen-Kristallsandwürfel', label: 'Regenbogen-Kristallsandwürfel' },
          { value: 'Holografische Seifenblöcke', label: 'Holografische Seifenblöcke (Gittermuster)' },
          { value: 'Gefrorene Schoko-Gold-Waben', label: 'Gefrorene Schoko-Gold-Waben' },
          { value: 'Transluzente Aurora-Gelatine', label: 'Transluzente Aurora-Gelatine' }
        ]
      },
      {
        id: 'slicingTool',
        label: 'Schneidewerkzeug / Aktion',
        type: 'select',
        defaultValue: 'Rotglühender Präzisionsdraht',
        options: [
          { value: 'Rotglühender Präzisionsdraht', label: 'Rotglühender Präzisionsdraht' },
          { value: 'Rasiermesserscharfe Klinge', label: 'Rasiermesserscharfe Klinge' },
          { value: 'Hydraulische Presse mit Gitter', label: 'Hydraulische Presse mit Gitter' },
          { value: 'Akustische Schallwellen-Zersetzung', label: 'Akustische Schallwellen-Zersetzung' }
        ]
      },
      {
        id: 'soundProfile',
        label: 'Sound & Audio-Profil',
        type: 'select',
        defaultValue: 'Knisterndes Schmelzen & Tiefbass',
        options: [
          { value: 'Knisterndes Schmelzen & Tiefbass', label: 'Knisterndes Schmelzen & Tiefbass' },
          { value: 'Crispy Crunch & Knusprige Schnitte', label: 'Crispy Crunch & Knusprige Schnitte' },
          { value: 'Sanfte Lo-Fi Beats & Makro-Sounds', label: 'Sanfte Lo-Fi Beats & Makro-Sounds' },
          { value: 'Reines ASMR (Keine Musik)', label: 'Reines ASMR (Keine Musik)' }
        ]
      },
      {
        id: 'duration',
        label: 'Videolänge',
        type: 'slider',
        defaultValue: 25,
        min: 15,
        max: 45,
        step: 5,
        unit: 'Sekunden'
      }
    ],
    sampleScriptPreview: [
      {
        character: 'Visual Cue',
        line: '[Crisp sizzling sound] Glühdraht trennt die erste Schicht aus Regenbogen-Kristallen.',
        visualPrompt: 'Ultra-Makro Nahaufnahme: Die Schnittkante glüht orange auf und tropft sauber ab.'
      }
    ]
  },
  {
    id: 'animal-comedy',
    title: 'AI Animal Corporate Comedy',
    tagline: 'Tiere in absurden menschlichen Berufen und Büro-Meetings',
    description: 'Hamster als Vorstandsvorsitzende, Waschbären als IT-Sicherheitschefs oder Katzen als strenge Richter. Hoher Viralitätsfaktor und Shareability bei Gen-Z und Millenials.',
    category: 'comedy',
    badge: 'New',
    thumbnailUrl: comedyThumb,
    aspectRatio: '9:16',
    defaultDurationSec: 30,
    creditCost: 15,
    presetScenarios: [
      {
        title: 'Hamster-CEO Quartalszahlen',
        description: 'Der Hamster-Chef feuert den Vorstand wegen zu wenig Sonnenblumenkernen.',
        config: {
          animal: 'Hamster im Maßanzug',
          jobTitle: 'Vorstandsvorsitzender (CEO)',
          officeSetting: 'Moderner Glas-Konferenzraum im Wolkenkratzer',
          meetingTopic: 'Quartalszahlen: Die Nuss-Rendite ist um 40% eingebrochen',
          mood: 'Urkomisch & Bitterernst gespielt',
          language: 'Deutsch',
          duration: 30,
          subtitles: true
        }
      },
      {
        title: 'Waschbär IT-Support Eskalation',
        description: 'Ein Waschbär versucht, ein Computervirus mit Wasser abzuwaschen.',
        config: {
          animal: 'Waschbär mit Krawatte & Brille',
          jobTitle: 'Chief Security Officer',
          officeSetting: 'Serverraum mit blinkenden Racks',
          meetingTopic: 'Warum der Server im Waschbecken gelandet ist',
          mood: 'Absurd & Charmant',
          language: 'Deutsch',
          duration: 25,
          subtitles: true
        }
      }
    ],
    customizableFields: [
      {
        id: 'animal',
        label: 'Hauptcharakter',
        type: 'select',
        defaultValue: 'Hamster im Maßanzug',
        options: [
          { value: 'Hamster im Maßanzug', label: 'Hamster im Maßanzug (autoritärer CEO)' },
          { value: 'Waschbär mit Krawatte', label: 'Waschbär mit Krawatte (chaotischer IT-Experte)' },
          { value: 'Corgi als HR-Manager', label: 'Corgi als übertrieben enthusiastischer HR-Chef' },
          { value: 'Katze als Richter', label: 'Katze mit Perücke als herablassender Richter' },
          { value: 'Faultier als Projektleiter', label: 'Faultier als Projektleiter bei der Deadline' }
        ]
      },
      {
        id: 'jobTitle',
        label: 'Beruf / Rolle',
        type: 'select',
        defaultValue: 'Vorstandsvorsitzender (CEO)',
        options: [
          { value: 'Vorstandsvorsitzender (CEO)', label: 'Vorstandsvorsitzender (CEO)' },
          { value: 'HR-Beauftragter', label: 'HR-Beauftragter' },
          { value: 'Startup-Pitch Gründer', label: 'Startup-Pitch Gründer' },
          { value: 'Börsen-Daytrader', label: 'Börsen-Daytrader im Panikmodus' }
        ]
      },
      {
        id: 'meetingTopic',
        label: 'Thema des Meetings / Konflikts',
        type: 'text',
        defaultValue: 'Der Hamster-CEO erklärt, warum Überstunden im Laufrad verpflichtend werden.',
        description: 'Die absurde Geschäftssituation für das Video.'
      },
      {
        id: 'mood',
        label: 'Tonfall',
        type: 'select',
        defaultValue: 'Bitterernst gespielt & Satirisch',
        options: [
          { value: 'Bitterernst gespielt & Satirisch', label: 'Bitterernst gespielt (Deadpan Satire)' },
          { value: 'Chaotisch & Hektisch', label: 'Chaotisch & Hektisch' },
          { value: 'Motivierender Business-Guru', label: 'Übertriebener Motivations-Guru' }
        ]
      },
      {
        id: 'language',
        label: 'Sprache',
        type: 'select',
        defaultValue: 'Deutsch',
        options: [
          { value: 'Deutsch', label: 'Deutsch' },
          { value: 'Englisch', label: 'Englisch (US)' }
        ]
      },
      {
        id: 'duration',
        label: 'Videolänge',
        type: 'slider',
        defaultValue: 30,
        min: 15,
        max: 60,
        step: 5,
        unit: 'Sekunden'
      },
      {
        id: 'subtitles',
        label: 'TikTok Highlight-Untertitel',
        type: 'toggle',
        defaultValue: true,
        description: 'Knallige farbige Untertitel für witzige Punchlines.'
      }
    ],
    sampleScriptPreview: [
      {
        character: 'Hamster CEO',
        line: 'Meine Damen und Herren, schauen Sie auf Slide 4. Wir haben ein Defizit im Nussspeicher.',
        visualPrompt: 'Der Hamster tippt mit dem Laserpointer energisch auf das Quartalsdiagramm.'
      },
      {
        character: 'Hamster CEO',
        line: 'Ab Montag wird das Laufrad doppelt so schnell gedreht. Fragen? Keine? Gut.',
        visualPrompt: 'Er schlägt die Pfote auf das Rednerpult, während die menschlichen Vorstände nicken.'
      }
    ]
  }
];

export const SAMPLE_INITIAL_VIDEOS = [
  {
    id: 'vid-demo-1',
    title: 'Erdbeere vs. Mafia Banane: Der Verrat',
    templateId: 'fruit-drama',
    templateName: 'AI Fruit Drama',
    thumbnailUrl: fruitDramaThumb,
    durationSec: 30,
    createdAt: 'Vor 2 Stunden',
    status: 'completed' as const,
    creditUsed: 15,
    aspectRatio: '9:16' as const,
    settings: {
      mainCharacter: 'Erdbeere',
      secondaryCharacter: 'Banane',
      mood: 'Dramatisch',
      location: 'Luxusrestaurant'
    },
    scenes: [
      {
        sceneNumber: 1,
        durationSec: 7,
        imagePrompt: 'Erdbeere im Frack blickt finster auf die Zigarre rauchende Banane.',
        imageUrl: fruitDramaThumb,
        speaker: 'Erdbeere',
        spokenText: 'Du dachtest wirklich, die Sache im Kühlhaus bleibt begraben, Matteo?',
        visualAction: 'Langsamer Kameraschwenk über den schweren Mahagonitisch zur Banane.',
        subtitles: [
          { word: 'Du', startSec: 0.2, endSec: 0.5 },
          { word: 'dachtest', startSec: 0.6, endSec: 1.1 },
          { word: 'wirklich,', startSec: 1.2, endSec: 1.7 },
          { word: 'die', startSec: 2.0, endSec: 2.3 },
          { word: 'Sache', startSec: 2.4, endSec: 2.9 },
          { word: 'im', startSec: 3.0, endSec: 3.2 },
          { word: 'Kühlhaus', startSec: 3.3, endSec: 4.2 },
          { word: 'bleibt', startSec: 4.3, endSec: 4.8 },
          { word: 'begraben?', startSec: 4.9, endSec: 6.2 }
        ]
      },
      {
        sceneNumber: 2,
        durationSec: 8,
        imagePrompt: 'Banane zieht an der Zigarre, Rauch steigt im Schein der Kerze auf.',
        imageUrl: fruitDramaThumb,
        speaker: 'Banane',
        spokenText: 'In diesem Geschäft wird man entweder überreif... oder man übernimmt das Regal.',
        visualAction: 'Nahaufnahme auf die Augen der Banane.',
        subtitles: [
          { word: 'In', startSec: 7.2, endSec: 7.5 },
          { word: 'diesem', startSec: 7.6, endSec: 8.0 },
          { word: 'Geschäft', startSec: 8.1, endSec: 8.8 },
          { word: 'wird', startSec: 9.0, endSec: 9.3 },
          { word: 'man', startSec: 9.4, endSec: 9.7 },
          { word: 'überreif...', startSec: 9.8, endSec: 11.2 },
          { word: 'oder', startSec: 11.5, endSec: 11.8 },
          { word: 'man', startSec: 11.9, endSec: 12.2 },
          { word: 'übernimmt', startSec: 12.3, endSec: 13.2 },
          { word: 'das', startSec: 13.3, endSec: 13.6 },
          { word: 'Regal.', startSec: 13.7, endSec: 14.8 }
        ]
      },
      {
        sceneNumber: 3,
        durationSec: 8,
        imagePrompt: 'Erdbeere knallt die Faust auf die Tischdecke, Weinglas klirrt.',
        imageUrl: fruitDramaThumb,
        speaker: 'Erdbeere',
        spokenText: 'Der Obstsalat ist angerichtet, Matteo. Und du stehst auf der Speisekarte.',
        visualAction: 'Dramatischer Zoom mit Weichzeichner im Hintergrund.',
        subtitles: [
          { word: 'Der', startSec: 15.2, endSec: 15.5 },
          { word: 'Obstsalat', startSec: 15.6, endSec: 16.5 },
          { word: 'ist', startSec: 16.6, endSec: 16.9 },
          { word: 'angerichtet,', startSec: 17.0, endSec: 18.0 },
          { word: 'Matteo.', startSec: 18.1, endSec: 19.2 },
          { word: 'Und', startSec: 19.5, endSec: 19.8 },
          { word: 'du', startSec: 19.9, endSec: 20.2 },
          { word: 'stehst', startSec: 20.3, endSec: 20.9 },
          { word: 'auf', startSec: 21.0, endSec: 21.3 },
          { word: 'der', startSec: 21.4, endSec: 21.7 },
          { word: 'Speisekarte.', startSec: 21.8, endSec: 23.0 }
        ]
      },
      {
        sceneNumber: 4,
        durationSec: 7,
        imagePrompt: 'Schatten der beiden Früchte im Fenster des Restaurants bei Blitzschlag.',
        imageUrl: fruitDramaThumb,
        speaker: 'Erzähler',
        spokenText: 'Teil 2 folgt morgen. Folge für das Finale.',
        visualAction: 'Schneller Schnitt mit Sound-Effekt.',
        subtitles: [
          { word: 'Teil', startSec: 23.5, endSec: 24.0 },
          { word: '2', startSec: 24.1, endSec: 24.6 },
          { word: 'folgt', startSec: 24.7, endSec: 25.2 },
          { word: 'morgen.', startSec: 25.3, endSec: 26.2 },
          { word: 'Folge', startSec: 26.5, endSec: 27.2 },
          { word: 'für', startSec: 27.3, endSec: 27.7 },
          { word: 'das', startSec: 27.8, endSec: 28.1 },
          { word: 'Finale.', startSec: 28.2, endSec: 29.5 }
        ]
      }
    ]
  },
  {
    id: 'vid-demo-2',
    title: 'Golems errichten den Spiralturm',
    templateId: 'ai-construction',
    templateName: 'AI Construction / Building',
    thumbnailUrl: constructionThumb,
    durationSec: 30,
    createdAt: 'Gestern',
    status: 'completed' as const,
    creditUsed: 15,
    aspectRatio: '9:16' as const,
    settings: {
      whatIsBuilt: 'Endlose Spiral-Kathedrale in den Wolken',
      builders: 'Kolossale Steingolems',
      materials: 'Weißer Marmor & Cyan-Energieadern'
    },
    scenes: [
      {
        sceneNumber: 1,
        durationSec: 10,
        imagePrompt: 'Steingolems heben gewaltige Marmorblöcke in eine Spirale empor.',
        imageUrl: constructionThumb,
        speaker: 'Erzähler',
        spokenText: 'Auf 3000 Metern Höhe begann der Bau des unmöglichen Monuments.',
        visualAction: 'Sonnenstrahlen brechen durch die Schlucht.',
        subtitles: [
          { word: 'Auf', startSec: 0.5, endSec: 0.9 },
          { word: '3000', startSec: 1.0, endSec: 1.8 },
          { word: 'Metern', startSec: 1.9, endSec: 2.5 },
          { word: 'Höhe', startSec: 2.6, endSec: 3.2 },
          { word: 'begann', startSec: 3.5, endSec: 4.2 },
          { word: 'der', startSec: 4.3, endSec: 4.6 },
          { word: 'Bau', startSec: 4.7, endSec: 5.3 },
          { word: 'des', startSec: 5.4, endSec: 5.8 },
          { word: 'unmöglichen', startSec: 5.9, endSec: 7.0 },
          { word: 'Monuments.', startSec: 7.1, endSec: 9.0 }
        ]
      },
      {
        sceneNumber: 2,
        durationSec: 10,
        imagePrompt: 'Die Treppen winden sich spiralförmig um den leuchtenden Energiekern.',
        imageUrl: constructionThumb,
        speaker: 'Erzähler',
        spokenText: 'Jeder Stein wurde mit uralter Runenenergie verbunden.',
        visualAction: 'Pulsierende Energie fließt die Wendeltreppe hinauf.',
        subtitles: [
          { word: 'Jeder', startSec: 10.2, endSec: 10.8 },
          { word: 'Stein', startSec: 10.9, endSec: 11.5 },
          { word: 'wurde', startSec: 11.6, endSec: 12.1 },
          { word: 'mit', startSec: 12.2, endSec: 12.6 },
          { word: 'uralter', startSec: 12.7, endSec: 13.5 },
          { word: 'Runenenergie', startSec: 13.6, endSec: 15.0 },
          { word: 'verbunden.', startSec: 15.1, endSec: 16.8 }
        ]
      },
      {
        sceneNumber: 3,
        durationSec: 10,
        imagePrompt: 'Sonnenuntergang taucht das vollendete Monument in goldenes Licht.',
        imageUrl: constructionThumb,
        speaker: 'Erzähler',
        spokenText: 'Ein Bauwerk, das bis in die Ewigkeit stehen wird.',
        visualAction: 'Weitwinkel-Kamerafahrt nach oben zum Zenit.',
        subtitles: [
          { word: 'Ein', startSec: 20.5, endSec: 21.0 },
          { word: 'Bauwerk,', startSec: 21.1, endSec: 22.2 },
          { word: 'das', startSec: 22.4, endSec: 22.8 },
          { word: 'bis', startSec: 22.9, endSec: 23.3 },
          { word: 'in', startSec: 23.4, endSec: 23.7 },
          { word: 'die', startSec: 23.8, endSec: 24.1 },
          { word: 'Ewigkeit', startSec: 24.2, endSec: 25.5 },
          { word: 'stehen', startSec: 25.6, endSec: 26.3 },
          { word: 'wird.', startSec: 26.4, endSec: 28.0 }
        ]
      }
    ]
  }
];
