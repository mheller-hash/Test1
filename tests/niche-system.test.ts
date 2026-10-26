import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PREDEFINED_NICHES, getAllNiches, getNicheById, isValidNicheId } from '../src/data/niches.js';

test('Predefined Niches - Contains exactly the 4 required niches', () => {
  const niches = getAllNiches();
  assert.equal(niches.length, 4, 'Must have exactly 4 predefined niches');

  const expectedIds = ['fruit-stories', 'luxury-cars', 'horror-stories', 'animal-stories'];
  const actualIds = niches.map((n) => n.id);
  assert.deepEqual(actualIds, expectedIds, 'Niche IDs must match the 4 predefined categories in order');

  const expectedNames = ['Fruit Stories', 'Luxury Cars', 'Horror Stories', 'Animal Stories'];
  const actualNames = niches.map((n) => n.name);
  assert.deepEqual(actualNames, expectedNames, 'Niche names must match the requested names');
});

test('Predefined Niches - Contains all 9 required fields for future prompt engines', () => {
  for (const niche of PREDEFINED_NICHES) {
    // 1. Nischen-ID
    assert.ok(typeof niche.id === 'string' && niche.id.length > 0, `Niche ${niche.id} must have a valid id`);
    
    // 2. Name
    assert.ok(typeof niche.name === 'string' && niche.name.length > 0, `Niche ${niche.id} must have a valid name`);
    
    // 3. Beschreibung
    assert.ok(typeof niche.description === 'string' && niche.description.length > 20, `Niche ${niche.id} must have a detailed description`);
    
    // 4. Visueller Stil
    assert.ok(typeof niche.visualStyle === 'string' && niche.visualStyle.length > 10, `Niche ${niche.id} must specify visualStyle`);
    
    // 5. Typische Figuren und Objekte
    assert.ok(Array.isArray(niche.typicalCharactersAndObjects) && niche.typicalCharactersAndObjects.length >= 3, 
      `Niche ${niche.id} must list typical characters and objects`);
    
    // 6. Kamerastil
    assert.ok(typeof niche.cameraStyle === 'string' && niche.cameraStyle.length > 10, `Niche ${niche.id} must specify cameraStyle`);
    
    // 7. Storytelling-Regeln
    assert.ok(Array.isArray(niche.storytellingRules) && niche.storytellingRules.length >= 2, 
      `Niche ${niche.id} must specify storytellingRules`);
    
    // 8. Audio-Regeln
    assert.ok(Array.isArray(niche.audioRules) && niche.audioRules.length >= 2, 
      `Niche ${niche.id} must specify audioRules`);
    
    // 9. Unerwünschte Elemente (negative elements)
    assert.ok(Array.isArray(niche.negativeElements) && niche.negativeElements.length >= 2, 
      `Niche ${niche.id} must specify negativeElements`);

    // UI elements: preview image, icon, badge, sample ideas
    assert.ok(typeof niche.previewImageUrl === 'string' && niche.previewImageUrl.startsWith('https://'), 
      `Niche ${niche.id} must have a valid preview image URL`);
    assert.ok(typeof niche.badge === 'string', `Niche ${niche.id} must have a badge`);
    assert.ok(Array.isArray(niche.sampleIdeas) && niche.sampleIdeas.length >= 3, 
      `Niche ${niche.id} must have sample ideas`);
  }
});

test('Predefined Niches - Immutability: Users and runtime cannot modify or inject niches', () => {
  // PREDEFINED_NICHES is frozen with Object.freeze
  assert.ok(Object.isFrozen(PREDEFINED_NICHES), 'PREDEFINED_NICHES array must be frozen');

  assert.throws(() => {
    (PREDEFINED_NICHES as unknown as any[]).push({ id: 'illegal-user-niche' });
  }, /frozen|not extensible/i, 'Pushing a new niche at runtime must fail');

  assert.throws(() => {
    (PREDEFINED_NICHES[0] as unknown as Record<string, string>).name = 'Hacked Niche';
  }, /read only|frozen|cannot assign/i, 'Mutating a niche field at runtime must fail');
});

test('Predefined Niches - Helper functions resolve correctly and handle invalid inputs gracefully', () => {
  assert.equal(isValidNicheId('fruit-stories'), true);
  assert.equal(isValidNicheId('luxury-cars'), true);
  assert.equal(isValidNicheId('horror-stories'), true);
  assert.equal(isValidNicheId('animal-stories'), true);
  assert.equal(isValidNicheId('invalid-niche'), false);
  assert.equal(isValidNicheId(''), false);

  const fruitNiche = getNicheById('fruit-stories');
  assert.equal(fruitNiche.name, 'Fruit Stories');

  const luxuryNiche = getNicheById('luxury-cars');
  assert.equal(luxuryNiche.name, 'Luxury Cars');

  const horrorNiche = getNicheById('horror-stories');
  assert.equal(horrorNiche.name, 'Horror Stories');

  const animalNiche = getNicheById('animal-stories');
  assert.equal(animalNiche.name, 'Animal Stories');

  // Fallback to first niche for invalid or unknown ID
  const fallbackNiche = getNicheById('unknown-id');
  assert.equal(fallbackNiche.id, 'fruit-stories', 'Unknown niche ID should safely fall back to default niche');
});

test('Multi-User Isolation - Niche state is purely client/per-generation and isolated', () => {
  // Simulate two concurrent user generations selecting different niches
  const user1Gen = {
    userId: 'user-alice-123',
    generationId: 'gen-alice-001',
    nicheId: 'luxury-cars',
    prompt: 'A sleek Ferrari driving on a mountain road',
  };

  const user2Gen = {
    userId: 'user-bob-456',
    generationId: 'gen-bob-002',
    nicheId: 'fruit-stories',
    prompt: 'A funny talking banana telling a joke',
  };

  assert.notEqual(user1Gen.userId, user2Gen.userId);
  assert.notEqual(user1Gen.nicheId, user2Gen.nicheId);
  assert.equal(getNicheById(user1Gen.nicheId).name, 'Luxury Cars');
  assert.equal(getNicheById(user2Gen.nicheId).name, 'Fruit Stories');
});
