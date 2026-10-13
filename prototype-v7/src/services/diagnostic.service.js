// Analyse en LECTURE SEULE : intégrité des relations et qualité des données.
// Ne contient aucune écriture ; elle s'appuie uniquement sur db.snapshot().
const YEAR_STORES = ['classes', 'students', 'timetable', 'attendance', 'calendar', 'sessions',
  'activityCategories', 'activityActions', 'activityEvents', 'classReminders', 'classEvents'];

export const normalizeName = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

export async function analyze(db) {
  const snap = await db.snapshot();
  const classIds = new Set(snap.classes.map(c => c.id));
  const studentIds = new Set(snap.students.map(s => s.id));
  const courseIds = new Set(snap.timetable.map(c => c.id));
  const counts = Object.fromEntries(Object.entries(snap).map(([k, v]) => [k, v.length]));

  const ids = (rows) => rows.map(r => r.id);
  const orphanStudents = snap.students.filter(s => !classIds.has(s.classId));
  const attNoStudent = snap.attendance.filter(a => !studentIds.has(a.studentId));
  const attNoCourse = snap.attendance.filter(a => !courseIds.has(a.courseId));
  const attNoClass = snap.attendance.filter(a => !classIds.has(a.classId));
  const attBadStatus = snap.attendance.filter(a => a.status !== 'A' && a.status !== 'R');
  const slotsNoClass = snap.timetable.filter(c => !classIds.has(c.classId));
  const actNoStudent = snap.activityEvents.filter(e => !studentIds.has(e.studentId));

  // Doubles enregistrements logiques : même (date, créneau, élève) sous des identifiants différents.
  const seen = new Map(); const attDuplicates = [];
  for (const a of snap.attendance) {
    const k = `${a.date}|${a.courseId}|${a.studentId}`;
    if (seen.has(k)) attDuplicates.push(a.id); else seen.set(k, a.id);
  }

  // Élèves actifs en doublon dans une même classe (même nom + prénom normalisés).
  const names = new Map(); const studentDuplicates = [];
  for (const s of snap.students.filter(x => !x.archived)) {
    const k = `${s.classId}|${normalizeName(s.nom)}|${normalizeName(s.prenom)}`;
    if (names.has(k)) studentDuplicates.push(s.id); else names.set(k, s.id);
  }

  const missingYear = {};
  for (const n of YEAR_STORES) { const c = snap[n].filter(r => !r.schoolYear).length; if (c) missingYear[n] = c; }

  const perClass = snap.classes.map(c => ({
    id: c.id, name: c.name,
    active: snap.students.filter(s => s.classId === c.id && !s.archived).length,
    archived: snap.students.filter(s => s.classId === c.id && s.archived).length
  }));

  const relations = [
    { key: 'orphanStudents',  label: 'Élèves dont la classe n’existe plus',            ids: ids(orphanStudents) },
    { key: 'slotsNoClass',    label: 'Créneaux dont la classe n’existe plus',            ids: ids(slotsNoClass) },
    { key: 'attNoStudent',    label: 'Présences dont l’élève n’existe plus',             ids: ids(attNoStudent) },
    { key: 'attNoCourse',     label: 'Présences dont le créneau n’existe plus',          ids: ids(attNoCourse) },
    { key: 'attNoClass',      label: 'Présences dont la classe n’existe plus',           ids: ids(attNoClass) },
    { key: 'attBadStatus',    label: 'Présences avec un statut autre que A ou R',        ids: ids(attBadStatus) },
    { key: 'attDuplicates',   label: 'Présences en double (même date, créneau, élève)',  ids: attDuplicates },
    { key: 'actNoStudent',    label: 'Événements d’activité dont l’élève n’existe plus', ids: ids(actNoStudent) },
    { key: 'studentDuplicates', label: 'Élèves actifs en doublon (même classe, nom, prénom)', ids: studentDuplicates }
  ];

  return { counts, perClass, relations, missingYear,
    settings: { appVersion: snap.settings.find(r => r.key === 'appVersion')?.value ?? null,
                activeSchoolYear: snap.settings.find(r => r.key === 'activeSchoolYear')?.value ?? null } };
}
