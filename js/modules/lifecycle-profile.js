/** V7 — module métier : lifecycle-profile. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async init() {
      await db.init();
      await this.loadActiveSchoolYear();
      this.changeCounter = Number((await db.get('settings', `autoBackupChangeCounter_${this.activeSchoolYear}`))?.value || 0);
      await this.loadLanguage();
      await this.applyUserInterfacePreferences();
      this.setupTheme();
      this.registerServiceWorker();
      this.bindEvents();
      this.updateCurrentDateDisplay();
      await this.renderProfile();
      await this.renderDashboard();
      await this.refreshSchoolYearSelector();
  
      // Premier lancement sur un nouvel appareil : aucun compte en ligne n'est créé.
      const configured = await db.get('settings', 'profileConfigured');
      if (!configured?.value) {
        setTimeout(() => this.showFirstSetup(), 250);
      }
    },

  async loadActiveSchoolYear() {
      const s = await db.get('settings', 'activeSchoolYear');
      this.activeSchoolYear = s?.value || '2026/2027';
      const el = document.getElementById('school-year-selector');
      if (el) el.value = this.activeSchoolYear;
      this.updateYearDisplay();
    },

  updateYearDisplay() {
      const els = [document.getElementById('app-year-display'), document.getElementById('backup-year-display'), document.getElementById('calendar-year-display')];
      els.forEach(el => { if (el) el.textContent = this.activeSchoolYear; });
      const sel = document.getElementById('school-year-selector');
      if (sel) sel.value = this.activeSchoolYear;
    },

  yearDates(year) {
      const [y] = String(year).split('/').map(Number);
      return { start: `${y}-09-01`, end: `${y+1}-07-10` };
    },

  async createSchoolYear() {
      const input = prompt('Nouvelle année scolaire (ex. 2027/2028) :', '2027/2028');
      if (!input) return;
      const year = input.trim();
      if (!/^\d{4}\/\d{4}$/.test(year)) { alert('Format attendu : 2027/2028'); return; }
      if (year === this.activeSchoolYear) { alert('Cette année est déjà active.'); return; }
      if (await db.get('schoolYears', year)) { alert('Cette année existe déjà. Utilisez « Changer d’année ».'); return; }
      if (!confirm(`Créer l’année ${year} ?\n\nL’année ${this.activeSchoolYear} sera archivée automatiquement.\nLes anciennes données ne seront pas supprimées.`)) return;
      await this.saveYearArchive(this.activeSchoolYear);
      const copyConfig = confirm(`Pour ${year}, voulez-vous reprendre la configuration de l’année actuelle ?\n\nOK = classes + emploi du temps + catégories/actions\nAnnuler = nouvelle année vierge\n\nLes élèves et toutes les absences/activités ne seront jamais copiés.`);
      const oldConfig = copyConfig ? {
        classes: await db.getAll('classes'), timetable: await db.getAll('timetable'),
        activityCategories: await db.getAll('activityCategories'), activityActions: await db.getAll('activityActions')
      } : null;
      await this.clearYearData();
      if (oldConfig) {
        for (const x of oldConfig.classes) await db.put('classes', {...x});
        for (const x of oldConfig.timetable) await db.put('timetable', {...x});
        for (const x of oldConfig.activityCategories) await db.put('activityCategories', {...x});
        for (const x of oldConfig.activityActions) await db.put('activityActions', {...x});
      }
      const dates = this.yearDates(year);
      await db.put('settings', {key:'schoolStart', value:dates.start});
      await db.put('settings', {key:'schoolEnd', value:dates.end});
      await db.put('settings', {key:'activeSchoolYear', value:year});
      this.activeSchoolYear = year;
      this.updateYearDisplay();
      await this.renderProfile(); await this.renderDashboard();
      alert(`Année ${year} créée.\n\nLes classes, élèves, emploi du temps et calendrier doivent maintenant être configurés pour cette nouvelle année.`);
    },

  async switchSchoolYear(year) {
      if (!year || year === this.activeSchoolYear) return;
      if (!confirm(`Passer de ${this.activeSchoolYear} à ${year} ?\n\nLes données actuelles seront d’abord archivées automatiquement.`)) { this.updateYearDisplay(); return; }
      await this.saveYearArchive(this.activeSchoolYear);
      await this.restoreYearArchive(year);
      await db.put('settings', {key:'activeSchoolYear', value:year});
      this.activeSchoolYear = year;
      this.updateYearDisplay();
      await this.renderProfile(); await this.renderDashboard();
      this.navigateTo('view-home');
      alert(`Année ${year} activée.`);
    },

  async listSchoolYears() {
      const years = await db.getAll('schoolYears');
      const all = new Set([this.activeSchoolYear, ...years.map(x=>x.year)]);
      return [...all].sort();
    },

  async refreshSchoolYearSelector() {
      const sel = document.getElementById('school-year-selector'); if (!sel) return;
      const years = await this.listSchoolYears();
      sel.innerHTML = years.map(y => `<option value=\"${this.escapeHtml(y)}\">${this.escapeHtml(y)}</option>`).join('');
      sel.value = this.activeSchoolYear;
    },

  async renderProfile() {
      const nameSetting = await db.get('settings', 'teacherName');
      const subjectSetting = await db.get('settings', 'teacherSubject');
      const name = (nameSetting?.value || '').trim();
      const subject = (subjectSetting?.value || 'Mathématiques').trim();
      const appName = 'Gestion de classe';
      const line = document.getElementById('teacher-profile-line');
      if (line) line.textContent = name ? `${this.t('profilePrefix')} ${name}` : this.t('profileNotConfigured');
      const sub = document.getElementById('teacher-subject-display');
      if (sub) sub.textContent = subject ? `${this.t('teacherOf')} ${subject}` : this.t('teacher');
      const logo = document.getElementById('app-name-display');
      if (logo) logo.textContent = appName;
      this.updateYearDisplay();
      await this.refreshSchoolYearSelector();
      document.title = `${appName} ${this.activeSchoolYear}`;
      const summary = document.getElementById('profile-summary');
      if (summary) {
        const classes = await db.getAll('classes');
        summary.innerHTML = `<b>${name ? this.escapeHtml(name) : this.t('teacherNotEntered')}</b><br><span class="help-text">${classes.length} ${this.t('classesConfigured')}</span><br><span class="help-text">${this.escapeHtml(subject)}</span>`;
      }
    },

  async loadLanguage() {
      const setting = await db.get('settings', 'language');
      this.language = setting?.value === 'ar' ? 'ar' : 'fr';
      this.applyLanguage();
    },

  t(key) {
      const dict = this.language === 'ar' ? this.i18n.ar : this.i18n.fr;
      return dict[key] ?? this.i18n.fr[key] ?? key;
    },

  applyLanguage() {
      const isAr = this.language === 'ar';
      document.documentElement.lang = isAr ? 'ar' : 'fr';
      document.documentElement.dir = isAr ? 'rtl' : 'ltr';
      document.body.classList.toggle('lang-ar', isAr);
      ['language-selector','profile-language','welcome-language'].forEach(id => { const el=document.getElementById(id); if(el) el.value=this.language; });
      document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
      document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPlaceholder); });
      this.updateCurrentDateDisplay();
    },

  async changeLanguage(lang) {
      this.language = lang === 'ar' ? 'ar' : 'fr';
      await db.put('settings', { key: 'language', value: this.language });
      this.applyLanguage();
      await this.renderProfile();
      await this.renderDashboard();
      if (this.currentView === 'view-activities') await this.renderActivitiesView();
      if (this.currentView === 'view-students') await this.renderStudentsList();
      if (this.currentView === 'view-stats') await this.renderStats();
      if (this.currentView === 'view-history') await this.renderHistory();
      if (this.currentView === 'view-timetable') await this.renderTimetableEditor();
      if (this.currentView === 'view-calendar') { await this.renderCalendarView(); await this.initClassEventsJournalFilters(); }
      if (this.currentView === 'view-today') await this.renderTodayCourses();
      if (this.currentView === 'view-student-detail' && this.currentStudentDetailId) await this.showStudentDetail(this.currentStudentDetailId);
    },

  async showFirstSetup() {
      const classes = await db.getAll('classes');
      document.getElementById('welcome-class-list').innerHTML =
        classes.length
          ? classes.map(c => `<span class="class-badge" style="display:inline-block;margin:3px;">${this.escapeHtml(c.name)}</span>`).join('')
          : '<span class="help-text">Aucune classe</span>';
      document.getElementById('welcome-teacher-name').value = '';
      if (document.getElementById('welcome-subject')) document.getElementById('welcome-subject').value = 'Mathématiques';
      if (document.getElementById('welcome-language')) document.getElementById('welcome-language').value = this.language;
      document.getElementById('modal-welcome-profile').classList.add('active');
    },

  async finishFirstSetup() {
      const name = document.getElementById('welcome-teacher-name').value.trim();
      const subject = document.getElementById('welcome-subject')?.value.trim() || 'Mathématiques';
      const language = document.getElementById('welcome-language')?.value || 'fr';
      await db.put('settings', { key: 'teacherName', value: name });
      await db.put('settings', { key: 'teacherSubject', value: subject });
      await db.put('settings', { key: 'language', value: language });
      await db.put('settings', { key: 'profileConfigured', value: true });
      this.language = language;
      this.applyLanguage();
      this.closeModal('modal-welcome-profile');
      await this.renderProfile();
      this.showSaveIndicator();
    },

  async openProfile() {
      const setting = await db.get('settings', 'teacherName');
      document.getElementById('profile-teacher-name').value = setting?.value || '';
      document.getElementById('profile-subject').value = (await db.get('settings','teacherSubject'))?.value || 'Mathématiques';
      document.getElementById('profile-language').value = this.language;
      document.getElementById('profile-ui-scale').value = (await db.get('settings','uiScale'))?.value || 'normal';
      document.getElementById('profile-auto-backup').value = String((await db.get('settings','autoBackupInterval'))?.value || 'off');
      const classes = await db.getAll('classes');
      document.getElementById('profile-class-list').innerHTML =
        classes.length
          ? classes.map(c => `• ${this.escapeHtml(c.name)}`).join('<br>')
          : '<span class="help-text">Aucune classe configurée.</span>';
      document.getElementById('modal-profile').classList.add('active');
    },

  async saveProfile() {
      const name = document.getElementById('profile-teacher-name').value.trim();
      const subject = document.getElementById('profile-subject').value.trim() || 'Mathématiques';
      const language = document.getElementById('profile-language').value || 'fr';
      const uiScale = document.getElementById('profile-ui-scale')?.value || 'normal';
      const backupChoice = document.getElementById('profile-auto-backup')?.value || 'off';
      const autoBackupInterval = backupChoice === 'off' ? 0 : Number(backupChoice);
      const previousBackupChoice = (await db.get('settings','autoBackupInterval'))?.value ?? 0;
      const previousAutoBackupInterval = previousBackupChoice === 'off' ? 0 : Number(previousBackupChoice || 0);
  
      // Enregistrer TOUS les paramètres du profil, y compris les préférences d'interface
      // et de sauvegarde automatique. (Ils étaient lus dans openProfile() mais jamais
      // enregistrés par saveProfile(), ce qui donnait l'impression que le bouton
      // « Enregistrer » ne faisait rien.)
      await db.put('settings', { key: 'teacherName', value: name });
      await db.put('settings', { key: 'teacherSubject', value: subject });
      await db.put('settings', { key: 'language', value: language });
      await db.put('settings', { key: 'uiScale', value: uiScale });
      await db.put('settings', { key: 'autoBackupInterval', value: autoBackupInterval });
      await db.put('settings', { key: 'profileConfigured', value: true });
  
      // Appliquer immédiatement la nouvelle taille des boutons, sans attendre un
      // redémarrage de l'application.
      await this.applyUserInterfacePreferences();
  
      // Si la sauvegarde automatique vient d'être activée ou modifiée, repartir
      // avec un compteur propre. Cela évite un déclenchement imprévisible.
      if (autoBackupInterval !== previousAutoBackupInterval) {
        this.changeCounter = 0;
        await db.put('settings', { key: `autoBackupChangeCounter_${this.activeSchoolYear}`, value: 0 });
      }
  
      // À la première activation, créer aussi un premier point de restauration
      // local immédiatement : l'option est donc réellement active dès maintenant.
      if (autoBackupInterval > 0 && previousAutoBackupInterval === 0) {
        try {
          const data = await this.getBackupData();
          localStorage.setItem(`gestion_classe_autobackup_${this.activeSchoolYear}`, JSON.stringify({
            savedAt: new Date().toISOString(), data
          }));
        } catch (e) {
          console.warn('Initialisation de la sauvegarde automatique impossible', e);
        }
      }
  
      this.language = language;
      this.applyLanguage();
      this.closeModal('modal-profile');
      await this.renderProfile();
      await this.renderDashboard();
      this.showSaveIndicator();
      this.showToast(this.language === 'ar' ? 'تم حفظ إعدادات الملف الشخصي.' : 'Profil et préférences enregistrés.', 'success');
    },

  setupTheme() {
      const savedTheme = localStorage.getItem('theme') || 'light';
      document.documentElement.setAttribute('data-theme', savedTheme);
      document.getElementById('theme-toggle').innerText = savedTheme === 'dark' ? '☀️' : '🌙';
    },

  toggleTheme() {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      document.getElementById('theme-toggle').innerText = next === 'dark' ? '☀️' : '🌙';
    },

  registerServiceWorker() {
      if (!('serviceWorker' in navigator)) return;
      const hadController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.register('./service-worker.js').then(reg => {
        reg.update().catch(()=>{});
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              this.showToast('Nouvelle version disponible — mise à jour en cours…','info',3200);
            }
          });
        });
      }).catch(err => console.log('SW Registration Failed', err));
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadController && !sessionStorage.getItem('v5_sw_reloaded')) {
          sessionStorage.setItem('v5_sw_reloaded','1');
          location.reload();
        }
      });
    },

  async applyUserInterfacePreferences() {
      const scale = (await db.get('settings','uiScale'))?.value || 'normal';
      document.body.classList.remove('ui-large','ui-xlarge');
      if (scale === 'large') document.body.classList.add('ui-large');
      if (scale === 'xlarge') document.body.classList.add('ui-xlarge');
    }
};
Object.assign(AbsenceApp.prototype, methods);
