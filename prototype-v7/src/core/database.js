// Couche IndexedDB de la V7.
// Contrat de compatibilité avec la V6.0.1 : même base (AbsenceAppDB), même version (9),
// mêmes magasins, mêmes clés et mêmes index. Aucune migration destructive.
export const DB_NAME = 'AbsenceAppDB';
export const DB_VERSION = 9;

export const SCHEMA = {
  classes:            { keyPath: 'id',   indexes: ['schoolYear'] },
  students:           { keyPath: 'id',   indexes: ['classId', 'schoolYear'] },
  timetable:          { keyPath: 'id',   indexes: ['day', 'schoolYear'] },
  attendance:         { keyPath: 'id',   indexes: ['date', 'studentId', 'courseId', 'schoolYear'] },
  calendar:           { keyPath: 'id',   indexes: ['schoolYear'] },
  settings:           { keyPath: 'key',  indexes: [] },
  sessions:           { keyPath: 'id',   indexes: ['date', 'courseId', 'schoolYear'] },
  activityCategories: { keyPath: 'id',   indexes: ['order', 'schoolYear'] },
  activityActions:    { keyPath: 'id',   indexes: ['categoryId', 'order', 'schoolYear'] },
  activityEvents:     { keyPath: 'id',   indexes: ['studentId', 'date', 'categoryId', 'actionId', 'schoolYear'] },
  schoolYears:        { keyPath: 'year', indexes: [] },
  classReminders:     { keyPath: 'id',   indexes: ['classId', 'dueDate', 'schoolYear'] },
  classEvents:        { keyPath: 'id',   indexes: ['classId', 'date', 'schoolYear'] }
};

export class DbError extends Error {
  constructor(code, message) { super(message); this.name = 'DbError'; this.code = code; }
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

// Inspecte la base SANS la créer ni la modifier. Une base absente est annulée avant d'exister.
export function peek() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new DbError('UNAVAILABLE', "IndexedDB n'est pas disponible dans ce navigateur.")); return; }
    let missing = false;
    const request = indexedDB.open(DB_NAME);            // sans numéro de version : n'ouvre que l'existant
    request.onupgradeneeded = (ev) => { if (ev.oldVersion === 0) { missing = true; request.transaction.abort(); } };
    request.onsuccess = () => {
      const d = request.result;
      const info = { exists: true, version: d.version, stores: [...d.objectStoreNames] };
      d.close();
      resolve(info);
    };
    request.onerror = () => { if (missing) resolve({ exists: false, version: 0, stores: [] }); else reject(request.error); };
    request.onblocked = () => reject(new DbError('BLOCKED', 'Ouverture bloquée par un autre onglet.'));
  });
}

function createMissingSchema(database, transaction) {
  for (const [name, def] of Object.entries(SCHEMA)) {
    const store = database.objectStoreNames.contains(name)
      ? transaction.objectStore(name)
      : database.createObjectStore(name, { keyPath: def.keyPath });
    for (const idx of def.indexes) if (!store.indexNames.contains(idx)) store.createIndex(idx, idx, { unique: false });
  }
}

export class Database {
  constructor() { this.db = null; }

