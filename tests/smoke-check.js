// Contrôles statiques rapides (ne remplacent pas un test dans Chrome/Safari).
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const checks = [
  ['version applicative 6.0.1', app.includes("appVersion: '6.0.1'")],
  ['version de cache PWA 6.0.1', sw.includes('gestion-classe-v6.0.1')],
  ['validation de sauvegarde avant restauration', app.includes('this.validateBackupData(data)')],
  ['validation de sauvegarde avant fusion', app.includes('this.validateBackupData(incoming)')],
  ['compteur de sauvegarde persistant', app.includes('autoBackupChangeCounter_${this.activeSchoolYear}')],
  ['restauration de sauvegarde locale', app.includes('async restoreLocalAutoBackup()')],
  ['affectation à un groupe de remédiation', app.includes('async saveStudentRemediationGroup(studentId)')],
  ['filtre par groupe de remédiation', app.includes('select-remediation-group-filter')],
  ['réorganisation des élèves conservée', app.includes('async moveStudent(studentId, direction)')],
  ['sections de rapport conditionnelles conservées', app.includes("generalRemark ? `<h2>Remarques générales</h2>")],
  ['bouton de restauration locale présent', html.includes('app.restoreLocalAutoBackup()')],
  ['Action collective présente', html.includes('id="btn-bulk-activity"') && app.includes('openBulkActivityModal')],
  ['créneau du vendredi découpé', fs.readFileSync(path.join(root, 'js/db.js'), 'utf8').includes('c_ven_1b')]
];
let failed = false;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK' : 'ÉCHEC'} — ${label}`);
  if (!ok) failed = true;
}
if (failed) process.exit(1);
console.log(`\n${checks.length} contrôles statiques réussis.`);
