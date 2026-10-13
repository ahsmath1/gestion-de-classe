import { db, peek, DB_VERSION, DbError } from './core/database.js';
import { Router } from './core/router.js';
import { attach, setErrorHandler } from './core/events.js';
import { state } from './core/state.js';
import { h, mount } from './core/dom.js';
import { Toast } from './components/Toast.js';
import { SettingsService } from './services/settings.service.js';
import { createDiagnosticView } from './views/diagnostic.view.js';

function showBlocking(kind, title, text) {
  mount(document.getElementById('view-diagnostic'),
    h('div', { class: `v7-note ${kind}` }, h('b', {}, title)), h('div', { class: 'card' }, h('p', {}, text)));
}

function surfaceErrors() {
  const show = (e) => { console.error(e); Toast.show(`Erreur : ${e?.message || e}`, 'error', 6000); };
  setErrorHandler(show);
  window.addEventListener('error', (ev) => show(ev.error || ev.message));
  window.addEventListener('unhandledrejection', (ev) => show(ev.reason));
}

async function main() {
  surfaceErrors();
  attach(document);
  let info;
  try { info = await peek(); } catch (e) { showBlocking('error', 'Stockage indisponible', e.message); return; }
  state.set({ dbInfo: info });
  if (!info.exists) {
    showBlocking('warn', 'Aucune donnée de la V6 trouvée',
      'La V7 n’a rien créé. Elle doit être servie depuis la même adresse (même origine) que la V6 pour voir ses données : IndexedDB est propre à chaque adresse.');
    return;
  }
  try { await db.open(); }
  catch (e) {
    if (e instanceof DbError) { showBlocking('error', 'Ouverture refusée par prudence', e.message); return; }
    throw e;
  }
  const settings = new SettingsService(db);
  state.set({ dbMode: 'lecture-seule', schoolYear: await settings.activeSchoolYear() });
  const router = new Router({ onError: (e) => { console.error(e); Toast.show(`Erreur : ${e.message}`, 'error', 6000); } });
  router.register('view-diagnostic', createDiagnosticView({ db }));
  await router.navigate('view-diagnostic');
}

main().catch((e) => { console.error(e); showBlocking('error', 'Échec du démarrage', e?.message || String(e)); });
