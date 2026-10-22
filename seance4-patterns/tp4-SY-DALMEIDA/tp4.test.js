import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createChannel, registerChannel, Channel } from './notifications/channels.js';
import { MessageBuilder } from './notifications/MessageBuilder.js';
import { ColissimoAdapter, DhlAdapter } from './shipping/adapters.js';
import { RetryQuote, CachedQuote } from './shipping/decorators.js';
import { ShippingService } from './shipping/ShippingService.js';
import { ColissimoApi, DhlClient } from '../tp4/carrierApis.js';

const parcel = { weightKg: 2, zip: '75011' };
const fake = (price, days, carrier = 'X') => ({ getQuote: async () => ({ carrier, price, days }) });
const broken = { getQuote: async () => { throw new Error('panne'); } };

test('Factory : un canal par type, erreur si inconnu', () => {
  assert.equal(createChannel('email').send({ to: 'a', body: 'x' }), '[EMAIL → a] x');
  assert.equal(createChannel('sms').send({ to: 'a', body: 'y'.repeat(200) }).length, '[SMS → a] '.length + 160);
  assert.equal(createChannel('push').send({ to: 'a', body: 'x' }), '[PUSH → a] x');
  assert.throws(() => createChannel('pigeon'), /Canal inconnu : pigeon/);
  assert.throws(() => new Channel().send({}), /abstraite/);
});

test('Factory (OCP) : Slack ajouté sans modifier channels.js', async () => {
  assert.throws(() => createChannel('slack'));
  await import('./notifications/slack.js');
  assert.equal(createChannel('slack').send({ to: 'log', body: 'ok' }), '[SLACK #log] ok');
});

test('Factory : classe invalide refusée', () => {
  assert.throws(() => registerChannel('x', class {}), /hériter/);
});

test('Builder : message valide, gelé, et 4 erreurs', () => {
  const m = new MessageBuilder().to('a@b.fr').template('Salut {{nom}}').with('nom', 'Alice').priority('haute').build();
  assert.deepEqual(m, { to: 'a@b.fr', body: 'Salut Alice', priority: 'haute' });
  assert.ok(Object.isFrozen(m));
  assert.throws(() => new MessageBuilder().template('x').build(), /Destinataire obligatoire/);
  assert.throws(() => new MessageBuilder().to('a').build(), /Gabarit obligatoire/);
  assert.throws(() => new MessageBuilder().to('a').template('x').priority('urgente').build(), /Priorité invalide : urgente/);
  assert.throws(() => new MessageBuilder().to('a').template('{{nom}}').build(), /Variable manquante : nom/);
});

test('Adapter : contrat unique pour les deux transporteurs', async () => {
  assert.deepEqual(await new ColissimoAdapter(new ColissimoApi()).getQuote(parcel), { carrier: 'Colissimo', price: 9.95, days: 2 });
  assert.deepEqual(await new DhlAdapter(new DhlClient()).getQuote(parcel), { carrier: 'DHL', price: 11, days: 1 });
});

test('Decorator Retry : absorbe 2 pannes, abandonne après 3 échecs', async () => {
  const ok = new DhlClient({ failFirst: 2 });
  assert.equal((await new RetryQuote(new DhlAdapter(ok)).getQuote(parcel)).price, 11);
  assert.equal(ok.calls, 3);
  const ko = new DhlClient({ failFirst: 3 });
  await assert.rejects(new RetryQuote(new DhlAdapter(ko)).getQuote(parcel), /503/);
  assert.equal(ko.calls, 3);
});

test('Decorator Cache : évite le 2e appel, expire, se compose avec Retry', async () => {
  let t = 0;
  const client = new DhlClient();
  const cached = new CachedQuote(new DhlAdapter(client), { ttlMs: 1000, now: () => t });
  await cached.getQuote(parcel); await cached.getQuote(parcel);
  assert.equal(client.calls, 1);
  t = 2000; await cached.getQuote(parcel);
  assert.equal(client.calls, 2);

  const c2 = new DhlClient({ failFirst: 1 });
  const composed = new CachedQuote(new RetryQuote(new DhlAdapter(c2)));
  await composed.getQuote(parcel); await composed.getQuote(parcel);
  assert.equal(c2.calls, 2); // 1 échec + 1 succès, puis cache
});

test('Facade : le moins cher, puis le plus rapide ; un transporteur en panne est ignoré', async () => {
  const real = new ShippingService([new ColissimoAdapter(new ColissimoApi()), new DhlAdapter(new DhlClient())]);
  assert.equal((await real.bestQuote({ weightKg: 2, zip: '75011' })).carrier, 'Colissimo');
  assert.equal((await real.bestQuote({ weightKg: 10, zip: '75011' })).carrier, 'DHL');
  assert.equal((await new ShippingService([fake(5, 3, 'A'), fake(5, 1, 'B')]).bestQuote(parcel)).carrier, 'B');
  assert.equal((await new ShippingService([broken, fake(9, 2, 'OK')]).bestQuote(parcel)).carrier, 'OK');
  await assert.rejects(new ShippingService([]).bestQuote(parcel), /Aucun transporteur disponible/);
});