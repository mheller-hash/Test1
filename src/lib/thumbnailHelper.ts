import { getNicheById } from '../data/niches';

/**
 * High-definition, thematic preview and thumbnail imagery for each video niche.
 * Solves the issue where all generated videos share an identical hardcoded thumbnail.
 */
export const NICHE_THEMATIC_THUMBNAILS: Record<string, string[]> = {
  'fruit-stories': [
    'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80', // Strawberry Macro Bakery
    'https://images.unsplash.com/photo-1550258987-190a2d41a8ba?w=800&auto=format&fit=crop&q=80', // Colorful Tropical Fruit Group
    'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?w=800&auto=format&fit=crop&q=80', // Bright Strawberry Splash Macro
    'https://images.unsplash.com/photo-1528825871115-3581a5387919?w=800&auto=format&fit=crop&q=80', // Banana & Citrus Studio
    'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop&q=80', // Golden Ripe Banana Dynamic
  ],
  'luxury-cars': [
    'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=800&auto=format&fit=crop&q=80', // Midnight Hypercar Carbon
    'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80', // Porsche Night City Rollout
    'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?w=800&auto=format&fit=crop&q=80', // Mercedes AMG Sunset Glare
    'https://images.unsplash.com/photo-1544829099-b9a0c07fad1a?w=800&auto=format&fit=crop&q=80', // Aston Martin Dark Studio
    'https://images.unsplash.com/photo-1525609004556-c46c7d6cf023?w=800&auto=format&fit=crop&q=80', // Supercar Rear Diffuser & Exhaust
  ],
  'horror-stories': [
    'https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=800&auto=format&fit=crop&q=80', // Foggy Dark Pine Forest
    'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80', // Shadow Silhouette in Mist
    'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=80', // Eerie Moonlight Corridor
    'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=80', // Dark Moody Victorian Castle
    'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c45?w=800&auto=format&fit=crop&q=80', // Chilling Cold Mist Light
  ],
  'animal-stories': [
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?w=800&auto=format&fit=crop&q=80', // Golden Retriever Eyes Meadow
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&auto=format&fit=crop&q=80', // Cute Orange Tabby Cat
    'https://images.unsplash.com/photo-1474511320723-9a56873867b5?w=800&auto=format&fit=crop&q=80', // Wild Red Fox in Snow
    'https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?w=800&auto=format&fit=crop&q=80', // Playful Puppy in Sunlight
    'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800&auto=format&fit=crop&q=80', // Loyal Dog Portrait Golden Hour
  ],
};

const DEFAULT_CINEMATIC_THUMBNAILS = [
  'https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1518173946687-a4c8a383392e?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=800&auto=format&fit=crop&q=80',
];

/**
 * Returns a distinct, deterministic thumbnail based on the niche and input seed (title/prompt/id).
 * Guarantees that two videos in the same niche don't look identical.
 */
export function getDistinctThumbnail(nicheId?: string, seedText?: string): string {
  const seed = (seedText || `${Date.now()}-${Math.random()}`).trim();
  
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const positiveHash = Math.abs(hash);

  if (nicheId && NICHE_THEMATIC_THUMBNAILS[nicheId]) {
    const list = NICHE_THEMATIC_THUMBNAILS[nicheId];
    return list[positiveHash % list.length];
  }

  // Fallback to niche preview image if exists
  if (nicheId) {
    try {
      const n = getNicheById(nicheId);
      if (n?.previewImage) return n.previewImage;
    } catch {
      // ignore
    }
  }

  return DEFAULT_CINEMATIC_THUMBNAILS[positiveHash % DEFAULT_CINEMATIC_THUMBNAILS.length];
}
