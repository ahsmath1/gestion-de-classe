/** V7 — suivi manuel de la progression pédagogique, indépendant des appels et activités. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';
import { curriculum } from './curriculum-data.js';

const STORE_PREFIX = 'progressionHistory_';
const STATUSES = ['À faire', 'En cours', 'Terminée', 'À reprendre'];
const MASTERY = ['', 'Satisfaisant', 'Partiel', 'Insuffisant'];

const methods = {
  async getProgressionHistory() {
    const row = await db.get('settings', STORE_PREFIX + this.activeSchoolYear);
    return Array.isArray(row?.value) ? row.value : [];
  },

  async saveProgressionHistory(history) {
    await db.put('settings', { key: STORE_PREFIX + this.activeSchoolYear, value: history });
  },

  getProgressionTask(classId, periodId, lessonId, taskId) {
    const level = String(classId || '').startsWith('2AC') ? '2AC' : '3AC';
    const period = curriculum[level]?.find(p => p.id === periodId);
    const lesson = period?.lessons.find(l => l.id === lessonId);
    const task = lesson?.tasks.find(t => t.id === taskId);
    return task ? { level, period, lesson, task } : null;
  },

  async renderProgression() {
    const classSelect = document.getElementById('progression-class');
    if (!classSelect) return;
    const previousClass = classSelect.value || this.progressionPreferredClass || '2AC-12';
    const classes = await db.getAll('classes');
    classSelect.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name || c.id)}</option>`).join('');
    classSelect.value = classes.some(c => c.id === previousClass) ? previousClass : (classes[0]?.id || '2AC-12');

    const periodSelect = document.getElementById('progression-period');
    if (!periodSelect.options.length) periodSelect.innerHTML = [1,2,3,4,5].map(n => `<option value="P${n}">Période ${n}</option>`).join('');
    if (!periodSelect.value) periodSelect.value = 'P1';
    this.populateProgressionLessons();
    await this.refreshProgressionStatus();
  },

  populateProgressionLessons() {
    const level = String(document.getElementById('progression-class')?.value || '2AC-12').startsWith('2AC') ? '2AC' : '3AC';
    const periodId = document.getElementById('progression-period')?.value || 'P1';
    const period = curriculum[level]?.find(p => p.id === periodId);
    const lessonSelect = document.getElementById('progression-lesson');
    const taskSelect = document.getElementById('progression-task');
    if (!lessonSelect || !taskSelect) return;
    const previousLesson = lessonSelect.value;
    lessonSelect.innerHTML = (period?.lessons || []).map(l => `<option value="${this.escapeHtml(l.id)}">${this.escapeHtml(l.name)}</option>`).join('');
    if (period?.lessons.some(l => l.id === previousLesson)) lessonSelect.value = previousLesson;
    this.populateProgressionTasks();
  },

  populateProgressionTasks() {
    const classId = document.getElementById('progression-class')?.value || '2AC-12';
    const level = classId.startsWith('2AC') ? '2AC' : '3AC';
    const periodId = document.getElementById('progression-period')?.value || 'P1';
    const lessonId = document.getElementById('progression-lesson')?.value;
    const lesson = curriculum[level]?.find(p => p.id === periodId)?.lessons.find(l => l.id === lessonId);
    const taskSelect = document.getElementById('progression-task');
    if (!taskSelect) return;
    const previousTask = taskSelect.value;
    taskSelect.innerHTML = (lesson?.tasks || []).map(t => `<option value="${this.escapeHtml(t.id)}">${this.escapeHtml(t.code)} — ${this.escapeHtml(t.title)}</option>`).join('');
    if (lesson?.tasks.some(t => t.id === previousTask)) taskSelect.value = previousTask;
    const date = document.getElementById('progression-date');
    if (date && !date.value) date.value = this.getTodayISO();
  },

  async progressionSelectionChanged() {
    this.populateProgressionLessons();
    await this.refreshProgressionStatus();
  },

  async progressionLessonChanged() {
    this.populateProgressionTasks();
    await this.refreshProgressionStatus();
  },

  async refreshProgressionStatus() {
    const classId = document.getElementById('progression-class')?.value || '2AC-12';
    const periodId = document.getElementById('progression-period')?.value || 'P1';
    const lessonId = document.getElementById('progression-lesson')?.value;
    const taskId = document.getElementById('progression-task')?.value;
    const statusSelect = document.getElementById('progression-status');
    if (statusSelect && !statusSelect.options.length) statusSelect.innerHTML = STATUSES.map(s => `<option value="${this.escapeHtml(s)}">${this.escapeHtml(s)}</option>`).join('');
    const masterySelect = document.getElementById('progression-mastery');
    if (masterySelect && !masterySelect.options.length) masterySelect.innerHTML = MASTERY.map(s => `<option value="${this.escapeHtml(s)}">${this.escapeHtml(s || 'Non renseigné')}</option>`).join('');
    const history = await this.getProgressionHistory();
    const item = this.getProgressionTask(classId, periodId, lessonId, taskId);
    const taskKey = item ? `${classId}|${item.period.id}|${item.lesson.id}|${item.task.id}` : '';
    const latest = history.filter(h => h.taskKey === taskKey).sort((a,b) => b.savedAt.localeCompare(a.savedAt))[0];
    if (latest && statusSelect) statusSelect.value = latest.status;
    else if (statusSelect && !statusSelect.dataset.userChanged) statusSelect.value = 'Terminée';
    if (masterySelect) masterySelect.value = latest?.mastery || '';
    const detail = document.getElementById('progression-selected-task');
    if (detail) detail.textContent = item ? `${item.lesson.name} · ${item.task.code} — ${item.task.title}` : 'Aucune tâche disponible pour cette sélection.';
    await this.renderProgressionOverview(history, classId, periodId);
  },

  async renderProgressionOverview(historyArg, selectedClass, selectedPeriod) {
    const history = historyArg || await this.getProgressionHistory();
    const classId = selectedClass || document.getElementById('progression-class')?.value || '2AC-12';
    const periodId = selectedPeriod || document.getElementById('progression-period')?.value || 'P1';
    const latestMap = new Map();
    history.filter(h => h.classId === classId && h.periodId === periodId).sort((a,b) => a.savedAt.localeCompare(b.savedAt)).forEach(h => latestMap.set(h.taskKey, h));
    const counts = Object.fromEntries(STATUSES.map(s => [s, 0]));
    for (const h of latestMap.values()) if (counts[h.status] !== undefined) counts[h.status]++;
    const totalTasks = (String(classId).startsWith('2AC') ? curriculum['2AC'] : curriculum['3AC']).find(p => p.id === periodId)?.lessons.reduce((n,l)=>n+l.tasks.length,0) || 0;
    const done = counts['Terminée'] || 0;
    const percent = totalTasks ? Math.round(done / totalTasks * 100) : 0;
    const summary = document.getElementById('progression-summary');
    if (summary) summary.innerHTML = `
      <div class="progression-stat"><strong>${done}</strong><span>Terminées</span></div>
      <div class="progression-stat"><strong>${counts['En cours']}</strong><span>En cours</span></div>
      <div class="progression-stat"><strong>${counts['À reprendre']}</strong><span>À reprendre</span></div>
      <div class="progression-stat"><strong>${Math.max(0,totalTasks-latestMap.size)}</strong><span>Sans statut</span></div>
      <div class="progression-progress"><div class="progression-progress-label"><span>Progression enregistrée</span><strong>${percent}%</strong></div><div class="progression-progress-track"><span style="width:${percent}%"></span></div><small>${done} tâche(s) terminée(s) sur ${totalTasks} tâche(s) programmée(s) dans cette période. Ce chiffre ne mesure pas la maîtrise des élèves.</small></div>`;
    const list = document.getElementById('progression-history-list');
    if (!list) return;
    const recent = history.filter(h => h.classId === classId && h.periodId === periodId).sort((a,b) => b.savedAt.localeCompare(a.savedAt)).slice(0,12);
    list.innerHTML = recent.length ? recent.map(h => `<article class="progression-history-item"><div><strong>${this.escapeHtml(h.taskCode)} — ${this.escapeHtml(h.taskTitle)}</strong><small>${this.escapeHtml(h.date)} · ${this.escapeHtml(h.lessonTitle)}</small>${h.mastery ? `<small>Bilan de maîtrise : ${this.escapeHtml(h.mastery)}</small>` : ''}</div><span class="progression-status-chip status-${this.escapeHtml(h.status).toLowerCase().replace(/[^a-zà-ÿ]+/g,'-')}">${this.escapeHtml(h.status)}</span></article>`).join('') : '<p class="help-text">Aucune séance enregistrée pour cette classe et cette période. Choisissez une tâche puis enregistrez la séance.</p>';
  },

  async saveProgressionSession() {
    const classId = document.getElementById('progression-class')?.value;
    const periodId = document.getElementById('progression-period')?.value;
    const lessonId = document.getElementById('progression-lesson')?.value;
    const taskId = document.getElementById('progression-task')?.value;
    const status = document.getElementById('progression-status')?.value;
    const date = document.getElementById('progression-date')?.value || this.getTodayISO();
    const mastery = document.getElementById('progression-mastery')?.value || '';
    const selected = this.getProgressionTask(classId, periodId, lessonId, taskId);
    if (!selected) { this.showToast('Choisissez une tâche de la programmation.', 'warning'); return; }
    if (!date || !STATUSES.includes(status)) { this.showToast('Vérifiez la date et le statut de la séance.', 'warning'); return; }
    const history = await this.getProgressionHistory();
    const savedAt = new Date().toISOString();
    const taskKey = `${classId}|${selected.period.id}|${selected.lesson.id}|${selected.task.id}`;
    history.push({ id: `prog_${Date.now()}_${Math.random().toString(36).slice(2,8)}`, taskKey, schoolYear: this.activeSchoolYear, classId, periodId, periodName: selected.period.name, lessonId, lessonTitle: selected.lesson.name, taskId, taskCode: selected.task.code, taskTitle: selected.task.title, date, status, mastery, savedAt });
    await this.saveProgressionHistory(history);
    this.showSaveIndicator();
    this.showToast(`Séance enregistrée : ${classId} · ${selected.task.code} · ${status}`, 'success', 3000);
    await this.refreshProgressionStatus();
  },

  async openProgressionFromToday(classId) {
    const preferred = classId || this.activeCourse?.classId || document.getElementById('rollcall-class')?.textContent?.trim() || '2AC-12';
    this.progressionPreferredClass = preferred;
    this.navigateTo('view-progression');
  }
};
Object.assign(AbsenceApp.prototype, methods);
