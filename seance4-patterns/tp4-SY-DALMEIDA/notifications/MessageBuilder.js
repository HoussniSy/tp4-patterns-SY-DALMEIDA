const PRIORITES = ['basse', 'normale', 'haute'];

export class MessageBuilder {
  #to; #template; #vars = {}; #priority = 'normale';

  to(v) { this.#to = v; return this; }
  template(t) { this.#template = t; return this; }
  with(nom, valeur) { this.#vars[nom] = valeur; return this; }
  priority(p) { this.#priority = p; return this; }

  build() {
    if (!this.#to) throw new Error('Destinataire obligatoire');
    if (!this.#template) throw new Error('Gabarit obligatoire');
    if (!PRIORITES.includes(this.#priority)) {
      throw new Error(`Priorité invalide : ${this.#priority}`);
    }
    const body = this.#template.replace(/\{\{(\w+)\}\}/g, (_, nom) => {
      if (!Object.hasOwn(this.#vars, nom)) throw new Error(`Variable manquante : ${nom}`);
      return this.#vars[nom];
    });
    return Object.freeze({ to: this.#to, body, priority: this.#priority });
  }
}