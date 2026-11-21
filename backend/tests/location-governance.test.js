import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listLocationKnowledge } from '../controllers/locationKnowledgeController.js';
import { publicLocationMatches, resolveLocation, setApprovedLocationKnowledge } from '../services/locationIntelligenceService.js';

test('approved dynamic location knowledge becomes searchable without replacing verified static data', () => {
  setApprovedLocationKnowledge([{ id: 'knowledge-test', canonicalName: 'Test Student Centre', names: { en: 'Test Student Centre' }, aliases: ['student center shortcut'], area: 'Oluvil Campus', verificationStatus: 'university-approved', sensitivity: 'public' }]);
  assert.equal(resolveLocation('student center shortcut').best?.id, 'knowledge-test');
  assert.equal(resolveLocation('SEUSL main gate').best?.id, 'seusl-main-gate');
  setApprovedLocationKnowledge([]);
});

test('location governance requires human review and keeps version history', () => {
  const model = fs.readFileSync(new URL('../models/LocationKnowledge.js', import.meta.url), 'utf8');
  const controller = fs.readFileSync(new URL('../controllers/locationKnowledgeController.js', import.meta.url), 'utf8');
  const routes = fs.readFileSync(new URL('../routes/locationKnowledgeRoutes.js', import.meta.url), 'utf8');
  assert.match(model, /community-suggested/);
  assert.match(model, /history/);
  assert.match(model, /sensitivity/);
  assert.match(controller, /refreshApprovedLocations/);
  assert.match(controller, /ACTIVE_STATUSES/);
  assert.match(routes, /authorize\('admin'\)/);
  assert.match(routes, /protect, locationSuggestionValidator, validate, submitLocationSuggestion/);
});

test('the admin directory lists referenced locations without querying the suggestion queue', async () => {
  const list = (query) => new Promise((resolve, reject) => {
    const response = { status: () => response, json: ({ data }) => resolve(data) };
    listLocationKnowledge({ query: { scope: 'catalog', limit: '2', ...query } }, response, reject);
  });
  const first = await list({});
  const second = await list({ page: '2' });
  assert.ok(first.pagination.totalDocs > 100);
  assert.equal(second.pagination.totalDocs, first.pagination.totalDocs);
  assert.equal(second.records.length, 2);
  assert.ok(second.records.every((record) => record.sourceReference.startsWith('https://') && !record._id));
  assert.ok(second.records.every((record) => first.records.every(({ id }) => record.id !== id)));

  const library = await list({ search: 'ஒலுவில் பொது நூலகம்', status: 'map-source-verified' });
  assert.deepEqual(library.records.map(({ id }) => id), ['oluvil-public-library']);
  assert.equal((await list({ search: 'hospital road' })).records[0].id, 'oluvil-hospital-road');
});

test('local landmarks resolve precisely and residence candidates remain approximate', () => {
  assert.equal(resolveLocation('near the Hela Bojun canteen').best?.id, 'seusl-hela-bojun');
  assert.equal(resolveLocation('tech faculty').best?.id, 'seusl-ft');
  assert.equal(resolveLocation('ஒலுவில் பொது நூலகம்').best?.id, 'oluvil-public-library');
  assert.equal(resolveLocation('Oluvil 06').best?.id, 'oluvil-gn-6');
  assert.equal(publicLocationMatches(resolveLocation('student hostel'))[0].precision, 'approximate');
  assert.equal(publicLocationMatches(resolveLocation('student hostel'))[0].canonicalName, undefined);
});