  // allowCreate=false : refuse d'ouvrir si la base n'existe pas (aucune création accidentelle).
  async open({ allowCreate = false } = {}) {
    const info = await peek();
    if (!info.exists && !allowCreate) throw new DbError('MISSING', 'Aucune base de données trouvée sur cet appareil pour cette adresse.');
    if (info.exists && info.version > DB_VERSION) throw new DbError('TOO_NEW', `La base est en version ${info.version}, plus récente que cette application (${DB_VERSION}). Aucune écriture n'est faite.`);
    if (info.exists && info.version < DB_VERSION) throw new DbError('TOO_OLD', `La base est en version ${info.version} : la mise à niveau vers ${DB_VERSION} n'est pas encore implémentée dans la V7 (prévue avec les sauvegardes). Aucune écriture n'est faite.`);
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        if (info.exists) request.transaction.abort();     // ne jamais mettre à niveau une base existante ici
        else createMissingSchema(request.result, request.transaction);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new DbError('BLOCKED', 'Ouverture bloquée par un autre onglet.'));
    });
    this.db.onversionchange = () => { this.db.close(); this.db = null; };
    const problems = this.verifySchema();
    if (problems.length) { this.close(); throw new DbError('SCHEMA', `Structure inattendue : ${problems.join(' ; ')}`); }
    return this;
  }

  close() { if (this.db) { this.db.close(); this.db = null; } }

  describe() {
    const out = {};
    for (const name of this.db.objectStoreNames) {
      const tx = this.db.transaction(name, 'readonly');
      const s = tx.objectStore(name);
      out[name] = { keyPath: s.keyPath, indexes: [...s.indexNames].sort() };
    }
    return out;
  }

  verifySchema() {
    const found = this.describe();
    const problems = [];
    for (const [name, def] of Object.entries(SCHEMA)) {
      if (!found[name]) { problems.push(`magasin « ${name} » absent`); continue; }
      if (found[name].keyPath !== def.keyPath) problems.push(`clé de « ${name} » différente`);
      for (const idx of def.indexes) if (!found[name].indexes.includes(idx)) problems.push(`index « ${name}.${idx} » absent`);
    }
    return problems;
  }

  // Transaction unique ; la promesse ne se résout qu'à la VALIDATION (oncomplete), pas à la requête.
  _run(stores, mode, work) {
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = this.db.transaction(stores, mode); } catch (e) { reject(e); return; }
      let out;
      tx.oncomplete = () => resolve(out);
      tx.onabort = () => reject(tx.error || new DbError('ABORT', 'Transaction annulée.'));
      try {
        Promise.resolve(work(tx)).then(v => { out = v; }, e => { try { tx.abort(); } catch (_) {} reject(e); });
      } catch (e) { try { tx.abort(); } catch (_) {} reject(e); }
    });
  }

  get(store, key)            { return this._run(store, 'readonly',  tx => req(tx.objectStore(store).get(key))); }
  getAll(store)              { return this._run(store, 'readonly',  tx => req(tx.objectStore(store).getAll())); }
  getAllByIndex(store, index, key) { return this._run(store, 'readonly', tx => req(tx.objectStore(store).index(index).getAll(key))); }
  count(store)               { return this._run(store, 'readonly',  tx => req(tx.objectStore(store).count())); }
  put(store, item)           { return this._run(store, 'readwrite', tx => req(tx.objectStore(store).put(item))); }
  putMany(store, items)      { return this._run(store, 'readwrite', tx => { const s = tx.objectStore(store); for (const it of items) s.put(it); }); }
  delete(store, key)         { return this._run(store, 'readwrite', tx => req(tx.objectStore(store).delete(key))); }

  // Lecture cohérente de tous les magasins dans une seule transaction (lecture seule).
  snapshot() {
    const names = Object.keys(SCHEMA);
    return this._run(names, 'readonly', async (tx) => {
      const out = {};
      for (const n of names) out[n] = await req(tx.objectStore(n).getAll());
      return out;
    });
  }

  // Remplacement atomique : tout est validé ou rien ne change.
  replaceStores(payload) {
    const names = Object.keys(payload);
    const unknown = names.filter(n => !SCHEMA[n]);
    if (unknown.length) return Promise.reject(new DbError('SCHEMA', `Magasin(s) inconnu(s) : ${unknown.join(', ')}`));
    if (!names.length) return Promise.resolve();
    return this._run(names, 'readwrite', (tx) => {
      for (const n of names) {
        const s = tx.objectStore(n);
        s.clear();
        for (const item of payload[n]) s.put(item);   // une erreur ici annule toute la transaction
      }
    });
  }
}

export const db = new Database();
