import test from 'node:test';
import assert from 'node:assert/strict';
import AssistantSession from '../models/AssistantSession.js';
import FoundItem from '../models/FoundItem.js';
import LostItem from '../models/LostItem.js';
import { handleAIChat } from '../controllers/aiChatController.js';

const chat = (body) => new Promise((resolve, reject) => {
  handleAIChat({ body, user: null }, { status() { return this; }, json(payload) { resolve(payload.data); } }, reject);
});

test('guided conversation asks first, searches remembered details, then offers a reviewed draft', async (t) => {
  const previousEnabled = process.env.AI_ENABLED;
  process.env.AI_ENABLED = 'false';
  t.after(() => { if (previousEnabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = previousEnabled; });
  let record;
  t.mock.method(AssistantSession, 'findOne', async () => record || null);
  t.mock.method(AssistantSession, 'create', async (value) => { record = new AssistantSession(value); return record; });
  t.mock.method(AssistantSession, 'findOneAndUpdate', async (query, update) => {
    assert.equal(query.stateVersion, record.stateVersion);
    record.set(update.$set);
    record.stateVersion += 1;
    return record;
  });
  const queries = [];
  t.mock.method(FoundItem, 'find', (query) => {
    queries.push(query);
    const chain = { select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [{
      _id: '6a9c1b828e518e201dfd3ebb', itemName: 'Microphone', category: 'Electronics',
      description: 'A black microphone', colors: ['black'], foundLocation: 'Canteen', status: 'available', foundDate: new Date(),
    }] };
    return chain;
  });
  const base = { sessionId: 'guided-behavior-test', history: [], locale: 'en' };
  let result = await chat({ ...base, message: 'I lost something', sessionVersion: 0 });
  assert.equal(result.sessionState.nextField, 'itemName');
  assert.equal(queries.length, 0);
  result = await chat({ ...base, message: 'microphone', sessionVersion: result.sessionState.version });
  assert.equal(result.sessionState.fields.itemName, 'Microphone');
  assert.equal(result.sessionState.nextField, 'location');
  assert.equal(queries.length, 0);
  result = await chat({ ...base, message: 'canteen yesterday', sessionVersion: result.sessionState.version });
  assert.equal(result.items[0].itemName, 'Microphone');
  assert.match(result.text, /match in found-item reports/);
  assert.match(result.query.message, /Microphone.*Canteen/);
  assert.equal(result.sessionState.nextField, 'uniqueFeatures');
  assert.ok(queries.length > 0);
  assert.equal(result.items[0].url, '/found-items/6a9c1b828e518e201dfd3ebb');
  result = await chat({ ...base, message: 'has a white keytag', sessionVersion: result.sessionState.version });
  assert.equal(result.sessionState.fields.itemName, 'Microphone');
  assert.equal(result.reportDraft.state, 'reviewing');
  assert.doesNotMatch(result.query.message, /keytag|white/);
  assert.notEqual(record.state, 'submitted');
});

test('the Singlish finder gets a found draft and read-only pagination of lost matches', async (t) => {
  const previousEnabled = process.env.AI_ENABLED;
  process.env.AI_ENABLED = 'false';
  t.after(() => { if (previousEnabled === undefined) delete process.env.AI_ENABLED; else process.env.AI_ENABLED = previousEnabled; });
  let record;
  t.mock.method(AssistantSession, 'findOne', async () => record || null);
  t.mock.method(AssistantSession, 'create', async (data) => { record = new AssistantSession(data); return record; });
  const update = t.mock.method(AssistantSession, 'findOneAndUpdate', async (query, changes) => {
    assert.equal(query.stateVersion, record.stateVersion);
    record.set(changes.$set);
    record.stateVersion += 1;
    return record;
  });
  t.mock.method(FoundItem, 'find', () => assert.fail('A finder should only receive matching lost reports'));
  const find = t.mock.method(LostItem, 'find', () => ({
    select() { return this; }, sort() { return this; }, limit() { return this; },
    lean: async () => ['6a9c1b828e518e201dfd3ebb', '6a9c1b828e518e201dfd3ebc'].map((_id) => ({
      _id, itemName: 'Gaming mouse', category: 'Electronics', description: 'A black gaming mouse', lostLocation: 'Main Library', status: 'pending', lostDate: new Date(),
    })),
  }));
  const base = { sessionId: 'found-mouse-test', locale: 'en', pageSize: 1, history: [] };
  const first = await chat({ ...base, message: 'gaming mouse ekak hamba una library eke tiyala', sessionVersion: 0 });
  assert.equal(first.intent, 'found');
  assert.equal(first.responseStyle, 'singlish');
  assert.equal(first.reportDraft.fields.itemName, 'Gaming mouse');
  assert.match(first.reportDraft.fields.location, /library/i);
  assert.equal(first.reportDraft.fields.storedAt, '');
  assert.equal(first.sessionState.nextField, 'date');
  assert.match(first.text, /hoyagaththa item eka report karamu.*Mona dawaseda/);
  assert.doesNotMatch(first.text, /claim/i);
  assert.equal(first.actions[0].type, 'report_found');
  assert.deepEqual(first.items, []);
  assert.equal(find.mock.callCount(), 0);

  const second = await chat({ ...base, message: 'iye', conversationStyle: 'singlish', sessionVersion: first.sessionState.version });
  assert.equal(second.items[0].itemType, 'LostItem');
  assert.equal(second.actions[0].type, 'report_found');
  assert.match(second.text, /lost reports.*report karapu kenata danwanna/);
  assert.doesNotMatch(second.text, /claim/i);
  assert.equal(second.hasMore, true);

  const nextPage = await chat({ ...base, message: second.query.message, conversationStyle: 'singlish', page: 2, sessionVersion: second.sessionState.version });
  assert.equal(nextPage.page, 2);
  assert.notEqual(nextPage.items[0]._id, second.items[0]._id);
  assert.equal(nextPage.sessionState.version, second.sessionState.version);
  assert.equal(nextPage.sessionState.fields.uniqueFeatures, '');
  assert.equal(update.mock.callCount(), 2);
});

test('browsing found reports uses the found inventory without updating a draft', async (t) => {
  t.mock.method(AssistantSession, 'findOne', () => assert.fail('Browsing should not edit a report session'));
  t.mock.method(LostItem, 'find', () => assert.fail('Browse found reports must not query the lost inventory'));
  t.mock.method(FoundItem, 'find', () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }));
  const result = await chat({ message: 'Show items found near the library', locale: 'en', sessionId: 'browse-only', sessionVersion: 2 });
  assert.equal(result.intent, 'search');
  assert.equal(result.reportDraft, null);
  assert.deepEqual(result.actions, []);
  assert.match(result.text, /No matching found-item report/);
});

test('a new search inside a report conversation leaves the draft alone', async (t) => {
  t.mock.method(AssistantSession, 'findOne', () => assert.fail('Searching should not edit a report session'));
  for (const model of [FoundItem, LostItem]) {
    t.mock.method(model, 'find', () => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, lean: async () => [] }));
  }
  const result = await chat({ message: 'Search for a blue wallet', locale: 'en', sessionId: 'draft-open', sessionVersion: 2 });
  assert.equal(result.intent, 'search');
  assert.equal(result.sessionState, null);
  assert.equal(result.reportDraft, null);
  assert.ok(result.query.terms.includes('wallet'));
});
