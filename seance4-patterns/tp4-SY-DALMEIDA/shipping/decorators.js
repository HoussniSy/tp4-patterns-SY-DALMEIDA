export class RetryQuote {
  constructor(inner, { attempts = 3 } = {}) { this.inner = inner; this.attempts = attempts; }
  async getQuote(parcel) {
    let lastError;
    for (let i = 0; i < this.attempts; i++) {
      try { return await this.inner.getQuote(parcel); }
      catch (e) { lastError = e; }
    }
    throw lastError;
  }
}

export class CachedQuote {
  #cache = new Map();
  constructor(inner, { ttlMs = 60000, now = Date.now } = {}) {
    this.inner = inner; this.ttlMs = ttlMs; this.now = now;
  }
  async getQuote(parcel) {
    const key = `${parcel.weightKg}|${parcel.zip}`;
    const hit = this.#cache.get(key);
    if (hit && hit.expires > this.now()) return hit.value;
    const value = await this.inner.getQuote(parcel);   // une erreur n'est jamais mise en cache
    this.#cache.set(key, { value, expires: this.now() + this.ttlMs });
    return value;
  }
}