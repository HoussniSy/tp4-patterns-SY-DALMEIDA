export class Channel {
  send(message) { throw new Error('méthode abstraite'); }
}
export class EmailChannel extends Channel {
  send({ to, body }) { return `[EMAIL → ${to}] ${body}`; }
}
export class SmsChannel extends Channel {
  send({ to, body }) { return `[SMS → ${to}] ${body.slice(0, 160)}`; }
}
export class PushChannel extends Channel {
  send({ to, body }) { return `[PUSH → ${to}] ${body}`; }
}

const registry = new Map([
  ['email', EmailChannel],
  ['sms', SmsChannel],
  ['push', PushChannel],
]);

export function registerChannel(type, Classe) {
  if (!(Classe.prototype instanceof Channel)) {
    throw new Error('La classe doit hériter de Channel');
  }
  registry.set(type, Classe);
}

export function createChannel(type) {
  const C = registry.get(type);
  if (!C) throw new Error(`Canal inconnu : ${type}`);
  return new C();
}