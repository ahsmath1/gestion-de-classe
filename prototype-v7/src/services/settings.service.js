// Paramètres : mêmes clés et même forme {key, value} que la V6 (magasin « settings »).
export class SettingsService {
  constructor(db) { this.db = db; }
  async get(key, fallback = null) { const row = await this.db.get('settings', key); return row ? row.value : fallback; }
  async set(key, value) { await this.db.put('settings', { key, value }); }
  async getAll() { return Object.fromEntries((await this.db.getAll('settings')).map(r => [r.key, r.value])); }
  async activeSchoolYear() { return this.get('activeSchoolYear', '2026/2027'); }
}
