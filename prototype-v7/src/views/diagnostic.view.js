import { h, mount } from '../core/dom.js';
import { action } from '../core/events.js';
import { analyze } from '../services/diagnostic.service.js';
import { DB_NAME, DB_VERSION } from '../core/database.js';
import { Toast } from '../components/Toast.js';

const table = (head, rows) => h('div', { class: 'v7-table-wrap' },
  h('table', { class: 'v7-table' },
    h('thead', {}, h('tr', {}, head.map((t, i) => h('th', { class: i ? 'num' : '' }, t)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map((c, i) => h('td', { class: i && typeof c !== 'object' ? 'num' : '' }, c)))))));

export function createDiagnosticView({ db }) {
  let lastReport = null;

  action('diag-download', () => {
    if (!lastReport) return;
    const blob = new Blob([JSON.stringify(lastReport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `diagnostic_v7_${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  action('diag-refresh', async () => { Toast.show('Analyse relancée', 'info', 1400); await view.refresh(); });

  const view = {
    section: null,
    async render(_params, ctx) {
      this.section = document.getElementById('view-diagnostic');
      mount(this.section, h('div', { class: 'card' }, h('p', {}, 'Analyse en cours…')));
      const report = await analyze(db);
      if (ctx?.isStale?.()) return;                 // une autre vue a pris la place : on n'écrit rien
      lastReport = { generatedAt: new Date().toISOString(), database: { name: DB_NAME, version: DB_VERSION }, ...report };
      mount(this.section, ...build(report));
    },
    refresh() { return this.render({}, null); }
  };
  return view;
}

function build(r) {
  const problems = r.relations.filter(x => x.ids.length);
  return [
    h('div', { class: 'v7-note' }, 'Lecture seule : cet écran n’écrit rien dans la base. Il montre ce que la V7 voit des données de la V6.'),
    h('div', { class: 'card' },
      h('h3', {}, 'Base de données'),
      h('p', {}, `${DB_NAME} · version ${DB_VERSION} · année active : ${r.settings.activeSchoolYear ?? 'non définie'} · appVersion enregistrée : ${r.settings.appVersion ?? 'non définie'}`),
      table(['Magasin', 'Enregistrements'], Object.entries(r.counts))),
    h('div', { class: 'card' },
      h('h3', {}, 'Classes'),
      r.perClass.length
        ? table(['Classe', 'Élèves actifs', 'Archivés'], r.perClass.map(c => [c.name ?? c.id, c.active, c.archived]))
        : h('p', {}, 'Aucune classe.')),
    h('div', { class: 'card' },
      h('h3', {}, 'Relations et cohérence'),
      table(['Contrôle', 'Cas'], r.relations.map(x => [x.label, h('span', { class: x.ids.length ? 'v7-ko' : 'v7-ok' }, x.ids.length ? String(x.ids.length) : 'OK')])),
      problems.length ? h('div', { class: 'v7-note warn' }, 'Des incohérences existent déjà dans les données de la V6. Rien n’est corrigé automatiquement ; le rapport JSON liste les identifiants concernés.') : null,
      Object.keys(r.missingYear).length ? h('div', { class: 'v7-note warn' }, `Enregistrements sans année scolaire : ${Object.entries(r.missingYear).map(([k, v]) => `${k} (${v})`).join(', ')}`) : null),
    h('div', { class: 'action-buttons-row' },
      h('button', { class: 'btn btn-primary', dataset: { action: 'diag-download' } }, '⬇ Télécharger le rapport (JSON)'),
      h('button', { class: 'btn btn-secondary', dataset: { action: 'diag-refresh' } }, '↻ Relancer l’analyse'))
  ];
}
