/**
 * Application Principal - Logique Metier & Interface
 */

class AbsenceApp {
  constructor() {
    this.currentView = 'view-home';
    this.selectedDate = this.getTodayISO();
    this.activeCourse = null; // { courseId, classId, date, startTime, endTime }
    this.lastAction = null; // Pour annulation rapide
    this.rollcallState = {}; // { studentId: 'A' | 'R' | null }
    this.activityClassMode = true; // Mode compact
    this.activityExpandedStudents = new Set(); // élèves dont les détails sont ouverts
    this.language = 'fr';
    this.activeSchoolYear = '2026/2027';
    this.changeCounter = 0;
    this.currentStudentDetailId = null;
    this.favoriteClasses = [];
  }

  async init() {
    await db.init();
    await this.loadActiveSchoolYear();
    await this.loadLanguage();
    await this.loadFavorites();
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
  }

  async loadActiveSchoolYear() {
    const s = await db.get('settings', 'activeSchoolYear');
    this.activeSchoolYear = s?.value || '2026/2027';
    const el = document.getElementById('school-year-selector');
    if (el) el.value = this.activeSchoolYear;
    this.updateYearDisplay();
  }

  updateYearDisplay() {
    const els = [document.getElementById('app-year-display'), document.getElementById('backup-year-display'), document.getElementById('calendar-year-display')];
    els.forEach(el => { if (el) el.textContent = this.activeSchoolYear; });
    const sel = document.getElementById('school-year-selector');
    if (sel) sel.value = this.activeSchoolYear;
  }

  async getYearData(includeSettings=true) {
    const data = {
      year: this.activeSchoolYear,
      classes: await db.getAll('classes'), students: await db.getAll('students'), timetable: await db.getAll('timetable'),
      attendance: await db.getAll('attendance'), calendar: await db.getAll('calendar'), sessions: await db.getAll('sessions'),
      activityCategories: await db.getAll('activityCategories'), activityActions: await db.getAll('activityActions'), activityEvents: await db.getAll('activityEvents')
    };
    if (includeSettings) {
      const settings = await db.getAll('settings');
      data.settings = settings.filter(x => !['teacherName','teacherSubject','language','profileConfigured','appVersion','activeSchoolYear'].includes(x.key));
    }
    return data;
  }

  async saveYearArchive(year) {
    const data = await this.getYearData(true);
    data.year = year;
    await db.put('schoolYears', { year, data, archivedAt: new Date().toISOString() });
  }

  async clearYearData() {
    for (const store of ['classes','students','timetable','attendance','calendar','sessions','activityCategories','activityActions','activityEvents']) {
      if (db.db.objectStoreNames.contains(store)) await db.clearStore(store);
    }
  }

  async restoreYearArchive(year) {
    const archive = await db.get('schoolYears', year);
    if (!archive?.data) throw new Error('Année archivée introuvable.');
    await this.clearYearData();
    const d = archive.data;
    for (const x of (d.classes||[])) await db.put('classes', x);
    for (const x of (d.students||[])) await db.put('students', x);
    for (const x of (d.timetable||[])) await db.put('timetable', x);
    for (const x of (d.attendance||[])) await db.put('attendance', x);
    for (const x of (d.calendar||[])) await db.put('calendar', x);
    for (const x of (d.sessions||[])) await db.put('sessions', x);
    for (const x of (d.activityCategories||[])) await db.put('activityCategories', x);
    for (const x of (d.activityActions||[])) await db.put('activityActions', x);
    for (const x of (d.activityEvents||[])) await db.put('activityEvents', x);
    for (const x of (d.settings||[])) await db.put('settings', x);
  }

  yearDates(year) {
    const [y] = String(year).split('/').map(Number);
    return { start: `${y}-09-01`, end: `${y+1}-07-10` };
  }

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
  }

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
  }

  async listSchoolYears() {
    const years = await db.getAll('schoolYears');
    const all = new Set([this.activeSchoolYear, ...years.map(x=>x.year)]);
    return [...all].sort();
  }

  async refreshSchoolYearSelector() {
    const sel = document.getElementById('school-year-selector'); if (!sel) return;
    const years = await this.listSchoolYears();
    sel.innerHTML = years.map(y => `<option value=\"${this.escapeHtml(y)}\">${this.escapeHtml(y)}</option>`).join('');
    sel.value = this.activeSchoolYear;
  }

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
  }

  async loadLanguage() {
    const setting = await db.get('settings', 'language');
    this.language = setting?.value === 'ar' ? 'ar' : 'fr';
    this.applyLanguage();
  }

  t(key) {
    const dict = this.language === 'ar' ? this.i18n.ar : this.i18n.fr;
    return dict[key] ?? this.i18n.fr[key] ?? key;
  }

  applyLanguage() {
    const isAr = this.language === 'ar';
    document.documentElement.lang = isAr ? 'ar' : 'fr';
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    document.body.classList.toggle('lang-ar', isAr);
    ['language-selector','profile-language','welcome-language'].forEach(id => { const el=document.getElementById(id); if(el) el.value=this.language; });
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = this.t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = this.t(el.dataset.i18nPlaceholder); });
    this.updateCurrentDateDisplay();
  }

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
    if (this.currentView === 'view-calendar') await this.renderCalendarView();
    if (this.currentView === 'view-today') await this.renderTodayCourses();
    if (this.currentView === 'view-student-detail' && this.currentStudentDetailId) await this.showStudentDetail(this.currentStudentDetailId);
  }

  i18n = {
    fr: { subjectLabel:'Matière enseignée :', languageLabel:'Langue de l’application :', welcomeSubjectLabel:'Votre matière :', profilePrefix:'Profil :', profileNotConfigured:'Profil : non configuré', teacherOf:'Enseignant de', teacher:'Enseignant', teacherNotEntered:'Enseignant non renseigné', classesConfigured:'classe(s) configurée(s)', profileButton:'👤 Mon profil', startRollcall:"Lancer l'appel", todayCourses:'📅 Mes cours du jour', todayCoursesSub:"Saisie directe de l'appel", students:'👨‍🎓 Élèves', studentsSub:'Gestion et listes par classe', activities:'⭐ Activités & comportement', activitiesSub:'Notes sur 20 et pénalités en un clic', stats:'📊 Statistiques', statsSub:'Bilans et classements', history:'📋 Historique', historySub:'Recherche et modification', timetable:'⚙️ Emploi du temps', timetableSub:'Configuration des créneaux', calendar:'🗓 Calendrier', calendarSub:'Vacances et jours fériés', backup:'💾 Sauvegarde / Export', backupSub:'JSON, Excel et CSV', home:'← Accueil', todayTitle:'Cours du jour', today:"Aujourd'hui", studentsBack:'← Élèves', studentDetail:'Fiche Individuelle', activityDetail:'⭐ Activités et comportement', manageActivities:'Gérer les activités', attendanceHistory:'Historique de présence', configure:'⚙️ Configurer', newPeriod:'↻ Nouvelle période', courseMode:'⚡ Mode cours', statsTitle:'📊 Statistiques & Bilans', historyTitle:'📋 Historique des Appels', timetableTitle:'⚙️ Configuration Emploi du Temps', addCourse:'+ Ajouter un créneau', calendarTitlePrefix:'🗓 Calendrier Scolaire', addHoliday:'+ Ajouter Vacances / Férié / Exception', backupTitle:'💾 Sauvegarde & Exports', teacherProfile:'👤 Profil enseignant', editProfile:'Configurer / modifier mon profil', fullBackup:'💾 Sauvegarde Complète (JSON)', exportJson:'Exporter la sauvegarde JSON', restoreBackup:'↩ Restaurer une Sauvegarde', restoreData:'Restaurer les données', mergeBackup:'🔄 Fusionner une sauvegarde', mergeBackupHelp:'Ajoute les données du téléphone aux données du PC sans supprimer les anciennes données. Une sauvegarde automatique du PC sera téléchargée avant la fusion.', mergeData:'🔄 Fusionner avec les données actuelles', excelExport:'📊 Export Excel / CSV', printPdf:'🖨 Imprimer / Exporter en PDF', demoReset:'⚠️ Données de Démonstration & Réinitialisation', demoStudents:'Charger des Élèves de Démonstration', clearAll:'🗑 Effacer TOUTES les données', profileTitle:'👤 Mon profil enseignant', cancel:'Annuler', save:'Enregistrer', welcome:'👋 Bienvenue !', startSetup:'Commencer avec cette configuration', addStudent:'Ajouter un Élève', importStudents:"📥 Importer une liste d'élèves", startImport:"Lancer l'importation", manageClasses:'⚙️ Gérer les Classes', addClass:'Ajouter la classe', close:'Fermer', addCourseModal:'Ajouter un Créneau', addHolidayModal:'Ajouter des Vacances / Jour Férié', activityConfig:'⚙️ Configuration — Activités et comportement', saveMaxScore:'Enregistrer la note maximale', addCategory:'+ Ajouter une catégorie', addAction:'+ Ajouter une action', category:'Catégorie', actionPenalty:'Action / pénalité', activityHistory:'Historique', rollcallSaved:'APPEL ENREGISTRÉ', backToToday:'Retour aux cours du jour', searchStudent:'🔎 Rechercher un élève...', searchStudentByName:'🔎 Rechercher un élève par nom...', searchStudentName:'🔎 Nom ou prénom...', teacherNamePlaceholder:'ex. Ahmed EL ...', behaviorsTitle:'📐 Pratiques et comportements en mathématiques', behaviorsHelp:"Cochez uniquement les comportements qui ne sont pas encore maîtrisés chez l'élève. Une case cochée = un point à améliorer. Les cases non cochées n'apparaissent pas comme des problèmes.", behaviorsSaveBtn:'💾 Enregistrer les comportements', remarksTitle:'🗒 Remarques générales', remarksHelp:'Générées automatiquement à partir des pénalités, des devoirs maison, du travail à domicile et des comportements cochés ci-dessus.', printStudentReportBtn:"📄 Rapport de l'élève"},
    ar: { subjectLabel:'المادة التي تدرسها:', languageLabel:'لغة التطبيق:', welcomeSubjectLabel:'المادة التي تدرسها:', profilePrefix:'الملف الشخصي:', profileNotConfigured:'الملف الشخصي: غير مُعد', teacherOf:'أستاذ مادة', teacher:'الأستاذ', teacherNotEntered:'اسم الأستاذ غير مُدخل', classesConfigured:'قسم(أقسام) مُعدّة', profileButton:'👤 ملفي الشخصي', startRollcall:'بدء تسجيل الحضور', todayCourses:'📅 حصصي اليوم', todayCoursesSub:'تسجيل الحضور مباشرة', students:'👨‍🎓 التلاميذ', studentsSub:'التدبير واللوائح حسب القسم', activities:'⭐ الأنشطة والسلوك', activitiesSub:'نقط من 20 وخصومات بنقرة واحدة', stats:'📊 الإحصائيات', statsSub:'الحصيلة والترتيب', history:'📋 السجل', historySub:'البحث والتعديل', timetable:'⚙️ استعمال الزمن', timetableSub:'إعداد الحصص', calendar:'🗓 التقويم', calendarSub:'العطل والأيام الرسمية', backup:'💾 النسخ والتصدير', backupSub:'JSON وExcel وCSV', home:'← الرئيسية', todayTitle:'حصص اليوم', today:'اليوم', studentsBack:'← التلاميذ', studentDetail:'بطاقة التلميذ', activityDetail:'⭐ الأنشطة والسلوك', manageActivities:'تدبير الأنشطة', attendanceHistory:'سجل الحضور', configure:'⚙️ الإعدادات', newPeriod:'↻ فترة جديدة', courseMode:'⚡ وضع الحصة', statsTitle:'📊 الإحصائيات والحصيلة', historyTitle:'📋 سجل الحضور', timetableTitle:'⚙️ إعداد استعمال الزمن', addCourse:'+ إضافة حصة', calendarTitlePrefix:'🗓 التقويم المدرسي', addHoliday:'+ إضافة عطلة / يوم رسمي / استثناء', backupTitle:'💾 النسخ والتصدير', teacherProfile:'👤 ملف الأستاذ', editProfile:'إعداد / تعديل ملفي', fullBackup:'💾 النسخ الاحتياطي الكامل (JSON)', exportJson:'تصدير النسخة الاحتياطية JSON', restoreBackup:'↩ استعادة نسخة احتياطية', restoreData:'استعادة البيانات', mergeBackup:'🔄 دمج نسخة احتياطية', mergeBackupHelp:'إضافة بيانات الهاتف إلى بيانات الحاسوب دون حذف البيانات القديمة. سيتم تنزيل نسخة احتياطية تلقائياً قبل الدمج.', mergeData:'🔄 دمج مع البيانات الحالية', excelExport:'📊 تصدير Excel / CSV', printPdf:'🖨 طباعة / تصدير PDF', demoReset:'⚠️ بيانات تجريبية وإعادة التهيئة', demoStudents:'تحميل تلاميذ تجريبيين', clearAll:'🗑 حذف جميع البيانات', profileTitle:'👤 ملف الأستاذ', cancel:'إلغاء', save:'حفظ', welcome:'👋 مرحباً!', startSetup:'بدء العمل بهذه الإعدادات', addStudent:'إضافة تلميذ', importStudents:'📥 استيراد لائحة التلاميذ', startImport:'بدء الاستيراد', manageClasses:'⚙️ تدبير الأقسام', addClass:'إضافة القسم', close:'إغلاق', addCourseModal:'إضافة حصة', addHolidayModal:'إضافة عطلة / يوم رسمي', activityConfig:'⚙️ إعدادات الأنشطة والسلوك', saveMaxScore:'حفظ النقطة القصوى', addCategory:'+ إضافة فئة', addAction:'+ إضافة إجراء', category:'الفئة', actionPenalty:'الإجراء / الخصم', activityHistory:'السجل', rollcallSaved:'تم تسجيل الحضور', backToToday:'العودة إلى حصص اليوم', searchStudent:'🔎 البحث عن تلميذ...', searchStudentByName:'🔎 البحث عن تلميذ بالاسم...', searchStudentName:'🔎 الاسم أو النسب...', teacherNamePlaceholder:'مثال: أحمد ...', behaviorsTitle:'📐 الممارسات والسلوكات في الرياضيات', behaviorsHelp:'ضع علامة فقط على السلوكات التي لم يتحكم فيها التلميذ بعد. العلامة تعني نقطة يجب تحسينها. السلوكات غير المعلَّمة لا تظهر كمشكلة.', behaviorsSaveBtn:'💾 حفظ السلوكات', remarksTitle:'🗒 ملاحظات عامة', remarksHelp:'تُولَّد تلقائيًا انطلاقًا من الخصومات والواجبات المنزلية والعمل في المنزل والسلوكات المعلَّمة أعلاه.', printStudentReportBtn:'📄 تقرير التلميذ'}
  };

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
  }

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
  }

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
  }

  async saveProfile() {
    const name = document.getElementById('profile-teacher-name').value.trim();
    const subject = document.getElementById('profile-subject').value.trim() || 'Mathématiques';
    const language = document.getElementById('profile-language').value || 'fr';
    await db.put('settings', { key: 'teacherName', value: name });
    await db.put('settings', { key: 'teacherSubject', value: subject });
    await db.put('settings', { key: 'language', value: language });
    await db.put('settings', { key: 'profileConfigured', value: true });
    this.language = language;
    this.applyLanguage();
    this.closeModal('modal-profile');
    await this.renderProfile();
    await this.renderDashboard();
    this.showSaveIndicator();
  }

  escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
    }[ch]));
  }

  getTodayISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  dateFromISO(isoStr) {
    const [y, m, d] = isoStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  addDaysISO(isoStr, delta) {
    const d = this.dateFromISO(isoStr);
    d.setDate(d.getDate() + delta);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  formatDateFR(isoStr) {
    if (!isoStr) return '';
    const parts = isoStr.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  getDayOfWeek(isoStr) { return this.dateFromISO(isoStr).getDay(); }

  getDayNameAR(dayNum) { return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][dayNum] || ''; }

  getDayNameFR(dayNum) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[dayNum];
  }

  async getSchoolBounds() {
    const start = await db.get('settings', 'schoolStart');
    const end = await db.get('settings', 'schoolEnd');
    return { start: start?.value || '2026-09-07', end: end?.value || '2027-07-10' };
  }

  async getDayStatus(isoDate) {
    const { start, end } = await this.getSchoolBounds();
    if (isoDate < start) return { type: 'info', message: `📚 Avant le début des cours ${this.activeSchoolYear}` };
    if (isoDate > end) return { type: 'info', message: '🏁 Après la période scolaire configurée' };
    if (this.getDayOfWeek(isoDate) === 0) return { type: 'sunday', message: '📅 DIMANCHE — Aucun cours prévu' };
    const calendar = await db.getAll('calendar');
    const blocking = calendar.find(e => isoDate >= e.startDate && isoDate <= e.endDate && ['vacation','holiday','exceptional'].includes(e.type));
    if (!blocking) return null;
    if (blocking.type === 'vacation') return { type: 'vacation', message: `🏖 VACANCES SCOLAIRES : ${blocking.title}` };
    if (blocking.type === 'holiday') return { type: 'holiday', message: `🎉 JOUR FÉRIÉ : ${blocking.title}` };
    return { type: 'holiday', message: `⚠️ JOURNÉE SANS COURS : ${blocking.title}` };
  }

  async getCoursesForDate(isoDate) {
    if (await this.getDayStatus(isoDate)) return [];
    const day = this.getDayOfWeek(isoDate);
    const timetable = await db.getAll('timetable');
    return timetable.filter(c => c.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
  }

  showSaveIndicator() {
    const el = document.getElementById('save-indicator');
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    el.innerText = `✓ Sauvegardé à ${timeStr}`;
    el.classList.add('active');
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => el.classList.remove('active'), 2500);
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').innerText = savedTheme === 'dark' ? '☀️' : '🌙';
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.getElementById('theme-toggle').innerText = next === 'dark' ? '☀️' : '🌙';
  }

  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW Registration Failed', err));
    }
  }

  navigateTo(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    this.currentView = viewId;
    document.querySelectorAll(".bottom-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===viewId));
    window.scrollTo(0, 0);

    if (viewId === 'view-today') this.renderTodayCourses();
    if (viewId === 'view-students') this.renderStudentsList();
    if (viewId === 'view-stats') this.renderStats();
    if (viewId === 'view-history') this.renderHistory();
    if (viewId === 'view-timetable') this.renderTimetableEditor();
    if (viewId === 'view-calendar') this.renderCalendarView();
    if (viewId === 'view-activities') this.renderActivitiesView();
    if (viewId === 'view-student-detail') this.renderStudentActivityDetail(this.activityStudentId);
  }

  bindEvents() {
    document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());
    document.getElementById('global-search-btn')?.addEventListener('click', () => this.openGlobalSearch());
    document.getElementById('express-call-btn')?.addEventListener('click', () => this.quickExpressCall());
    document.getElementById('global-search-input')?.addEventListener('input', e => this.renderGlobalSearch(e.target.value));
    document.addEventListener('keydown', e => { if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();this.openGlobalSearch();} });
    document.getElementById('language-selector').addEventListener('change', (e) => this.changeLanguage(e.target.value));
    document.getElementById('btn-home-logo').addEventListener('click', () => this.navigateTo('view-home'));
    
    // Date bar 'Mes cours du jour'
    const dateInput = document.getElementById('input-today-date');
    dateInput.value = this.selectedDate;
    dateInput.addEventListener('change', (e) => {
      this.selectedDate = e.target.value;
      this.renderTodayCourses();
    });

    document.getElementById('btn-prev-day').addEventListener('click', () => {
      this.selectedDate = this.addDaysISO(this.selectedDate, -1);
      dateInput.value = this.selectedDate;
      this.renderTodayCourses();
    });

    document.getElementById('btn-next-day').addEventListener('click', () => {
      this.selectedDate = this.addDaysISO(this.selectedDate, 1);
      dateInput.value = this.selectedDate;
      this.renderTodayCourses();
    });

    document.getElementById('btn-reset-today').addEventListener('click', () => {
      this.selectedDate = this.getTodayISO();
      dateInput.value = this.selectedDate;
      this.renderTodayCourses();
    });

    // Rollcall actions
    document.getElementById('btn-finish-rollcall').addEventListener('click', () => this.finishRollcall());
    document.getElementById('btn-prev-course').addEventListener('click', () => this.navigateCourse(-1));
    document.getElementById('btn-next-course').addEventListener('click', () => this.navigateCourse(1));
    document.getElementById('btn-undo').addEventListener('click', () => this.undoLastAction());
  }

  async applyUserInterfacePreferences() {
    const scale = (await db.get('settings','uiScale'))?.value || 'normal';
    document.body.classList.remove('ui-large','ui-xlarge');
    if (scale === 'large') document.body.classList.add('ui-large');
    if (scale === 'xlarge') document.body.classList.add('ui-xlarge');
  }

  async registerChange() {
    this.changeCounter++;
    const interval = Number((await db.get('settings','autoBackupInterval'))?.value || 0);
    if (interval > 0 && this.changeCounter % interval === 0) {
      try {
        const data = await this.getBackupData();
        localStorage.setItem(`gestion_classe_autobackup_${this.activeSchoolYear}`, JSON.stringify({savedAt:new Date().toISOString(),data}));
        this.showSaveIndicator();
      } catch(e) { console.warn('Auto-backup impossible',e); }
    }
  }

  async restoreLocalAutoBackup() {
    const raw=localStorage.getItem(`gestion_classe_autobackup_${this.activeSchoolYear}`);
    if(!raw){alert('Aucune sauvegarde automatique locale disponible pour cette année.');return;}
    try {
      const pack=JSON.parse(raw);
      if(!confirm(`Restaurer la sauvegarde automatique du ${new Date(pack.savedAt).toLocaleString()} ?\n\nCette restauration remplacera les données actuelles.`))return;
      const data=pack.data;
      for(const store of ['classes','students','timetable','attendance','calendar','sessions','activityCategories','activityActions','activityEvents','settings']) if(db.db.objectStoreNames.contains(store)) await db.clearStore(store);
      for(const x of data.classes||[])await db.put('classes',x); for(const x of data.students||[])await db.put('students',x); for(const x of data.timetable||[])await db.put('timetable',x); for(const x of data.attendance||[])await db.put('attendance',x); for(const x of data.calendar||[])await db.put('calendar',x); for(const x of data.sessions||[])await db.put('sessions',x); for(const x of data.activityCategories||[])await db.put('activityCategories',x); for(const x of data.activityActions||[])await db.put('activityActions',x); for(const x of data.activityEvents||[])await db.put('activityEvents',x); for(const x of data.settings||[])await db.put('settings',x);
      location.reload();
    } catch(e){alert('Impossible de restaurer la sauvegarde automatique : '+e.message);}
  }

  async loadFavorites() {
    try { const s = await db.get('settings','favoriteClasses'); this.favoriteClasses = Array.isArray(s?.value) ? s.value : []; }
    catch(e) { this.favoriteClasses = []; }
  }
  async saveFavorites() { await db.put('settings',{key:'favoriteClasses',value:this.favoriteClasses}); }
  isFavoriteClass(id) { return this.favoriteClasses.includes(id); }
  async toggleFavoriteClass(id) {
    this.favoriteClasses = this.isFavoriteClass(id) ? this.favoriteClasses.filter(x=>x!==id) : [...this.favoriteClasses,id];
    await this.saveFavorites(); await this.renderDashboard(); await this.renderClassesManageList();
  }
  async renderQuickFavorites() {
    const box=document.getElementById('quick-favorites-list'); if(!box)return;
    const classes=await db.getAll('classes'); const fav=classes.filter(c=>this.isFavoriteClass(c.id));
    box.innerHTML=fav.length ? fav.map(c=>`<button class="favorite-chip" onclick="app.quickFavorite('${this.escapeHtml(c.id)}')">⭐ ${this.escapeHtml(c.name)}</button>`).join('') : '<span class="help-text">Aucun favori. Ajoutez ⭐ à une classe dans « Gérer les Classes ».</span>';
  }
  async quickFavorite(classId) {
    const courses=await this.getCoursesForDate(this.selectedDate); const c=courses.find(x=>x.classId===classId);
    if(c) return this.startRollcall(c.id,c.classId,this.selectedDate,c.startTime,c.endTime);
    await this.navigateTo('view-students'); const sel=document.getElementById('select-class-filter'); if(sel){sel.value=classId; await this.renderStudentsList();}
  }
  async quickExpressCall() {
    const courses=await this.getCoursesForDate(this.selectedDate); const sessions=await db.getAll('sessions');
    const pending=courses.filter(c=>!sessions.some(s=>s.date===this.selectedDate&&s.courseId===c.id&&s.completed));
    if(pending.length===1){const c=pending[0]; return this.startRollcall(c.id,c.classId,this.selectedDate,c.startTime,c.endTime);}
    await this.navigateTo('view-today');
    if(pending.length>1){const list=document.getElementById('today-courses-list'); list?.classList.add('quick-attention'); setTimeout(()=>list?.classList.remove('quick-attention'),1000);}
  }
  async openGlobalSearch() {
    await this.openModal('modal-global-search'); const input=document.getElementById('global-search-input'); if(input){input.value=''; input.focus();}
    this.renderGlobalSearch('');
  }
  async renderGlobalSearch(q) {
    const box=document.getElementById('global-search-results'); if(!box)return; q=(q||'').trim().toLowerCase();
    if(q.length<2){box.innerHTML='<p class="help-text">Tapez au moins 2 caractères.</p>';return;}
    const [classes,students]=await Promise.all([db.getAll('classes'),db.getAll('students')]);
    const cs=classes.filter(c=>(c.name||'').toLowerCase().includes(q)).slice(0,8);
    const ss=students.filter(s=>!s.archived&&`${s.nom||''} ${s.prenom||''}`.toLowerCase().includes(q)).slice(0,12);
    box.innerHTML=[cs.length?'<h4>Classes</h4>'+cs.map(c=>`<div class="global-result"><button onclick="app.closeModal('modal-global-search');app.navigateTo('view-students');setTimeout(()=>{const s=document.getElementById('select-class-filter');if(s){s.value='${this.escapeHtml(c.id)}';app.renderStudentsList();}},50)">📚 ${this.escapeHtml(c.name)}</button><button class="star-result" onclick="event.stopPropagation();app.toggleFavoriteClass('${this.escapeHtml(c.id)}')">${this.isFavoriteClass(c.id)?'★':'☆'}</button></div>`).join(''):'', ss.length?'<h4>Élèves</h4>'+ss.map(s=>`<button class="global-result single" onclick="app.closeModal('modal-global-search');app.showStudentDetail('${this.escapeHtml(s.id)}')">👤 ${this.escapeHtml(s.nom)} ${this.escapeHtml(s.prenom)}</button>`).join(''):''].join('') || '<p class="help-text">Aucun résultat.</p>';
  }

  updateCurrentDateDisplay() {
    const today = this.getTodayISO();
    const dayName = this.language === 'ar' ? this.getDayNameAR(this.getDayOfWeek(today)) : this.getDayNameFR(this.getDayOfWeek(today));
    document.getElementById('current-date-display').innerText = `${dayName} ${this.formatDateFR(today)}`;
  }

  // --- DASHBOARD LOGIC ---
  async renderDashboard() {
    await this.renderQuickFavorites();
    const today = this.getTodayISO();
    const banner = document.getElementById('day-status-banner');
    const dayStatus = await this.getDayStatus(today);
    if (dayStatus) { banner.className = `status-banner ${dayStatus.type}`; banner.innerText = dayStatus.message; banner.classList.remove('hidden'); }
    else banner.classList.add('hidden');
    const info = document.getElementById('next-course-info');
    const btn = document.getElementById('btn-start-next-course');
    const courses = await this.getCoursesForDate(today);
    if (!courses.length) { info.innerText = dayStatus ? dayStatus.message : "Aucun cours programmé aujourd’hui"; btn.classList.add('hidden'); }
    else {
      const now = new Date().toTimeString().substring(0,5);
      const next = courses.find(c => c.endTime >= now);
      if (!next) { info.innerText = 'Tous les cours du jour sont terminés'; btn.classList.add('hidden'); }
      else { const label = now >= next.startTime && now <= next.endTime ? 'Cours en cours' : 'Prochain cours'; info.innerText = `${label} : ${next.startTime} – ${next.endTime} | ${next.classId}`; btn.classList.remove('hidden'); btn.onclick = () => this.startRollcall(next.id, next.classId, today, next.startTime, next.endTime); }
    }
    const [students,attendance,events]=await Promise.all([db.getAll('students'),db.getAll('attendance'),db.getAll('activityEvents')]);
    const activeStudents=students.filter(s=>!s.archived);
    const todayAtt=attendance.filter(a=>a.date===today);
    const a=todayAtt.filter(x=>x.status==='A').length, r=todayAtt.filter(x=>x.status==='R').length;
    const summary=document.getElementById('dashboard-today-summary');
    if(summary) summary.innerHTML=`<h3>📊 Résumé rapide — ${this.formatDateFR(today)}</h3><div class="insight-grid"><div><b>${activeStudents.length}</b><span>Élèves</span></div><div><b>${a}</b><span>Absences</span></div><div><b>${r}</b><span>Retards</span></div><div><b>${courses.length}</b><span>Cours</span></div></div>`;
    const alerts=[];
    // Les seuils sont calculés à partir de la note maximale configurée.
    // Ainsi, le tableau de bord ne suppose jamais que la note est /20.
    const maxScore=Number((await db.get('settings','activityMaxScore'))?.value || 20);
    const behaviorAlertThreshold=maxScore*0.75; // alerte sous 75 % de la note maximale
    for(const st of activeStudents){
      const ar=attendance.filter(x=>x.studentId===st.id);
      const ac=ar.filter(x=>x.status==='A').length;
      const rc=ar.filter(x=>x.status==='R').length;
      const deducted=events.filter(e=>e.studentId===st.id&&!e.archivedAt)
        .reduce((sum,e)=>sum+Number(e.penalty||0),0);
      const score=Math.max(0,Math.min(maxScore,maxScore-deducted));
      const reasons=[];
      if(ac>=3) reasons.push(`🔴 ${ac} absence${ac>1?'s':''}`);
      if(rc>=3) reasons.push(`🟠 ${rc} retard${rc>1?'s':''}`);
      if(score<behaviorAlertThreshold) reasons.push(`🟡 comportement ${score.toFixed(1)}/${maxScore}`);
      if(reasons.length){
        alerts.push({name:`${this.escapeHtml(st.nom)} ${this.escapeHtml(st.prenom)}`,reasons});
      }
    }
    alerts.sort((a,b)=>a.name.localeCompare(b.name,'fr'));
    const alertBox=document.getElementById('dashboard-alerts');
    if(alertBox) alertBox.innerHTML=`<h3>🚨 À surveiller</h3>${alerts.length
      ? alerts.slice(0,10).map(x=>`<div class="alert-line"><b>${x.name}</b> — ${x.reasons.join(' · ')}</div>`).join('')
      : '<p class="help-text">Aucun élève ne dépasse actuellement les seuils d’alerte.</p>'}`;
  }

  async checkDayStatus(isoDate) { return this.getDayStatus(isoDate); }

  // --- MES COURS DU JOUR VIEW ---
  async renderTodayCourses() {
    const list = document.getElementById('today-courses-list'); const banner = document.getElementById('today-banner'); list.innerHTML='';
    const status = await this.getDayStatus(this.selectedDate);
    if (status) { banner.className=`status-banner ${status.type}`; banner.innerText=status.message; banner.classList.remove('hidden'); list.innerHTML='<div class="card"><p style="text-align:center;">Aucun appel disponible pour cette date.</p></div>'; return; }
    banner.classList.add('hidden');
    const courses = await this.getCoursesForDate(this.selectedDate);
    if (!courses.length) { list.innerHTML='<div class="card"><p style="text-align:center;">Aucun cours dans l’emploi du temps pour ce jour.</p></div>'; return; }
    const sessions = await db.getAll('sessions');
    for (const course of courses) {
      const done = sessions.some(x=>x.date===this.selectedDate && x.courseId===course.id && x.completed);
      const card=document.createElement('div'); card.className='course-card';
      card.innerHTML=`<div><div class="course-time">🕒 ${course.startTime} – ${course.endTime}</div><div class="course-class">Classe : ${course.classId}</div></div><div><span class="course-status-pill ${done?'done':'pending'}">${done?'✓ Effectué':'⏳ En attente'}</span></div>`;
      card.onclick=()=>this.startRollcall(course.id,course.classId,this.selectedDate,course.startTime,course.endTime); list.appendChild(card);
    }
  }

  // --- ÉCRAN D'APPEL (ROLL CALL) ---
  async startRollcall(courseId, classId, date, startTime, endTime) {
    const status = await this.getDayStatus(date);
    if (status) { alert(status.message); return; }
    this.activeCourse = { courseId, classId, date, startTime, endTime };
    this.lastAction = null;
    document.getElementById('undo-container').classList.add('hidden');
    document.getElementById('search-student-input').value = '';

    document.getElementById('rollcall-class').innerText = classId;
    document.getElementById('rollcall-date').innerText = this.formatDateFR(date);
    document.getElementById('rollcall-time').innerText = `${startTime} – ${endTime}`;

    // Charger élèves de la classe
    const allStudents = await db.getAll('students');
    const classStudents = allStudents.filter(s => s.classId === classId && !s.archived);

    // Conserver l'ordre d'importation/saisie
    this.sortStudentsInDisplayOrder(classStudents);

    // Charger les statuts déjà enregistrés
    const allAttendance = await db.getAll('attendance');
    const existing = allAttendance.filter(a => a.date === date && a.courseId === courseId);

    this.rollcallState = {};
    classStudents.forEach(s => {
      const rec = existing.find(a => a.studentId === s.id);
      this.rollcallState[s.id] = rec ? rec.status : null; // null = Présent par défaut
    });

    this.renderRollcallList(classStudents);
    this.updateCounters();
    this.navigateTo('view-rollcall');
  }

  renderRollcallList(students) {
    const list = document.getElementById('rollcall-students-list');
    list.innerHTML = '';

    if (students.length === 0) {
      list.innerHTML = `<div class="card"><p style="text-align:center;">Aucun élève dans la classe ${this.activeCourse.classId}. Veuillez en ajouter.</p></div>`;
      return;
    }

    students.forEach((student, idx) => {
      const status = this.rollcallState[student.id]; // null, 'A', 'R'
      const row = document.createElement('div');
      row.className = `student-row ${status === 'A' ? 'is-absent' : ''} ${status === 'R' ? 'is-retard' : ''}`;
      row.id = `student-row-${student.id}`;

      row.innerHTML = `
        <div class="student-name">${String(idx + 1).padStart(2, '0')}. ${student.nom} ${student.prenom}</div>
        <div class="student-actions">
          <button class="btn-toggle btn-a ${status === 'A' ? 'active' : ''}" onclick="app.toggleStatus('${student.id}', 'A')">A</button>
          <button class="btn-toggle btn-r ${status === 'R' ? 'active' : ''}" onclick="app.toggleStatus('${student.id}', 'R')">R</button>
        </div>
      `;
      list.appendChild(row);
    });
  }

  async toggleStatus(studentId, clickedStatus) {
    const current = this.rollcallState[studentId];
    let nextStatus = null;

    if (current === clickedStatus) {
      // Deuxième clic sur le même bouton : annule
      nextStatus = null;
    } else {
      // Premier clic ou bascule A <-> R
      nextStatus = clickedStatus;
    }

    // Sauvegarder l'état précédent pour annulation rapide
    this.lastAction = { studentId, prevStatus: current, newStatus: nextStatus };

    // Mettre à jour l'état local
    this.rollcallState[studentId] = nextStatus;

    // Mise à jour rapide UI
    const row = document.getElementById(`student-row-${studentId}`);
    if (row) {
      row.className = `student-row ${nextStatus === 'A' ? 'is-absent' : ''} ${nextStatus === 'R' ? 'is-retard' : ''}`;
      const btnA = row.querySelector('.btn-a');
      const btnR = row.querySelector('.btn-r');
      btnA.className = `btn-toggle btn-a ${nextStatus === 'A' ? 'active' : ''}`;
      btnR.className = `btn-toggle btn-r ${nextStatus === 'R' ? 'active' : ''}`;
    }

    this.updateCounters();
    document.getElementById('undo-container').classList.remove('hidden');

    // Persistance automatique instantanée
    await this.persistAttendanceRecord(studentId, nextStatus);
    await this.renderDashboard();
    this.showSaveIndicator();
  }

  async persistAttendanceRecord(studentId, status) {
    const recordId = `att_${this.activeCourse.date}_${this.activeCourse.courseId}_${studentId}`;
    if (status === null) {
      await db.delete('attendance', recordId);
    } else {
      await db.put('attendance', {
        id: recordId,
        date: this.activeCourse.date,
        courseId: this.activeCourse.courseId,
        classId: this.activeCourse.classId,
        studentId: studentId,
        status: status,
        timestamp: Date.now()
      });
    }
  }

  async undoLastAction() {
    if (!this.lastAction) return;
    const { studentId, prevStatus } = this.lastAction;
    this.rollcallState[studentId] = prevStatus;
    await this.persistAttendanceRecord(studentId, prevStatus);

    const row = document.getElementById(`student-row-${studentId}`);
    if (row) {
      row.className = `student-row ${prevStatus === 'A' ? 'is-absent' : ''} ${prevStatus === 'R' ? 'is-retard' : ''}`;
      const btnA = row.querySelector('.btn-a');
      const btnR = row.querySelector('.btn-r');
      btnA.className = `btn-toggle btn-a ${prevStatus === 'A' ? 'active' : ''}`;
      btnR.className = `btn-toggle btn-r ${prevStatus === 'R' ? 'active' : ''}`;
    }

    this.updateCounters();
    document.getElementById('undo-container').classList.add('hidden');
    this.lastAction = null;
    this.showSaveIndicator();
  }

  updateCounters() {
    let aCount = 0;
    let rCount = 0;
    let total = Object.keys(this.rollcallState).length;

    Object.values(this.rollcallState).forEach(val => {
      if (val === 'A') aCount++;
      if (val === 'R') rCount++;
    });

    document.getElementById('cnt-a').innerText = aCount;
    document.getElementById('cnt-r').innerText = rCount;
    document.getElementById('cnt-p').innerText = total - (aCount + rCount);
  }

  async filterStudentsRollcall(query) {
    const allStudents = await db.getAll('students');
    const classStudents = allStudents.filter(s => s.classId === this.activeCourse.classId && !s.archived);
    const filtered = classStudents.filter(s => 
      `${s.nom} ${s.prenom}`.toLowerCase().includes(query.toLowerCase())
    );
    this.renderRollcallList(filtered);
  }

  async navigateCourse(direction) {
    const dayOfWeek = this.getDayOfWeek(this.activeCourse.date);
    const timetable = await db.getAll('timetable');
    const courses = timetable.filter(c => c.day === dayOfWeek).sort((a,b) => a.startTime.localeCompare(b.startTime));

    const currentIndex = courses.findIndex(c => c.id === this.activeCourse.courseId);
    const targetIndex = currentIndex + direction;

    if (targetIndex >= 0 && targetIndex < courses.length) {
      const nextC = courses[targetIndex];
      this.startRollcall(nextC.id, nextC.classId, this.activeCourse.date, nextC.startTime, nextC.endTime);
    }
  }

  async finishRollcall() {
    let total = Object.keys(this.rollcallState).length;
    let aCount = 0;
    let rCount = 0;

    Object.values(this.rollcallState).forEach(val => {
      if (val === 'A') aCount++;
      if (val === 'R') rCount++;
    });

    const pCount = total - (aCount + rCount);

    await this.registerChange();
    await db.put('sessions', { id:`session_${this.activeCourse.date}_${this.activeCourse.courseId}`, date:this.activeCourse.date, courseId:this.activeCourse.courseId, classId:this.activeCourse.classId, startTime:this.activeCourse.startTime, endTime:this.activeCourse.endTime, completed:true, updatedAt:Date.now() });
    this.showSaveIndicator();
    const summaryCard = document.getElementById('summary-details-card');
    summaryCard.innerHTML = `
      <p><b>Classe :</b> ${this.activeCourse.classId}</p>
      <p><b>Date :</b> ${this.formatDateFR(this.activeCourse.date)}</p>
      <p><b>Horaire :</b> ${this.activeCourse.startTime} – ${this.activeCourse.endTime}</p>
      <hr style="margin:8px 0; border:none; border-top:1px solid var(--border);">
      <p>Élèves inscrits : <b>${total}</b></p>
      <p>Présents : <b style="color:var(--accent-p)">${pCount}</b></p>
      <p>Absents : <b style="color:var(--accent-a)">${aCount}</b></p>
      <p>Retards : <b style="color:var(--accent-r)">${rCount}</b></p>
    `;

    this.openModal('modal-summary');
  }

  // --- GESTION ÉLÈVES VIEW ---
  // Conserve l'ordre de saisie/importation des élèves. Les anciennes données
  // sans importOrder gardent un repli alphabétique pour rester compatibles.
  sortStudentsInDisplayOrder(students) {
    return students.sort((a,b) => {
      const ao = Number.isFinite(Number(a.importOrder)) ? Number(a.importOrder) : null;
      const bo = Number.isFinite(Number(b.importOrder)) ? Number(b.importOrder) : null;
      if (ao !== null && bo !== null && ao !== bo) return ao - bo;
      if (ao !== null && bo === null) return -1;
      if (ao === null && bo !== null) return 1;
      return String(a.nom || '').localeCompare(String(b.nom || ''), 'fr', { sensitivity:'base' }) ||
             String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr', { sensitivity:'base' });
    });
  }

  async renderStudentsList() {
    const classes = await db.getAll('classes');
    const selectFilter = document.getElementById('select-class-filter');
    
    // Remplir le selecteur de classe si vide
    if (selectFilter.children.length === 0) {
      selectFilter.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    const selectedClassId = selectFilter.value || classes[0]?.id;
    const globalSearch = document.getElementById('search-student-global').value.toLowerCase();

    const allStudents = await db.getAll('students');
    let filtered = allStudents.filter(s => s.classId === selectedClassId && !s.archived);

    if (globalSearch) {
      filtered = filtered.filter(s => `${s.nom} ${s.prenom}`.toLowerCase().includes(globalSearch));
    }

    this.sortStudentsInDisplayOrder(filtered);

    const container = document.getElementById('students-manage-list');
    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `<div class="card"><p style="text-align:center;">Aucun élève trouvé dans cette classe.</p></div>`;
      return;
    }

    filtered.forEach((student, idx) => {
      const item = document.createElement('div');
      item.className = 'manage-item';
      item.innerHTML = `
        <div>
          <strong>${idx + 1}. ${student.nom} ${student.prenom}</strong>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary" onclick="app.showStudentDetail('${student.id}')">👁 Fiche</button>
          <button class="btn btn-sm btn-secondary" onclick="app.editStudent('${student.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="app.deleteStudent('${student.id}')">🗑</button>
        </div>
      `;
      container.appendChild(item);
    });
  }

  async openModal(modalId, preserveCourse = false) {
    if (modalId === 'modal-student') {
      const classes = await db.getAll('classes');
      const select = document.getElementById('student-class-id');
      select.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      document.getElementById('student-id').value = '';
      document.getElementById('student-nom').value = '';
      document.getElementById('student-prenom').value = '';
      document.getElementById('modal-student-title').innerText = "Ajouter un Élève";
    }

    if (modalId === 'modal-import') {
      const classes = await db.getAll('classes');
      const select = document.getElementById('import-class-id');
      select.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    }

    if (modalId === 'modal-class') {
      this.renderClassesManageList();
    }

    if (modalId === 'modal-holiday') {
      document.getElementById('holiday-id').value = '';
      document.getElementById('holiday-title').value = '';
      document.getElementById('holiday-type').value = 'vacation';
      document.getElementById('holiday-start').value = '';
      document.getElementById('holiday-end').value = '';
      document.getElementById('modal-holiday-title').innerText = 'Ajouter des Vacances / Jour Férié';
    }

    if (modalId === 'modal-course') {
      const classes = await db.getAll('classes');
      const select = document.getElementById('course-class-id');
      select.innerHTML = classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
      if (!preserveCourse) { document.getElementById('course-id').value=''; document.getElementById('modal-course-title').innerText='Ajouter un Créneau'; document.getElementById('course-day').value='1'; document.getElementById('course-start-time').value='08:30'; document.getElementById('course-end-time').value='09:30'; }
    }

    document.getElementById(modalId).classList.add('active');
  }

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
  }

  async saveStudent() {
    const id = document.getElementById('student-id').value || `std_${Date.now()}_${Math.random().toString(36).substring(2,6)}`;
    const classId = document.getElementById('student-class-id').value;
    const nom = document.getElementById('student-nom').value.trim().toUpperCase();
    const prenom = document.getElementById('student-prenom').value.trim();

    if (!nom || !prenom) {
      alert("Veuillez saisir le nom et le prénom de l'élève.");
      return;
    }

    const existingInClass = (await db.getAll('students')).filter(s => s.classId === classId && !s.archived && s.id !== id);
    const existingStudent = await db.get('students', id);
    const importOrder = existingStudent && Number.isFinite(Number(existingStudent.importOrder))
      ? Number(existingStudent.importOrder)
      : (existingInClass.reduce((m,s) => Math.max(m, Number.isFinite(Number(s.importOrder)) ? Number(s.importOrder) : 0), 0) + 1);
    await db.put('students', { id, classId, nom, prenom, archived: false, importOrder });
    await this.registerChange();
    this.closeModal('modal-student');
    this.renderStudentsList();
    this.showSaveIndicator();
  }

  async editStudent(studentId) {
    const student = await db.get('students', studentId);
    if (!student) return;

    await this.openModal('modal-student');
    document.getElementById('modal-student-title').innerText = "Modifier l'Élève";
    document.getElementById('student-id').value = student.id;
    document.getElementById('student-class-id').value = student.classId;
    document.getElementById('student-nom').value = student.nom;
    document.getElementById('student-prenom').value = student.prenom;
  }

  async deleteStudent(studentId) {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet élève ? L'historique sera conservé.")) {
      const student = await db.get('students', studentId);
      student.archived = true; // Archivage sécurisé pour ne pas perdre les anciennes absences
      await db.put('students', student);
      this.renderStudentsList();
      this.showSaveIndicator();
    }
  }

  async processImport() {
    const classId=document.getElementById('import-class-id').value; const input=document.getElementById('import-file-input');
    if(!input.files.length){alert('Veuillez sélectionner un fichier CSV ou TXT.');return;}
    const file=input.files[0]; if(!/\.(csv|txt)$/i.test(file.name)){alert('Pour une utilisation hors ligne sans bibliothèque externe, exportez votre fichier Excel en CSV UTF-8 puis importez-le.');return;}
    const text=(await file.text()).replace(/^\uFEFF/,''); const lines=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const existing=await db.getAll('students'); let count=0,skipped=0;
    let nextImportOrder = existing.filter(s=>s.classId===classId && !s.archived).reduce((m,s)=>Math.max(m, Number.isFinite(Number(s.importOrder)) ? Number(s.importOrder) : 0), 0) + 1;
    for(const line of lines){ if(/^(nom|last\s*name)[,;\t]/i.test(line)) continue; let parts=line.split(/[;,\t]/).map(x=>x.trim()); let nom='',prenom=''; if(parts.length>=2){nom=parts[0];prenom=parts[1];} else {const t=line.split(/\s+/);nom=t.shift()||'';prenom=t.join(' ');} nom=nom.replace(/^['"]|['"]$/g,'').trim().toUpperCase(); prenom=prenom.replace(/^['"]|['"]$/g,'').trim(); if(!nom)continue;
      const duplicate=existing.some(s=>s.classId===classId&&!s.archived&&`${s.nom} ${s.prenom}`.trim().toLowerCase()===`${nom} ${prenom}`.trim().toLowerCase()); if(duplicate){skipped++;continue;}
      const student={id:`std_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,classId,nom,prenom,archived:false,importOrder:nextImportOrder++}; await db.put('students',student); existing.push(student); count++;
    }
    await this.registerChange(); alert(`${count} élève(s) importé(s).${skipped?` ${skipped} doublon(s) ignoré(s).`:''}`); input.value=''; this.closeModal('modal-import'); await this.renderStudentsList(); this.showSaveIndicator();
  }

  // --- CLASSES MANAGEMENT ---
  async renderClassesManageList() {
    const classes = await db.getAll('classes');
    const container = document.getElementById('classes-list-manage');
    container.innerHTML = classes.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span><strong>${c.name}</strong></span>
        <button class="btn btn-sm btn-secondary" onclick="app.duplicateClass('${c.id}')">📋 Dupliquer</button> <button class="btn btn-sm btn-danger" onclick="app.deleteClass('${c.id}')">Supprimer</button>
      </div>
    `).join('');
  }

  async refreshClassSelectors(preferredClassId = null) {
    const classes = await db.getAll('classes');
    const selectors = [
      { id: 'select-class-filter', defaultMode: 'plain' },
      { id: 'activity-class-filter', defaultMode: 'plain' },
      { id: 'stats-class-filter', defaultMode: 'all' },
      { id: 'hist-class-filter', defaultMode: 'all' },
      { id: 'student-class-id', defaultMode: 'plain' },
      { id: 'import-class-id', defaultMode: 'plain' },
      { id: 'course-class-id', defaultMode: 'plain' }
    ];

    for (const config of selectors) {
      const select = document.getElementById(config.id);
      if (!select) continue;

      const previous = preferredClassId !== null ? preferredClassId : select.value;
      const prefix = config.defaultMode === 'all'
        ? `<option value="ALL">${config.id === 'hist-class-filter' ? 'Toutes' : 'Toutes les classes'}</option>`
        : '';

      select.innerHTML = prefix + classes.map(c =>
        `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`
      ).join('');

      if (classes.some(c => c.id === previous)) {
        select.value = previous;
      } else if (config.defaultMode === 'all') {
        select.value = 'ALL';
      } else if (classes.length) {
        select.value = classes[0].id;
      }
    }

    return classes;
  }

  async addClass() {
    const input = document.getElementById('new-class-name');
    const name = input.value.trim();
    if (!name) return;

    const existing = await db.get('classes', name);
    if (existing) {
      alert('Cette classe existe déjà.');
      return;
    }

    await db.put('classes', { id: name, name, color: '#2563eb' });
    await this.registerChange();
    input.value = '';

    // Mettre immédiatement à jour tous les sélecteurs de classe, sans recharger la page.
    await this.refreshClassSelectors(name);
    await this.renderClassesManageList();

    // Si l'utilisateur se trouve déjà dans une vue qui utilise les classes,
    // rafraîchir son contenu immédiatement.
    const activeView = document.querySelector('.view.active')?.id;
    if (activeView === 'view-students') await this.renderStudentsList();
    if (activeView === 'view-activities') await this.renderActivitiesView();
    if (activeView === 'view-stats') await this.renderStats();
    if (activeView === 'view-history') await this.renderHistory();

    this.showSaveIndicator();
  }

  async duplicateClass(classId) {
    const source=await db.get('classes',classId); if(!source)return; const name=prompt(`Nom de la nouvelle classe à partir de ${source.name} :`,`${source.name}-copie`); if(!name)return; const clean=name.trim(); if(!clean)return; if(await db.get('classes',clean)){alert('Cette classe existe déjà.');return;}
    await db.put('classes',{id:clean,name:clean}); const students=await db.getAll('students'); const sourceStudents=students.filter(s=>s.classId===classId&&!s.archived); const copy=confirm(`Copier aussi les ${sourceStudents.length} élèves dans ${clean} ?`); if(copy){let order=0;for(const st of sourceStudents){order++;await db.put('students',{...st,id:`std_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,classId:clean,importOrder:order});}}
    await this.refreshClassSelectors(clean); await this.renderClassesManageList(); await this.renderStudentsList(); await this.registerChange(); this.showSaveIndicator(); alert(`Classe ${clean} créée${copy?' avec les élèves copiés':''}.`);
  }

  async deleteClass(classId) {
    if (confirm(`Supprimer la classe ${classId} ?`)) {
      await db.delete('classes', classId);
      this.favoriteClasses=this.favoriteClasses.filter(id=>id!==classId); await this.saveFavorites();
      await this.refreshClassSelectors();
      await this.renderClassesManageList();
      const activeView = document.querySelector('.view.active')?.id;
      if (activeView === 'view-students') await this.renderStudentsList();
      if (activeView === 'view-activities') await this.renderActivitiesView();
      if (activeView === 'view-stats') await this.renderStats();
      if (activeView === 'view-history') await this.renderHistory();
    }
  }

  // --- FICHE INDIVIDUELLE ÉLÈVE ---
  async showStudentDetail(studentId) {
    this.activityStudentId = studentId;
    this.currentStudentDetailId = studentId;
    const student = await db.get('students', studentId);
    const allAttendance = await db.getAll('attendance');
    const studentRecords = allAttendance.filter(a => a.studentId === studentId);

    const aCount = studentRecords.filter(r => r.status === 'A').length;
    const rCount = studentRecords.filter(r => r.status === 'R').length;

    const card = document.getElementById('student-detail-card');
    card.innerHTML = `
      <h3>${student.nom} ${student.prenom}</h3>
      <p><b>Classe :</b> ${student.classId}</p>
      <p><b>Année Scolaire :</b> 2026 / 2027</p>
      <div class="stats-summary-grid" style="margin-top:12px;">
        <div class="stat-card"><div class="stat-number" style="color:var(--accent-a);">${aCount}</div><div>Absences</div></div>
        <div class="stat-card"><div class="stat-number" style="color:var(--accent-r);">${rCount}</div><div>Retards</div></div>
        <div class="stat-card"><div class="stat-number">${aCount + rCount}</div><div>Total</div></div>
      </div>
    `;

    const historyContainer = document.getElementById('student-detail-history');
    studentRecords.sort((a,b) => b.date.localeCompare(a.date));

    if (studentRecords.length === 0) {
      historyContainer.innerHTML = `<p>Aucune absence ou retard enregistré pour cet élève.</p>`;
    } else {
      historyContainer.innerHTML = `
        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <thead>
            <tr style="border-bottom:2px solid var(--border); text-align:left;">
              <th style="padding:8px;">Date</th>
              <th style="padding:8px;">Statut</th>
            </tr>
          </thead>
          <tbody>
            ${studentRecords.map(r => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px;">${this.formatDateFR(r.date)}</td>
                <td style="padding:8px; font-weight:bold; color:${r.status === 'A' ? 'var(--accent-a)' : 'var(--accent-r)'}">${r.status === 'A' ? 'Absent (A)' : 'Retard (R)'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    await this.renderStudentBehaviors(student);
    await this.renderStudentGeneralRemark(student);
    const customRemark = document.getElementById('student-custom-remark');
    if (customRemark) customRemark.value = student.customRemark || '';
    this.navigateTo('view-student-detail');
  }

  async saveStudentCustomRemark() {
    if (!this.currentStudentDetailId) return;
    const st = await db.get('students', this.currentStudentDetailId);
    if (!st) return;
    const field = document.getElementById('student-custom-remark');
    st.customRemark = field?.value.trim() || '';
    await db.put('students', st);
    await this.registerChange();
    this.showSaveIndicator();
    await this.renderStudentGeneralRemark(st);
    alert(this.language === 'ar' ? 'تم حفظ الملاحظة الشخصية.' : 'Remarque personnalisée enregistrée.');
  }

  async saveStudentNotes() {
    if(!this.currentStudentDetailId)return; const st=await db.get('students',this.currentStudentDetailId); if(!st)return;
    st.observation=document.getElementById('student-observation')?.value.trim()||''; st.goal=document.getElementById('student-goal')?.value.trim()||''; await db.put('students',st); await this.registerChange(); this.showSaveIndicator(); alert('Suivi pédagogique enregistré.');
  }

  getPracticesDomains() {
    return [
      {id:'postureEcouteEngagement',name:'Posture, écoute et engagement en classe',positive:[
        'Écoute attentivement les explications et reste concentré pendant la séance.',
        'Participe régulièrement et de manière pertinente aux échanges.',
        'Pose des questions lorsqu’une notion ou une consigne n’est pas comprise.',
        'S’implique activement dans les différentes phases du cours.',
        'Manifeste de la curiosité et de l’intérêt pour les activités mathématiques.'
      ], improve:[
        'Doit maintenir son attention pendant toute la durée de la séance.',
        'Éviter les distractions pendant les phases d’explication.',
        'Gagnerait à participer davantage à l’oral.',
        'Doit apprendre à signaler rapidement une difficulté plutôt que de rester passif.',
        'Doit adopter une posture plus active face aux apprentissages.'
      ]},
      {id:'initiativeBrouillon',name:'Initiative et travail au brouillon',positive:[
        'Se met rapidement au travail sans attendre la correction.',
        'Cherche activement une stratégie pour résoudre un problème.',
        'Utilise efficacement le brouillon pour faire des essais et organiser sa réflexion.',
        'N’hésite pas à tester plusieurs méthodes.',
        'Persévère même lorsqu’une première tentative échoue.'
      ], improve:[
        'Doit oser commencer une recherche seul avant de demander de l’aide.',
        'Utiliser davantage le brouillon pour essayer, schématiser et raisonner.',
        'Ne pas abandonner trop rapidement face à une difficulté.',
        'Doit conserver ses essais et ses erreurs afin de comprendre ce qui n’a pas fonctionné.',
        'Gagnerait à développer progressivement son autonomie dans la recherche.'
      ]},
      {id:'rigueurEcrit',name:'Rigueur de l’écrit et présentation mathématique',positive:[
        'Présente un travail propre, lisible et organisé.',
        'Pose correctement les calculs et respecte les étapes du raisonnement.',
        'Utilise correctement les symboles et les signes mathématiques.',
        'Rédige les réponses de manière claire et structurée.',
        'Réalise des figures géométriques précises et soignées.'
      ], improve:[
        'Doit améliorer la présentation et l’organisation de ses calculs.',
        'Penser à écrire toutes les étapes importantes du raisonnement.',
        'Veiller à aligner correctement les calculs et les signes d’égalité.',
        'Les réponses doivent être formulées par des phrases lorsque cela est nécessaire.',
        'Les constructions géométriques doivent être réalisées avec davantage de précision.'
      ]},
      {id:'langageMathematique',name:'Langage et communication mathématique',positive:[
        'Utilise un vocabulaire mathématique adapté.',
        'Explique clairement sa démarche à l’oral.',
        'Sait présenter une méthode de résolution au tableau.',
        'Justifie ses réponses en utilisant les propriétés mathématiques appropriées.',
        'Reformule correctement une consigne ou un résultat.'
      ], improve:[
        'Doit enrichir son vocabulaire mathématique.',
        'Éviter les formulations approximatives et utiliser les termes mathématiques appropriés.',
        'Doit apprendre à expliquer pourquoi une réponse est correcte.',
        'Les justifications doivent être davantage développées.',
        'Gagnerait à verbaliser les différentes étapes de son raisonnement.'
      ]},
      {id:'gestionErreurs',name:'Gestion des erreurs et autocorrection',positive:[
        'Accepte l’erreur comme une étape normale de l’apprentissage.',
        'Identifie l’origine de ses erreurs.',
        'Corrige son travail avec attention.',
        'Tient compte des remarques données lors de la correction.',
        'Cherche à ne pas reproduire les mêmes erreurs.'
      ], improve:[
        'Doit prendre le temps d’analyser ses erreurs plutôt que de simplement recopier la correction.',
        'Apprendre à identifier précisément l’étape où l’erreur a été commise.',
        'Doit relire son travail avant de le considérer comme terminé.',
        'Porter une attention particulière aux erreurs de signe et de calcul.',
        'Utiliser les corrections précédentes pour éviter de reproduire les mêmes erreurs.'
      ]},
      {id:'raisonnementProblemes',name:'Raisonnement et résolution de problèmes',positive:[
        'Analyse correctement les données avant de commencer.',
        'Identifie les informations utiles et la question posée.',
        'Choisit une stratégie adaptée à la situation.',
        'Sait expliquer les étapes suivies pour parvenir au résultat.',
        'Fait preuve de persévérance face aux situations-problèmes.'
      ], improve:[
        'Doit prendre le temps d’analyser la situation avant de commencer les calculs.',
        'Gagnerait à rechercher une stratégie plutôt qu’à appliquer directement une formule.',
        'Doit apprendre à distinguer les données utiles des données inutiles.',
        'Penser à vérifier si la méthode choisie répond réellement à la question.',
        'Doit développer sa capacité à résoudre une situation sans modèle immédiatement fourni.'
      ]},
      {id:'memorisation',name:'Mémorisation et mobilisation des connaissances',positive:[
        'Réutilise correctement les notions étudiées dans de nouvelles situations.',
        'Mobilise les propriétés et méthodes apprises de manière pertinente.',
        'Connaît les formules et propriétés essentielles.',
        'Fait le lien entre les différentes notions étudiées.',
        'Réinvestit les corrections et les méthodes précédemment rencontrées.'
      ], improve:[
        'Doit consolider les notions essentielles vues en classe.',
        'Apprendre les définitions, propriétés et formules importantes.',
        'Gagnerait à revoir régulièrement les notions plutôt qu’avant les évaluations uniquement.',
        'Doit apprendre à reconnaître quand utiliser une propriété ou une méthode.',
        'Renforcer le réinvestissement des connaissances dans des exercices différents.'
      ]},
      {id:'autonomieOrganisationMateriel',name:'Autonomie, organisation et gestion du matériel',positive:[
        'Arrive avec le matériel nécessaire et l’utilise correctement.',
        'Organise efficacement son cahier et ses documents.',
        'Travaille de manière autonome après lecture de la consigne.',
        'Gère correctement son temps pendant les activités.',
        'Prend en charge son propre travail et demande de l’aide de manière pertinente.'
      ], improve:[
        'Doit apporter systématiquement le matériel nécessaire.',
        'Améliorer l’organisation du cahier et des documents.',
        'Doit apprendre à lire attentivement une consigne avant de solliciter de l’aide.',
        'Gagnerait à mieux gérer son temps pendant les exercices.',
        'Développer progressivement son autonomie face aux tâches mathématiques.'
      ]}
    ];
  }

  normalizePractices(p) {
    const domains=this.getPracticesDomains(); const src=p||{}; const out={};
    for(const d of domains){ const x=src[d.id]||{}; out[d.id]={niveau:x.niveau||'non_evalue',positives:Array.isArray(x.positives)?x.positives:[],ameliorations:Array.isArray(x.ameliorations)?x.ameliorations:[],remarque:x.remarque||''}; }
    out.remarqueGenerale=src.remarqueGenerale||''; return out;
  }

  async renderStudentPractices(student){
    const container=document.getElementById('student-practices-container'); if(!container)return;
    const p=this.normalizePractices(student.pratiquesAttitudes); const ar=this.language==='ar';
    const levels=ar?[['non_evalue','غير مُقيّم'],['tres_satisfaisant','مرضٍ جدًا'],['satisfaisant','مرضي'],['a_ameliorer','يحتاج إلى تحسين'],['insuffisant','غير كاف']]:[['non_evalue','Non évalué'],['tres_satisfaisant','Très satisfaisant'],['satisfaisant','Satisfaisant'],['a_ameliorer','À améliorer'],['insuffisant','Insuffisant']];
    const esc=v=>this.escapeHtml(v);
    container.innerHTML=this.getPracticesDomains().map(d=>{const x=p[d.id];return `<div class="practice-domain-card"><h4>${esc(d.name)}</h4><div class="practice-level"><label>${ar?'المستوى':'Niveau'} :</label><select class="form-control practice-level-select" data-domain="${d.id}">${levels.map(([v,l])=>`<option value="${v}" ${x.niveau===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="practice-cols"><div><b>${ar?'مواقف إيجابية':'Attitudes positives'}</b>${d.positive.map((t,i)=>`<label class="practice-check"><input type="checkbox" data-domain="${d.id}" data-kind="positives" data-index="${i}" ${x.positives.includes(i)?'checked':''}> <span>${esc(t)}</span></label>`).join('')}</div><div><b>${ar?'محاور التحسين':'Axes d’amélioration'}</b>${d.improve.map((t,i)=>`<label class="practice-check"><input type="checkbox" data-domain="${d.id}" data-kind="ameliorations" data-index="${i}" ${x.ameliorations.includes(i)?'checked':''}> <span>${esc(t)}</span></label>`).join('')}</div></div><div class="form-group"><label>${ar?'ملاحظة شخصية':'Remarque personnelle'} :</label><textarea class="form-control practice-note" data-domain="${d.id}" rows="2" placeholder="${ar?'ملاحظة اختيارية...':'Remarque facultative...'}">${esc(x.remarque)}</textarea></div></div>`}).join('');
    const g=document.getElementById('student-practices-general'); if(g)g.value=p.remarqueGenerale;
  }

  async saveStudentPractices(){
    if(!this.currentStudentDetailId)return; const st=await db.get('students',this.currentStudentDetailId); if(!st)return;
    const p=this.normalizePractices(st.pratiquesAttitudes); document.querySelectorAll('.practice-level-select').forEach(el=>{if(p[el.dataset.domain])p[el.dataset.domain].niveau=el.value;});
    document.querySelectorAll('.practice-check').forEach(label=>{const el=label.querySelector('input');const x=p[el.dataset.domain];if(!x)return;const arr=x[el.dataset.kind];const i=Number(el.dataset.index);if(el.checked&&!arr.includes(i))arr.push(i);if(!el.checked)x[el.dataset.kind]=arr.filter(v=>Number(v)!==i);});
    document.querySelectorAll('.practice-note').forEach(el=>{if(p[el.dataset.domain])p[el.dataset.domain].remarque=el.value.trim();});
    p.remarqueGenerale=document.getElementById('student-practices-general')?.value.trim()||''; st.pratiquesAttitudes=p; await db.put('students',st); await this.registerChange(); this.showSaveIndicator(); alert(this.language==='ar'?'تم حفظ الممارسات والمواقف.':'Pratiques et attitudes enregistrées.');
  }

  // ==========================================================================
  // v4.5 — « Pratiques et comportements en mathématiques » (5 domaines, cases à
  // cocher uniquement — pas de niveau) + génération automatique des
  // « Remarques générales ». N'utilise QUE des données déjà présentes dans
  // l'application (activityEvents / activityActions existants). Le système
  // précédent (getPracticesDomains / normalizePractices / student.pratiquesAttitudes)
  // n'est ni supprimé ni modifié : il reste stocké tel quel pour compatibilité,
  // simplement plus affiché dans cette nouvelle fiche.
  // ==========================================================================

  getBehaviorDomains() {
    return [
      { id:'rituelsOrganisation', name:'Rituels & organisation', nameAr:'الطقوس والتنظيم', items:[
        { fr:'Entrée/sortie agitées.', ar:'الدخول/الخروج بشكل غير منظم.' },
        { fr:'Affaires ou matériel souvent non préparés.', ar:'الأدوات أو اللوازم غالبًا غير مُعدة.' },
        { fr:'Oublie régulièrement le matériel de mathématiques.', ar:'ينسى بانتظام لوازم الرياضيات.' },
        { fr:"A besoin d'aide pour organiser son espace de travail.", ar:'يحتاج إلى مساعدة لتنظيم فضاء عمله.' }
      ]},
      { id:'ecouteConcentration', name:'Écoute & concentration', nameAr:'الإنصات والتركيز', items:[
        { fr:'Se distrait ou bavarde pendant les explications.', ar:'يتشتت انتباهه أو يتحدث أثناء الشرح.' },
        { fr:'A du mal à maintenir son attention.', ar:'يجد صعوبة في الحفاظ على انتباهه.' },
        { fr:"Intervient ou lève la main pendant les explications sans attendre le signal.", ar:'يتدخل أو يرفع يده أثناء الشرح دون انتظار الإشارة.' },
        { fr:'Ne regarde pas attentivement le tableau ou le support présenté.', ar:'لا يتابع السبورة أو الدعامة المعروضة بانتباه.' }
      ]},
      { id:'travailEngagement', name:'Travail & engagement', nameAr:'العمل والانخراط', items:[
        { fr:'Démarre difficilement le travail.', ar:'يجد صعوبة في الشروع في العمل.' },
        { fr:'Participe peu aux activités.', ar:'يشارك بشكل ضعيف في الأنشطة.' },
        { fr:"A besoin d'être régulièrement incité à travailler.", ar:'يحتاج إلى تحفيز متكرر للعمل.' },
        { fr:'Abandonne rapidement face à une difficulté.', ar:'يستسلم بسرعة أمام الصعوبة.' },
        { fr:'Bavarde pendant le travail en binôme ou autonome.', ar:'يتحدث أثناء العمل الثنائي أو الفردي.' },
        { fr:'Gère difficilement le temps de travail.', ar:'يجد صعوبة في تدبير وقت العمل.' }
      ]},
      { id:'rigueurRaisonnement', name:'Rigueur & raisonnement', nameAr:'الدقة والاستدلال', items:[
        { fr:'Manque de précision dans ses écrits mathématiques.', ar:'ينقصه الدقة في كتاباته الرياضياتية.' },
        { fr:'Utilise un vocabulaire mathématique imprécis.', ar:'يستعمل مفردات رياضياتية غير دقيقة.' },
        { fr:'A des difficultés à expliquer son raisonnement.', ar:'يجد صعوبة في شرح استدلاله.' },
        { fr:'Évite ou refuse de présenter son travail au tableau.', ar:'يتجنب أو يرفض تقديم عمله على السبورة.' },
        { fr:'Corrige difficilement ses erreurs.', ar:'يجد صعوبة في تصحيح أخطائه.' },
        { fr:'Ne vérifie pas suffisamment la cohérence de ses résultats.', ar:'لا يتحقق بشكل كافٍ من انسجام نتائجه.' }
      ]},
      { id:'respectCollaboration', name:'Respect & collaboration', nameAr:'الاحترام والتعاون', items:[
        { fr:'Interrompt les autres ou ne respecte pas le tour de parole.', ar:'يقاطع الآخرين أو لا يحترم التناوب في الكلام.' },
        { fr:'Se moque des erreurs de ses camarades.', ar:'يسخر من أخطاء زملائه.' },
        { fr:'Dérange les autres pendant leur travail.', ar:'يزعج الآخرين أثناء عملهم.' },
        { fr:'Participe difficilement au travail de groupe ou en binôme.', ar:'يجد صعوبة في المشاركة في العمل الجماعي أو الثنائي.' },
        { fr:"Ne respecte pas suffisamment le matériel ou l'environnement de travail.", ar:'لا يحترم بشكل كافٍ الأدوات أو محيط العمل.' }
      ]}
    ];
  }

  // Normalise student.pratiquesComportements : { domainId: [indices cochés] }.
  // Toujours renvoyer un tableau (même vide) pour chaque domaine connu, sans
  // jamais perdre d'éventuelles données déjà enregistrées pour un domaine.
  normalizeBehaviorChecks(raw) {
    const domains = this.getBehaviorDomains(); const src = raw || {}; const out = {};
    for (const d of domains) { const arr = src[d.id]; out[d.id] = Array.isArray(arr) ? arr.map(Number).filter(n=>Number.isInteger(n)) : []; }
    return out;
  }

  async renderStudentBehaviors(student) {
    const container = document.getElementById('student-behaviors-container'); if (!container) return;
    const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
    const ar = this.language === 'ar'; const esc = v => this.escapeHtml(v);
    container.innerHTML = this.getBehaviorDomains().map(d => {
      const sel = checks[d.id] || [];
      const rows = d.items.map((it, i) => `<label class="behavior-check-item"><input type="checkbox" data-domain="${d.id}" data-index="${i}" ${sel.includes(i)?'checked':''}> <span>${esc(ar?it.ar:it.fr)}</span></label>`).join('');
      return `<div class="behavior-domain-card"><h4>${esc(ar?d.nameAr:d.name)}</h4><div class="behavior-check-list">${rows}</div></div>`;
    }).join('');
  }

  async saveStudentBehaviors() {
    if (!this.currentStudentDetailId) return; const st = await db.get('students', this.currentStudentDetailId); if (!st) return;
    const checks = this.normalizeBehaviorChecks(st.pratiquesComportements);
    document.querySelectorAll('#student-behaviors-container input[type="checkbox"]').forEach(el => {
      const arr = checks[el.dataset.domain]; if (!arr) return; const i = Number(el.dataset.index);
      if (el.checked && !arr.includes(i)) arr.push(i);
      if (!el.checked) checks[el.dataset.domain] = arr.filter(v => v !== i);
    });
    st.pratiquesComportements = checks; await db.put('students', st); await this.registerChange(); this.showSaveIndicator();
    await this.renderStudentGeneralRemark(st);
    alert(this.language === 'ar' ? 'تم حفظ السلوكات.' : 'Comportements enregistrés.');
  }

  // Correspondance entre les remarques automatiques et les actions de
  // pénalités DÉJÀ existantes dans l'application (activityActions). Aucune
  // nouvelle pénalité n'est créée : on se contente de regrouper des actions
  // existantes par thème pour générer un texte de synthèse.
  getRemarkActionMap() {
    return {
      devoirMaison: ['acta_homework'],
      travailDomicile: ['acta_late', 'acta_incomplete', 'acta_consigne'],
      oubliLivre: ['acta_book'],
      oubliCahier: ['acta_notebook'],
      oubliMateriel: ['acta_material'],
      manqueParticipation: ['acta_participation', 'acta_refuse'],
      manqueConcentration: ['acta_listen'],
      collaboration: ['acta_group_refuse', 'acta_group_no', 'acta_respect']
    };
  }

  getRemarkThresholds() {
    return {
      devoirMaison: 2,
      travailDomicile: 5,
      oubliLivre: { low: 2, high: 4 },
      oubliCahier: 3,
      oubliMateriel: 3,
      manqueParticipation: 3,
      manqueConcentration: 3,
      collaboration: 3
    };
  }

  joinList(list, ar) {
    if (list.length === 1) return list[0];
    const sep = ar ? ' و' : ' et ';
    if (list.length === 2) return list.join(sep);
    return (ar ? list.slice(0, -1).join('، ') : list.slice(0, -1).join(', ')) + sep + list[list.length - 1];
  }

  // Comptabilise, à partir des activityEvents NON archivés de l'élève, le
  // nombre d'occurrences pour chaque thème de remarque (seuils précis, jamais
  // de fusion entre « devoir maison » et « travail à domicile »).
  countRemarkOccurrences(events) {
    const map = this.getRemarkActionMap(); const counts = {};
    for (const key in map) counts[key] = events.filter(e => map[key].includes(e.actionId)).length;
    return counts;
  }

  // Génère le texte de la rubrique « Remarques générales » à partir : des
  // pénalités déjà enregistrées, des devoirs maison, du travail à domicile et
  // des comportements cochés dans les 5 domaines. Ne jamais inventer de
  // difficulté qui ne serait pas atteinte par son seuil.
  buildGeneralRemark(student, events) {
    const ar = this.language === 'ar';
    const counts = this.countRemarkOccurrences(events);
    const th = this.getRemarkThresholds();
    const phrases = [];

    // 1. Devoir maison / travail à domicile (jamais fusionnés dans le calcul,
    // mais regroupés dans une phrase commune si les deux seuils sont atteints).
    const dmFlag = counts.devoirMaison >= th.devoirMaison;
    const tdFlag = counts.travailDomicile >= th.travailDomicile;
    if (dmFlag && tdFlag) {
      phrases.push(ar
        ? 'لا يُنجز الواجبات المنزلية ولا العمل في المنزل بانتظام. من الضروري مزيد من الانتظام في العمل الشخصي لترسيخ التعلمات.'
        : 'Les devoirs à la maison et le travail à domicile ne sont pas réalisés régulièrement. Une plus grande régularité dans le travail personnel est nécessaire pour consolider les apprentissages.');
    } else if (dmFlag) {
      phrases.push(ar
        ? 'لا يُنجز الواجبات المنزلية بانتظام. من الضروري العمل الشخصي المنتظم لترسيخ التعلمات.'
        : 'Les devoirs à la maison ne sont pas réalisés régulièrement. Un travail personnel plus régulier est nécessaire pour consolider les apprentissages.');
    } else if (tdFlag) {
      phrases.push(ar
        ? 'لا يُنجز العمل في المنزل بانتظام. من الضروري مزيد من الانتظام في العمل الشخصي لترسيخ التعلمات.'
        : "Le travail à domicile n'est pas réalisé régulièrement. Une plus grande régularité dans le travail personnel est nécessaire pour consolider les apprentissages.");
    }

    // 2. Matériel (livre / cahier / matériel), avec un seuil à deux paliers pour le livre.
    const matItems = [];
    if (counts.oubliLivre >= th.oubliLivre.high) matItems.push({ fr: 'son livre scolaire', ar: 'كتابه المدرسي', high: true });
    else if (counts.oubliLivre >= th.oubliLivre.low) matItems.push({ fr: 'son livre scolaire', ar: 'كتابه المدرسي', high: false });
    if (counts.oubliCahier >= th.oubliCahier) matItems.push({ fr: 'son cahier', ar: 'كراسته', high: false });
    if (counts.oubliMateriel >= th.oubliMateriel) matItems.push({ fr: 'son matériel', ar: 'لوازمه', high: false });
    if (matItems.length === 1) {
      const it = matItems[0];
      if (it.high) phrases.push(ar ? `ينسى ${it.ar} بانتظام. ينبغي تحسين تحضير اللوازم قبل الحصص.` : `L'élève oublie régulièrement ${it.fr}. Une meilleure préparation du matériel avant les cours est nécessaire.`);
      else phrases.push(ar ? `ينسى ${it.ar} غالبًا وعليه الحرص على تحضير لوازمه قبل كل حصة.` : `L'élève oublie souvent ${it.fr} et doit veiller à préparer son matériel avant chaque séance.`);
    } else if (matItems.length > 1) {
      const list = this.joinList(matItems.map(i => ar ? i.ar : i.fr), ar);
      phrases.push(ar ? `على التلميذ الحرص على تحضير ${list} قبل كل حصة.` : `L'élève doit veiller à préparer ${list} avant chaque séance.`);
    }

    // 3. Comportement en classe repéré via les pénalités déjà existantes.
    const classroom = [];
    if (counts.manqueParticipation >= th.manqueParticipation) classroom.push(ar ? 'يشارك بشكل غير كافٍ في الأنشطة' : 'participe insuffisamment aux activités');
    if (counts.manqueConcentration >= th.manqueConcentration) classroom.push(ar ? 'يعاني من نقص التركيز أثناء الشرح' : "manque de concentration pendant les explications");
    if (counts.collaboration >= th.collaboration) classroom.push(ar ? 'يحتاج إلى تحسين سلوكه تجاه زملائه والعمل الجماعي' : 'doit améliorer son comportement envers ses camarades et le travail collectif');
    if (classroom.length) phrases.push(ar ? `داخل القسم، ${this.joinList(classroom, ar)}.` : `En classe, l'élève ${this.joinList(classroom, ar)}.`);

    // 4. Comportements cochés dans les 5 domaines (Rituels & organisation, etc.).
    const domainTemplates = {
      rituelsOrganisation: { fr: 'veiller à préparer son matériel et organiser son espace de travail', ar: 'الحرص على تحضير لوازمه وتنظيم فضاء عمله' },
      ecouteConcentration: { fr: 'améliorer son écoute et sa concentration pendant les explications', ar: 'تحسين إنصاته وتركيزه أثناء الشرح' },
      travailEngagement: { fr: 's’engager davantage dans les activités et faire preuve de persévérance', ar: 'الانخراط أكثر في الأنشطة والتحلي بالمثابرة' },
      rigueurRaisonnement: { fr: 'gagner en rigueur dans la rédaction et l’explication de son raisonnement', ar: 'اكتساب مزيد من الدقة في التحرير وشرح استدلاله' },
      respectCollaboration: { fr: 'améliorer le respect des autres et la collaboration en classe', ar: 'تحسين احترام الآخرين والتعاون داخل القسم' }
    };
    const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
    const domainClauses = [];
    for (const d of this.getBehaviorDomains()) { if ((checks[d.id]||[]).length > 0 && domainTemplates[d.id]) domainClauses.push(ar ? domainTemplates[d.id].ar : domainTemplates[d.id].fr); }
    if (domainClauses.length) phrases.push(ar ? `على مستوى السلوك، على التلميذ ${this.joinList(domainClauses, ar)}.` : `Sur le plan du comportement, l'élève doit ${this.joinList(domainClauses, ar)}.`);

    if (!phrases.length) return ar ? 'لا توجد ملاحظة خاصة تستدعي الإشارة.' : 'Aucune remarque particulière à signaler.';
    return phrases.join(' ');
  }

  async renderStudentGeneralRemark(student) {
    const box = document.getElementById('student-general-remark'); if (!box) return;
    const events = (await db.getAll('activityEvents')).filter(e => e.studentId === student.id && !e.archivedAt);
    box.textContent = this.buildGeneralRemark(student, events);
  }

  async printStudentReport() {
    const st = await db.get('students', this.currentStudentDetailId);
    if (!st) return;
    const [attAll, evAll, timetable, categories, actions] = await Promise.all([
      db.getAll('attendance'), db.getAll('activityEvents'), db.getAll('timetable'),
      db.getAll('activityCategories'), db.getAll('activityActions')
    ]);
    const att = attAll.filter(a => a.studentId === st.id).sort((a,b) => b.date.localeCompare(a.date) || String(b.timestamp||0).localeCompare(String(a.timestamp||0)));
    const ev = evAll.filter(e => e.studentId === st.id && !e.archivedAt).sort((a,b) => String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)));
    const maxScore = Number((await db.get('settings','activityMaxScore'))?.value || 20);
    const deducted = ev.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
    const score = Math.max(0, Math.min(maxScore, maxScore - deducted));
    const esc = v => this.escapeHtml(v);
    const attendanceRows = att.length ? att.map(r => {
      const c = timetable.find(x => x.id === r.courseId);
      const horaire = c ? `${c.startTime} – ${c.endTime}` : 'Horaire non renseigné';
      return `<tr><td>${esc(this.formatDateFR(r.date))}</td><td>${esc(horaire)}</td><td><b>${r.status==='A'?'Absence (A)':'Retard (R)'}</b></td></tr>`;
    }).join('') : '<tr><td colspan="3">Aucune absence ou retard enregistré.</td></tr>';
    const eventRows = ev.length ? ev.map(e => {
      const c = categories.find(x => x.id === e.categoryId);
      const a = actions.find(x => x.id === e.actionId);
      return `<tr><td>${esc(this.formatDateFR(e.date))}</td><td>${esc(c?.name || 'Catégorie supprimée')}</td><td>${esc(a?.name || 'Action supprimée')}</td><td>${e.type==='reward'||Number(e.penalty)<0?'+':'−'}${Math.abs(Number(e.penalty||0)).toFixed(2)}</td></tr>`;
    }).join('') : '<tr><td colspan="4">Aucune pénalité enregistrée.</td></tr>';
    this.openPrintReport(`Rapport — ${st.nom} ${st.prenom}`, `
      <h1>${esc(st.nom)} ${esc(st.prenom)}</h1>
      <p><b>Classe :</b> ${esc(st.classId)} — <b>Année :</b> ${esc(this.activeSchoolYear)}</p>
      <h2>Présence détaillée</h2>
      <p><b>Absences :</b> ${att.filter(a=>a.status==='A').length} &nbsp; | &nbsp; <b>Retards :</b> ${att.filter(a=>a.status==='R').length}</p>
      <table border="1" cellspacing="0" cellpadding="7" width="100%"><thead><tr><th>Date</th><th>Horaire</th><th>Statut</th></tr></thead><tbody>${attendanceRows}</tbody></table>
      <h2>Comportement détaillé</h2>
      <p>Note actuelle : <b>${score.toFixed(2)} / ${maxScore}</b> — Ajustement net : <b>${deducted>0?'−':'+'}${Math.abs(deducted).toFixed(2)} point(s)</b></p>
      <table border="1" cellspacing="0" cellpadding="7" width="100%"><thead><tr><th>Date</th><th>Catégorie</th><th>Pénalité</th><th>Points</th></tr></thead><tbody>${eventRows}</tbody></table>
      ${this.buildBehaviorsReportHtml(st, esc)}
      <h2>Remarques générales</h2>
      <p>${esc(this.buildGeneralRemark(st, ev))}</p>
      ${st.customRemark ? `<div style="margin-top:12px;padding:12px;border-left:4px solid #888;background:#f7f7f7"><b>✍️ Remarque personnalisée :</b><p style="margin:6px 0 0">${esc(st.customRemark)}</p></div>` : ''}
      ${this.buildPracticesReportHtml(st.pratiquesAttitudes, esc)}
    `);
  }

  // Rapport imprimé — domaines de comportements cochés (aucun niveau, aucune
  // note : uniquement les points à améliorer réellement cochés pour l'élève).
  buildBehaviorsReportHtml(student, esc) {
    const ar = this.language === 'ar';
    const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
    const domains = this.getBehaviorDomains().map(d => {
      const sel = checks[d.id] || []; if (!sel.length) return null;
      const items = sel.map(i => d.items[i]).filter(Boolean).map(it => `<li>${esc(ar ? it.ar : it.fr)}</li>`).join('');
      return `<div style="margin-bottom:12px;padding:8px 10px;border:1px solid #ddd;border-radius:8px"><h3 style="margin:0 0 6px">${esc(ar ? d.nameAr : d.name)}</h3><ul>${items}</ul></div>`;
    }).filter(Boolean);
    const body = domains.length ? domains.join('') : `<p>${ar ? 'لم يتم تسجيل أي صعوبة سلوكية.' : "Aucune difficulté de comportement n'a été signalée."}</p>`;
    return `<h2>${ar ? 'الممارسات والسلوكات في الرياضيات' : 'Pratiques et comportements en mathématiques'}</h2>${body}`;
  }

  buildPracticesReportHtml(data, esc){
    const p=this.normalizePractices(data); const levels={non_evalue:'Non évalué',tres_satisfaisant:'Très satisfaisant',satisfaisant:'Satisfaisant',a_ameliorer:'À améliorer',insuffisant:'Insuffisant'};
    const ds=this.getPracticesDomains();
    const cards=ds.map(d=>{
      const x=p[d.id]||{niveau:'non_evalue',positives:[],ameliorations:[],remarque:''};
      const pos=x.positives.map(i=>d.positive[Number(i)]).filter(Boolean);
      const imp=x.ameliorations.map(i=>d.improve[Number(i)]).filter(Boolean);
      const hasContent=x.niveau && x.niveau!=='non_evalue' || pos.length || imp.length || x.remarque;
      if(!hasContent) return '';
      return `<div style="margin-bottom:16px;padding:10px;border:1px solid #ddd;border-radius:8px"><h3>${esc(d.name)}</h3><p><b>Niveau :</b> ${esc(levels[x.niveau]||levels.non_evalue)}</p>${pos.length?`<p><b>Points positifs :</b></p><ul>${pos.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}${imp.length?`<p><b>Axes d’amélioration :</b></p><ul>${imp.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}${x.remarque?`<p><b>Remarque personnelle :</b> ${esc(x.remarque)}</p>`:''}</div>`;
    }).join('');
    if(!cards && !p.remarqueGenerale) return '';
    return `<h2>Pratiques et attitudes en mathématiques</h2>${cards}${p.remarqueGenerale?`<h3>Remarque générale sur les pratiques de travail</h3><p>${esc(p.remarqueGenerale)}</p>`:''}`;
  }

  openPrintReport(title,html){ const w=window.open('','_blank','width=900,height=700'); if(!w){alert('Autorisez les fenêtres pop-up pour imprimer le rapport.');return;} w.document.write(`<html><head><title>${this.escapeHtml(title)}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:35px;line-height:1.5}h1{margin-bottom:4px}h2{border-bottom:1px solid #ddd;padding-bottom:5px}@media print{body{padding:10px}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); }

  async printClassReport(){ const classes=await db.getAll('classes'), students=await db.getAll('students'), att=await db.getAll('attendance'); const rows=classes.map(c=>{const ss=students.filter(s=>s.classId===c.id&&!s.archived);const aa=att.filter(a=>a.classId===c.id);return `<tr><td>${this.escapeHtml(c.name)}</td><td>${ss.length}</td><td>${aa.filter(a=>a.status==='A').length}</td><td>${aa.filter(a=>a.status==='R').length}</td></tr>`}).join(''); this.openPrintReport(`Rapport de classe — ${this.activeSchoolYear}`,`<h1>Rapport global des classes</h1><p>Année scolaire : <b>${this.activeSchoolYear}</b></p><table border="1" cellspacing="0" cellpadding="8" width="100%"><tr><th>Classe</th><th>Élèves</th><th>Absences</th><th>Retards</th></tr>${rows}</table>`); }

  // --- STATISTIQUES VIEW ---
  async renderStats() {
    const classes = await db.getAll('classes');
    const classFilterSelect = document.getElementById('stats-class-filter');
    
    if (classFilterSelect.options.length <= 1) {
      classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        classFilterSelect.appendChild(opt);
      });
    }

    const selectedClass = classFilterSelect.value;
    const selectedPeriod = document.getElementById('stats-period-filter').value;

    let allAttendance = await db.getAll('attendance');

    if (selectedClass !== 'ALL') {
      allAttendance = allAttendance.filter(a => a.classId === selectedClass);
    }

    // Filtre Période
    const [sy] = this.activeSchoolYear.split('/').map(Number);
    const startYear = `${sy}-09-01`;
    const s1End = `${sy+1}-01-31`;
    const s2Start = `${sy+1}-02-01`;
    const endYear = `${sy+1}-06-30`;
    if (selectedPeriod === 'S1') allAttendance = allAttendance.filter(a => a.date >= startYear && a.date <= s1End);
    if (selectedPeriod === 'S2') allAttendance = allAttendance.filter(a => a.date >= s2Start && a.date <= endYear);

    const totalA = allAttendance.filter(a => a.status === 'A').length;
    const totalR = allAttendance.filter(a => a.status === 'R').length;

    const summaryCards = document.getElementById('stats-summary-cards');
    summaryCards.innerHTML = `
      <div class="stat-card"><div class="stat-number" style="color:var(--accent-a);">${totalA}</div><div>Total Absences</div></div>
      <div class="stat-card"><div class="stat-number" style="color:var(--accent-r);">${totalR}</div><div>Total Retards</div></div>
      <div class="stat-card"><div class="stat-number">${totalA + totalR}</div><div>Total Incidents</div></div>
    `;

    // Top élèves absents
    const studentCounts = {};
    allAttendance.forEach(a => {
      if (!studentCounts[a.studentId]) studentCounts[a.studentId] = { a: 0, r: 0 };
      if (a.status === 'A') studentCounts[a.studentId].a++;
      if (a.status === 'R') studentCounts[a.studentId].r++;
    });

    const allStudents = await db.getAll('students');
    const leaderboard = Object.keys(studentCounts).map(id => {
      const st = allStudents.find(s => s.id === id);
      return {
        name: st ? `${st.nom} ${st.prenom}` : 'Inconnu',
        classId: st ? st.classId : '',
        a: studentCounts[id].a,
        r: studentCounts[id].r,
        total: studentCounts[id].a + studentCounts[id].r
      };
    }).sort((a,b) => b.total - a.total).slice(0, 10);

    const topList = document.getElementById('stats-top-list');
    if (leaderboard.length === 0) {
      topList.innerHTML = `<p>Aucune donnée statistique disponible pour cette sélection.</p>`;
    } else {
      topList.innerHTML = leaderboard.map((item, i) => `
        <div class="manage-item" style="margin-bottom:6px;">
          <div><strong>${i + 1}. ${item.name}</strong> <small>(${item.classId})</small></div>
          <div>
            <span style="color:var(--accent-a); font-weight:bold;">${item.a} A</span> | 
            <span style="color:var(--accent-r); font-weight:bold;">${item.r} R</span>
          </div>
        </div>
      `).join('');
    }
    const alertList=document.getElementById('stats-alert-list');
    if(alertList){
      const students=await db.getAll('students'), events=await db.getAll('activityEvents'); const alerts=[];
      for(const st of students.filter(s=>!s.archived && (selectedClass==='ALL'||s.classId===selectedClass))){
        const rec=allAttendance.filter(a=>a.studentId===st.id); const ac=rec.filter(a=>a.status==='A').length, rc=rec.filter(a=>a.status==='R').length; const score=Math.max(0,20-events.filter(e=>e.studentId===st.id&&!e.archivedAt).reduce((z,e)=>z+Number(e.penalty||0),0));
        if(ac>=3||rc>=3||score<15) alerts.push({st,ac,rc,score});
      }
      alerts.sort((x,y)=>(y.ac+y.rc)- (x.ac+x.rc)); alertList.innerHTML=alerts.length?alerts.map(x=>`<div class="manage-item"><div><b>${this.escapeHtml(x.st.nom)} ${this.escapeHtml(x.st.prenom)}</b><small> (${x.st.classId})</small></div><div>${x.ac} A · ${x.rc} R · ${x.score.toFixed(1)}/20</div></div>`).join(''):'<p class="help-text">Aucun élève à surveiller selon les seuils actuels.</p>';
    }
  }

  // --- HISTORIQUE VIEW ---
  async renderHistory() {
    const classes = await db.getAll('classes');
    const selectClass = document.getElementById('hist-class-filter');
    if (selectClass.options.length <= 1) {
      classes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name;
        selectClass.appendChild(opt);
      });
    }

    const classVal = selectClass.value;
    const statusVal = document.getElementById('hist-status-filter').value;

    let records = await db.getAll('attendance');
    if (classVal !== 'ALL') records = records.filter(r => r.classId === classVal);
    if (statusVal !== 'ALL') records = records.filter(r => r.status === statusVal);

    records.sort((a,b) => b.date.localeCompare(a.date));

    const allStudents = await db.getAll('students');
    const container = document.getElementById('history-records-list');

    if (records.length === 0) {
      container.innerHTML = `<div class="card"><p style="text-align:center;">Aucun historique d'absence trouvé.</p></div>`;
      return;
    }

    container.innerHTML = records.slice(0, 100).map(r => {
      const st = allStudents.find(s => s.id === r.studentId);
      const name = st ? `${st.nom} ${st.prenom}` : 'Élève';
      return `
        <div class="manage-item">
          <div>
            <strong>${this.formatDateFR(r.date)}</strong> — ${name} <small>(${r.classId})</small>
          </div>
          <div>
            <span style="font-weight:bold; color:${r.status === 'A' ? 'var(--accent-a)' : 'var(--accent-r)'}">
              ${r.status === 'A' ? 'ABSENT' : 'RETARD'}
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  // --- EMPLOI DU TEMPS EDITOR ---
  async renderTimetableEditor() {
    const timetable = await db.getAll('timetable');
    timetable.sort((a,b) => a.day - b.day || a.startTime.localeCompare(b.startTime));

    const container = document.getElementById('timetable-editor-list');
    container.innerHTML = timetable.map(c => `
      <div class="manage-item" style="margin-top:8px;">
        <div>
          <strong>${this.getDayNameFR(c.day)}</strong> : ${c.startTime} – ${c.endTime}
          <div style="color:var(--primary); font-weight:bold;">${c.classId}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary" onclick="app.editCourse('${c.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="app.deleteCourse('${c.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  }

  async editCourse(id) {
    const c=await db.get('timetable',id); if(!c)return; await this.openModal('modal-course',true);
    document.getElementById('modal-course-title').innerText='Modifier le créneau'; document.getElementById('course-id').value=c.id; document.getElementById('course-class-id').value=c.classId; document.getElementById('course-day').value=String(c.day); document.getElementById('course-start-time').value=c.startTime; document.getElementById('course-end-time').value=c.endTime;
  }

  async saveCourse() {
    const id=document.getElementById('course-id').value||`course_${Date.now()}`; const classId=document.getElementById('course-class-id').value; const day=parseInt(document.getElementById('course-day').value,10); const startTime=document.getElementById('course-start-time').value; const endTime=document.getElementById('course-end-time').value;
    if(!classId||!startTime||!endTime||startTime>=endTime){alert('Veuillez vérifier la classe et les horaires.');return;}
    const all=await db.getAll('timetable'); const conflict=all.find(c=>c.id!==id&&c.day===day&&c.classId===classId&&startTime<c.endTime&&endTime>c.startTime); if(conflict){alert('Ce créneau chevauche déjà un autre cours de cette classe.');return;}
    await db.put('timetable',{id,classId,day,startTime,endTime}); this.closeModal('modal-course'); this.renderTimetableEditor(); this.showSaveIndicator();
  }

  async deleteCourse(id) {
    if (confirm("Supprimer ce créneau ?")) {
      await db.delete('timetable', id);
      this.renderTimetableEditor();
      this.showSaveIndicator();
    }
  }

  // --- CALENDRIER VIEW ---
  async renderCalendarView() {
    const calendar = await db.getAll('calendar');
    calendar.sort((a,b) => a.startDate.localeCompare(b.startDate));

    const container = document.getElementById('calendar-events-list');
    container.innerHTML = calendar.map(ev => `
      <div class="manage-item" style="margin-top:8px;">
        <div>
          <strong>${ev.title}</strong>
          <div>Du ${this.formatDateFR(ev.startDate)} au ${this.formatDateFR(ev.endDate)}</div>
        </div>
        <div>
          <button class="btn btn-sm btn-secondary" onclick="app.editHoliday('${ev.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="app.deleteHoliday('${ev.id}')">🗑</button>
        </div>
      </div>
    `).join('');
  }

  async editHoliday(id) {
    const ev=await db.get('calendar',id); if(!ev)return; await this.openModal('modal-holiday'); document.getElementById('holiday-id').value=ev.id; document.getElementById('holiday-title').value=ev.title; document.getElementById('holiday-type').value=ev.type; document.getElementById('holiday-start').value=ev.startDate; document.getElementById('holiday-end').value=ev.endDate;
  }

  async saveHoliday() {
    const id=document.getElementById('holiday-id')?.value||`hol_${Date.now()}`; const title=document.getElementById('holiday-title').value.trim(); const type=document.getElementById('holiday-type').value; const startDate=document.getElementById('holiday-start').value; const endDate=document.getElementById('holiday-end').value||startDate;
    if(!title||!startDate||endDate<startDate){alert('Veuillez vérifier l’intitulé et les dates.');return;}
    await db.put('calendar',{id,title,type,startDate,endDate}); this.closeModal('modal-holiday'); this.renderCalendarView(); this.showSaveIndicator();
  }

  async deleteHoliday(id) {
    if (confirm("Supprimer cet événement ?")) {
      await db.delete('calendar', id);
      this.renderCalendarView();
    }
  }


  // --- ACTIVITÉS ET COMPORTEMENT D'APPRENTISSAGE ---
  async getActivityConfig() {
    const categories = (await db.getAll('activityCategories')).filter(c => c.active !== false).sort((a,b) => (a.order||0)-(b.order||0));
    const actions = (await db.getAll('activityActions')).filter(a => a.active !== false).sort((a,b) => (a.order||0)-(b.order||0));
    return { categories, actions, maxScore: Number((await db.get('settings','activityMaxScore'))?.value || 20) };
  }

  async getStudentActivityScore(studentId) {
    const { maxScore } = await this.getActivityConfig();
    const events = (await db.getAll('activityEvents')).filter(e => e.studentId === studentId && !e.archivedAt);
    const deducted = events.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
    return Math.max(0, Math.min(maxScore, maxScore - deducted));
  }

  async renderActivitiesView() {
    const classes = await db.getAll('classes');
    const select = document.getElementById('activity-class-filter');
    if (!select) return;
    const current = select.value;
    select.innerHTML = classes.map(c=>`<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
    if (classes.some(c=>c.id===current)) select.value=current;
    const classId = select.value || classes[0]?.id;
    const search = (document.getElementById('activity-student-search')?.value || '').toLowerCase();
    const students = (await db.getAll('students')).filter(s=>s.classId===classId && !s.archived)
      .filter(s=>`${s.nom} ${s.prenom}`.toLowerCase().includes(search))
      .sort((a,b)=>{ const ao=Number.isFinite(Number(a.importOrder))?Number(a.importOrder):null; const bo=Number.isFinite(Number(b.importOrder))?Number(b.importOrder):null; if(ao!==null&&bo!==null&&ao!==bo)return ao-bo; if(ao!==null)return -1; if(bo!==null)return 1; return String(a.nom||'').localeCompare(String(b.nom||''),'fr',{sensitivity:'base'}) || String(a.prenom||'').localeCompare(String(b.prenom||''),'fr',{sensitivity:'base'}); });
    const {categories, actions, maxScore} = await this.getActivityConfig();
    const container = document.getElementById('activities-students-list');
    container.classList.toggle('activity-compact-mode', this.activityClassMode);
    container.innerHTML = '';
    if (!students.length) { container.innerHTML='<div class="card"><p style="text-align:center;">Aucun élève dans cette classe.</p></div>'; return; }

    // Un seul chargement des événements pour toute la classe : plus rapide sur iPhone/PC.
    const allEvents = await db.getAll('activityEvents');
    const activeEvents = allEvents.filter(e=>!e.archivedAt);

    for (const [idx, student] of students.entries()) {
      const events = activeEvents.filter(e=>e.studentId===student.id);
      const deducted = events.reduce((sum,e)=>sum + Number(e.penalty || 0),0);
      const score = Math.max(0, Math.min(maxScore, maxScore-deducted));
      const card=document.createElement('div');
      card.className=`activity-student-card ${this.activityClassMode ? 'activity-student-row' : ''}`;
      if (this.activityExpandedStudents.has(student.id)) card.classList.add('activity-student-expanded');
      card.dataset.studentId=student.id;
      const actionButtons = categories.map(cat=>{
        const catActions=actions.filter(a=>a.categoryId===cat.id);
        const catPenalty=events.filter(e=>e.categoryId===cat.id).reduce((sum,e)=>sum+Number(e.penalty||0),0);
        const remaining=Math.max(0,Number(cat.maxPoints||0)-catPenalty);
        const available = remaining > 1e-9;
        if (this.activityClassMode) {
          return `<div class="activity-row-category" data-category-id="${this.escapeHtml(cat.id)}">
            <span class="activity-row-category-label" title="${this.escapeHtml(cat.name)}">${cat.icon||'📌'} ${this.escapeHtml(cat.name)}</span>
            <div class="activity-row-actions">
              ${catActions.map(a=>{
                const disabled=!available || Number(a.penalty)>remaining+1e-9 || score<=0;
                return `<button class="activity-action-btn compact-action" data-action-id="${a.id}" ${disabled?'disabled':''} title="${this.escapeHtml(a.name)} — −${Number(a.penalty).toFixed(2)}" onclick="app.addActivityPenalty('${student.id}','${a.id}')"><span>${this.escapeHtml(a.name)}</span><b>−${Number(a.penalty).toFixed(2)}</b></button>`;
              }).join('')}
              ${catActions.length===0?'<span class="help-text">Aucune action</span>':''}
            </div>
          </div>`;
        }
        return `<div class="activity-category" data-category-id="${this.escapeHtml(cat.id)}">
          <div class="activity-category-title"><span>${cat.icon||'📌'} ${this.escapeHtml(cat.name)}</span>
            <span class="category-budget">−${catPenalty.toFixed(2)} / ${Number(cat.maxPoints||0)}</span></div>
          <div class="activity-actions">
            ${catActions.map(a=>{
              const disabled=!available || Number(a.penalty)>remaining+1e-9 || score<=0;
              return `<button class="activity-action-btn" ${disabled?'disabled':''} data-action-id="${a.id}" onclick="app.addActivityPenalty('${student.id}','${a.id}')">${this.escapeHtml(a.name)} <b>−${Number(a.penalty).toFixed(2)}</b></button>`;
            }).join('')}
            ${catActions.length===0?'<span class="help-text">Aucune action configurée.</span>':''}
          </div>
          <div class="activity-remaining">Reste : ${remaining.toFixed(2)} pt(s)</div>
        </div>`;
      }).join('');

      if (this.activityClassMode) {
        card.innerHTML=`
          <div class="activity-row-main activity-student-toggle" role="button" tabindex="0" onclick="app.toggleActivityStudent('${student.id}')" onkeydown="if(event.key==='Enter'||event.key===' ') app.toggleActivityStudent('${student.id}')">
            <div class="activity-row-number">${String(idx+1).padStart(2,'0')}</div>
            <div class="activity-row-name"><strong>${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</strong><span class="activity-event-count">${events.length} pénalité(s)</span></div>
            <div class="activity-score" aria-label="Note actuelle">${score.toFixed(2)}<span> / ${maxScore}</span></div>
            <button class="activity-row-history" title="Historique" onclick="app.showActivityHistory('${student.id}')">📋</button>
          </div>
          <div class="activity-row-actions-area activity-student-details">${actionButtons}</div>`;
      } else {
        card.innerHTML=`
          <div class="activity-student-head activity-student-toggle" role="button" tabindex="0" onclick="app.toggleActivityStudent('${student.id}')" onkeydown="if(event.key==='Enter'||event.key===' ') app.toggleActivityStudent('${student.id}')">
            <div class="activity-student-name"><strong>${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</strong><div class="activity-event-count">${events.length} pénalité(s)</div></div>
            <div class="activity-score" aria-label="Note actuelle">${score.toFixed(2)}<span> / ${maxScore}</span></div>
          </div>
          <div class="activity-categories activity-student-details">${actionButtons}</div>
          <div class="activity-card-actions activity-student-details">
            <button class="btn btn-sm btn-secondary" onclick="app.showActivityHistory('${student.id}')">📋 Historique</button>
            <button class="btn btn-sm btn-secondary" onclick="app.showStudentDetail('${student.id}')">👁 Fiche élève</button>
          </div>`;
      }
      container.appendChild(card);
    }
  }

  toggleActivityStudent(studentId) {
    if (this.activityExpandedStudents.has(studentId)) this.activityExpandedStudents.delete(studentId);
    else this.activityExpandedStudents.add(studentId);
    const card = document.querySelector(`.activity-student-card[data-student-id="${CSS.escape(studentId)}"]`);
    if (card) card.classList.toggle('activity-student-expanded', this.activityExpandedStudents.has(studentId));
  }

  toggleActivityClassMode() {
    this.activityClassMode = !this.activityClassMode;
    const btn = document.getElementById('activity-mode-toggle');
    if (btn) btn.innerHTML = this.activityClassMode ? '⚡ Mode cours' : '▦ Mode détaillé';
    this.renderActivitiesView();
  }

  async addActivityPenalty(studentId, actionId) {
    const action = await db.get('activityActions', actionId);
    const student = await db.get('students', studentId);
    if (!action || !student || action.active === false) return;
    const category = await db.get('activityCategories', action.categoryId);
    const events = (await db.getAll('activityEvents')).filter(e=>e.studentId===studentId && e.categoryId===action.categoryId && !e.archivedAt);
    const used = events.reduce((s,e)=>s+Number(e.penalty||0),0);
    const maxCat = Number(category?.maxPoints ?? 0);
    const penalty = Number(action.penalty || 0);
    if (maxCat > 0 && used + penalty > maxCat + 1e-9) {
      alert(`La limite de ${maxCat} points de cette catégorie est déjà atteinte.`);
      return;
    }
    const maxScore = Number((await db.get('settings','activityMaxScore'))?.value || 20);
    const current = await this.getStudentActivityScore(studentId);
    if (current <= 0) { alert('La note est déjà à 0/20.'); return; }
    const id=`acte_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await db.put('activityEvents',{id,studentId,categoryId:action.categoryId,actionId,penalty,date:this.getTodayISO(),createdAt:new Date().toISOString()});
    await this.registerChange();
    this.activityLastAction=id;
    await this.renderDashboard();
    this.showSaveIndicator();
    // Mise à jour instantanée de la carte concernée : pas de rechargement de toute la classe.
    const card = document.querySelector(`.activity-student-card[data-student-id="${CSS.escape(studentId)}"]`);
    if (card) {
      const scoreEl = card.querySelector('.activity-score');
      if (scoreEl) scoreEl.innerHTML = `${Math.max(0, current - penalty).toFixed(2)}<span> / ${maxScore}</span>`;
      const countEl = card.querySelector('.activity-event-count');
      if (countEl) countEl.textContent = `${events.length + 1} pénalité(s)`;
      const catEl = card.querySelector(`.activity-category[data-category-id="${CSS.escape(action.categoryId)}"], .activity-row-category[data-category-id="${CSS.escape(action.categoryId)}"]`);
      if (catEl) {
        const newUsed = used + penalty;
        const budgetEl = catEl.querySelector('.category-budget');
        if (budgetEl) budgetEl.textContent = `−${newUsed.toFixed(2)} / ${maxCat}`;
        const remainingEl = catEl.querySelector('.activity-remaining');
        if (remainingEl) remainingEl.textContent = `Reste : ${Math.max(0, maxCat - newUsed).toFixed(2)} pt(s)`;
        const remaining = Math.max(0, maxCat - newUsed);
        catEl.querySelectorAll('.activity-action-btn').forEach(btn => {
          const aId=btn.dataset.actionId;
          const actionPenalty = aId ? Number(btn.querySelector('b')?.textContent?.replace('−','')||0) : 0;
          btn.disabled = maxCat > 0 ? (remaining <= 1e-9 || actionPenalty > remaining + 1e-9) : false;
        });
      }
      card.classList.add('activity-card-updated');
      setTimeout(() => card.classList.remove('activity-card-updated'), 180);
    }
  }

  async showActivityHistory(studentId) {
    const student=await db.get('students',studentId); if(!student) return;
    const [events,cats,actions]=await Promise.all([db.getAll('activityEvents'),db.getAll('activityCategories'),db.getAll('activityActions')]);
    const rows=events.filter(e=>e.studentId===studentId && !e.archivedAt).sort((a,b)=>String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)));
    const score=await this.getStudentActivityScore(studentId);
    const modal=document.getElementById('modal-activity-history');
    document.getElementById('activity-history-title').innerText=`Historique — ${student.nom} ${student.prenom}`;
    document.getElementById('activity-history-content').innerHTML=`
      <div class="activity-history-score">Note actuelle : <b>${score.toFixed(2)} / 20</b></div>
      ${rows.length?`<div class="history-table-container"><table><thead><tr><th>Date</th><th>Catégorie</th><th>Action</th><th>−Points</th><th></th></tr></thead><tbody>
      ${rows.map(e=>{const c=cats.find(x=>x.id===e.categoryId);const a=actions.find(x=>x.id===e.actionId);return `<tr><td>${this.formatDateFR(e.date)}</td><td>${this.escapeHtml(c?.name||'')}</td><td>${this.escapeHtml(a?.name||'Action supprimée')}</td><td>−${Number(e.penalty).toFixed(2)}</td><td><button class="btn btn-sm btn-danger" onclick="app.deleteActivityEvent('${e.id}','${studentId}')">Annuler</button></td></tr>`}).join('')}
      </tbody></table></div>`:'<p class="help-text">Aucune pénalité enregistrée.</p>'}`;
    modal.classList.add('active');
  }

  async deleteActivityEvent(eventId,studentId) {
    if(!confirm('Annuler cette pénalité ?')) return;
    await db.delete('activityEvents',eventId);
    this.showActivityHistory(studentId);
    await this.renderActivitiesView();
    this.showSaveIndicator();
  }

  async renderActivitySettings() {
    const {categories,actions,maxScore}=await this.getActivityConfig();
    document.getElementById('activity-max-score').value=maxScore;
    document.getElementById('activity-categories-list').innerHTML=categories.map(c=>`
      <div class="config-item">
        <div><b>${c.icon||'📌'} ${this.escapeHtml(c.name)}</b><span class="help-text">Budget : ${Number(c.maxPoints||0)} pts</span></div>
        <div class="config-actions">
          <button class="btn btn-sm btn-secondary" onclick="app.editActivityCategory('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="app.deleteActivityCategory('${c.id}')">🗑</button>
        </div>
      </div>
      <div class="config-sublist">
        ${actions.filter(a=>a.categoryId===c.id).map(a=>{const isReward=a.type==='reward';const sign=isReward?'+':'−';const icon=isReward?'➕':'➖';return `<div class="config-subitem"><span>${icon} ${this.escapeHtml(a.name)} <b>${sign}${Number(a.penalty).toFixed(2)}</b></span><span><button class="btn btn-sm btn-secondary" onclick="app.editActivityAction('${a.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="app.deleteActivityAction('${a.id}')">🗑</button></span></div>`}).join('')}
        <button class="btn btn-sm btn-secondary" onclick="app.openActivityActionForm('', '${c.id}')">+ Ajouter une action</button>
      </div>`).join('');
  }

  async saveActivityMaxScore() {
    const value=Number(document.getElementById('activity-max-score').value);
    const categories=await db.getAll('activityCategories');
    const total=categories.filter(c=>c.active!==false).reduce((s,c)=>s+Number(c.maxPoints||0),0);
    if(!Number.isFinite(value)||value<=0){alert('La note maximale doit être supérieure à 0.');return;}
    if(total > value + 1e-9){alert(`La somme des budgets des catégories (${total}) dépasse la note maximale (${value}). Réduisez d'abord les budgets des catégories.`);return;}
    await db.put('settings',{key:'activityMaxScore',value});
    this.showSaveIndicator(); await this.renderActivitySettings(); await this.renderActivitiesView();
  }

  openActivityCategoryForm(id='') {
    const c=id ? null : null;
    document.getElementById('activity-category-id').value=id;
    document.getElementById('activity-category-name').value='';
    document.getElementById('activity-category-icon').value='📌';
    document.getElementById('activity-category-max').value='5';
    if(id) this.editActivityCategory(id); else document.getElementById('modal-activity-category').classList.add('active');
  }

  async editActivityCategory(id) {
    const c=await db.get('activityCategories',id); if(!c)return;
    document.getElementById('activity-category-id').value=c.id;
    document.getElementById('activity-category-name').value=c.name;
    document.getElementById('activity-category-icon').value=c.icon||'📌';
    document.getElementById('activity-category-max').value=c.maxPoints;
    document.getElementById('modal-activity-category').classList.add('active');
  }

  async saveActivityCategory() {
    const id=document.getElementById('activity-category-id').value||`actc_${Date.now()}`;
    const name=document.getElementById('activity-category-name').value.trim();
    const icon=document.getElementById('activity-category-icon').value.trim()||'📌';
    const maxPoints=Number(document.getElementById('activity-category-max').value);
    if(!name||!Number.isFinite(maxPoints)||maxPoints<0){alert('Veuillez saisir un nom et un budget valide.');return;}
    const old=await db.get('activityCategories',id);
    const all=await db.getAll('activityCategories');
    const maxScore=Number((await db.get('settings','activityMaxScore'))?.value || 20);
    const total=all.filter(c=>c.active!==false && c.id!==id).reduce((s,c)=>s+Number(c.maxPoints||0),0)+maxPoints;
    if(total > maxScore + 1e-9){alert(`La somme des budgets des catégories (${total}) dépasse la note maximale (${maxScore}).`);return;}
    const item={id,name,icon,maxPoints,order:old?.order??(all.length+1),active:true};
    await db.put('activityCategories',item);
    this.closeModal('modal-activity-category'); await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
  }

  async deleteActivityCategory(id) {
    if(!confirm('Supprimer cette catégorie des actions disponibles ? L’historique sera conservé.'))return;
    const c=await db.get('activityCategories',id); if(c){c.active=false;await db.put('activityCategories',c);}
    const actions=await db.getAll('activityActions');
    for(const a of actions.filter(x=>x.categoryId===id)){a.active=false;await db.put('activityActions',a);}
    await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
  }

  async openActivityActionForm(id='',categoryId='') {
    document.getElementById('activity-action-id').value=id;
    const cats=(await db.getAll('activityCategories')).filter(c=>c.active!==false);
    const sel=document.getElementById('activity-action-category');
    sel.innerHTML=cats.map(c=>`<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
    if(categoryId) sel.value=categoryId;
    document.getElementById('activity-action-name').value='';
    document.getElementById('activity-action-penalty').value='0.5';
    if(id){const a=await db.get('activityActions',id);if(a){sel.value=a.categoryId;document.getElementById('activity-action-name').value=a.name;document.getElementById('activity-action-penalty').value=a.penalty;}}
    document.getElementById('modal-activity-action').classList.add('active');
  }

  async editActivityAction(id){ await this.openActivityActionForm(id); }

  async saveActivityAction() {
    const id=document.getElementById('activity-action-id').value||`acta_${Date.now()}`;
    const categoryId=document.getElementById('activity-action-category').value;
    const name=document.getElementById('activity-action-name').value.trim();
    const penalty=Number(document.getElementById('activity-action-penalty').value);
    if(!categoryId||!name||!Number.isFinite(penalty)||penalty<=0){alert('Veuillez saisir une action et une pénalité positive.');return;}
    const old=await db.get('activityActions',id), all=await db.getAll('activityActions');
    await db.put('activityActions',{id,categoryId,name,penalty,order:old?.order??(all.length+1),active:true});
    this.closeModal('modal-activity-action'); await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
  }

  async deleteActivityAction(id) {
    if(!confirm('Supprimer cette action des boutons disponibles ? L’historique sera conservé.'))return;
    const a=await db.get('activityActions',id); if(a){a.active=false;await db.put('activityActions',a);}
    await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
  }

  async resetActivityPeriod() {
    if(!confirm('Commencer une nouvelle période ? Les pénalités actuelles seront archivées et les notes repartiront à la note maximale.')) return;
    const events=await db.getAll('activityEvents');
    const periodId=`${Date.now()}`;
    for(const e of events){e.period= e.period || '2026-2027'; e.archivedAt=new Date().toISOString(); await db.put('activityEvents',e);}
    // Les événements archivés ne doivent plus intervenir dans la note courante.
    await db.put('settings',{key:'activityCurrentPeriod',value:periodId});
    // Recréer la note courante par absence d'événements actifs : les anciens restent consultables.
    this.showSaveIndicator(); await this.renderActivitiesView();
  }

  async renderStudentActivityDetail(studentId) {
    if(!studentId) return;
    const student=await db.get('students',studentId); if(!student)return;
    const score=await this.getStudentActivityScore(studentId);
    const el=document.getElementById('student-activity-summary');
    if(el) el.innerHTML=`<div class="activity-score-large">${score.toFixed(2)} / 20</div>`;
  }

  // --- SAUVEGARDE, EXPORT & RESTAURATION ---
  async exportJSON() {
    const data = {
      classes: await db.getAll('classes'),
      students: await db.getAll('students'),
      timetable: await db.getAll('timetable'),
      attendance: await db.getAll('attendance'),
      calendar: await db.getAll('calendar'),
      sessions: await db.getAll('sessions'),
      activityCategories: await db.getAll('activityCategories'),
      activityActions: await db.getAll('activityActions'),
      activityEvents: await db.getAll('activityEvents'),
      settings: await db.getAll('settings'),
      schoolYears: await db.getAll('schoolYears'),
      schoolYear: this.activeSchoolYear
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gestion_classe_${this.activeSchoolYear.replace('/','_')}_${this.getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async getBackupData() {
    const data = {
      classes: await db.getAll('classes'),
      students: await db.getAll('students'),
      timetable: await db.getAll('timetable'),
      attendance: await db.getAll('attendance'),
      calendar: await db.getAll('calendar'),
      sessions: await db.getAll('sessions'),
      activityCategories: await db.getAll('activityCategories'),
      activityActions: await db.getAll('activityActions'),
      activityEvents: await db.getAll('activityEvents'),
      settings: await db.getAll('settings'),
      schoolYears: await db.getAll('schoolYears'),
      schoolYear: this.activeSchoolYear
    };
    return data;
  }

  downloadBackupData(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  normalizeName(value) {
    return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
  }

  async importJSON() {
    const input=document.getElementById('import-json-file'); if(!input.files.length){alert('Veuillez choisir un fichier JSON.');return;}
    try { const data=JSON.parse(await input.files[0].text()); if(data.schoolYear && data.schoolYear !== this.activeSchoolYear && !confirm(`Cette sauvegarde concerne ${data.schoolYear}, alors que l’année active est ${this.activeSchoolYear}.\n\nContinuer la restauration ?`)) return; if(!data.classes||!data.students||!data.timetable||!data.attendance||!data.calendar)throw new Error('Structure de sauvegarde incomplète.'); if(!confirm('La restauration remplacera les données actuelles. Continuer ?'))return;
      for(const store of ['classes','students','timetable','attendance','calendar','sessions','activityCategories','activityActions','activityEvents','settings']) if(db.db.objectStoreNames.contains(store)) await db.clearStore(store);
      for(const x of data.classes)await db.put('classes',x); for(const x of data.students)await db.put('students',x); for(const x of data.timetable)await db.put('timetable',x); for(const x of data.attendance)await db.put('attendance',x); for(const x of data.calendar)await db.put('calendar',x); for(const x of (data.sessions||[]))await db.put('sessions',x); for(const x of (data.activityCategories||[]))await db.put('activityCategories',x); for(const x of (data.activityActions||[]))await db.put('activityActions',x); for(const x of (data.activityEvents||[]))await db.put('activityEvents',x); for(const x of (data.settings||[]))await db.put('settings',x); for(const x of (data.schoolYears||[])) if(db.db.objectStoreNames.contains('schoolYears')) await db.put('schoolYears',x);
      alert('Restauration réussie.'); location.reload();
    } catch(e){alert('Erreur lors de la restauration : '+e.message);}
  }

  async mergeJSON() {
    const input=document.getElementById('import-json-file');
    if(!input.files.length){alert('Veuillez choisir un fichier JSON à fusionner.');return;}
    try {
      const incoming=JSON.parse(await input.files[0].text());
      if(incoming.schoolYear && incoming.schoolYear !== this.activeSchoolYear) { alert(`Impossible de fusionner : la sauvegarde concerne ${incoming.schoolYear}, tandis que le PC est sur ${this.activeSchoolYear}.\n\nChangez d’abord d’année scolaire ou utilisez une restauration.`); return; }
      if(!incoming.classes||!incoming.students||!incoming.timetable||!incoming.attendance||!incoming.calendar) throw new Error('Structure de sauvegarde incomplète.');
      if(!confirm('FUSION SÉCURISÉE\n\nLes anciennes données du PC seront conservées. Les nouvelles données seront ajoutées et les doublons ignorés.\n\nUne sauvegarde automatique des données actuelles du PC sera téléchargée avant la fusion. Continuer ?')) return;

      // 1) Sauvegarde de sécurité AVANT toute modification.
      const before=await this.getBackupData();
      this.downloadBackupData(before, `securite_avant_fusion_${this.getTodayISO()}.json`);

      const current={
        classes:await db.getAll('classes'), students:await db.getAll('students'), timetable:await db.getAll('timetable'),
        attendance:await db.getAll('attendance'), calendar:await db.getAll('calendar'), sessions:await db.getAll('sessions'),
        activityCategories:await db.getAll('activityCategories'), activityActions:await db.getAll('activityActions'),
        activityEvents:await db.getAll('activityEvents'), settings:await db.getAll('settings')
      };

      const classMap=new Map();
      for(const c of (incoming.classes||[])){
        let target=current.classes.find(x=>x.id===c.id) || current.classes.find(x=>this.normalizeName(x.name)===this.normalizeName(c.name));
        if(!target){ target={...c}; await db.put('classes',target); current.classes.push(target); }
        classMap.set(c.id,target.id);
      }

      // Les élèves sont rapprochés par classe + nom + prénom, et non par leur ID local.
      const studentMap=new Map();
      const nextOrderByClass=new Map();
      for(const s of current.students){
        const n=Number(s.importOrder); if(Number.isFinite(n)) nextOrderByClass.set(s.classId,Math.max(nextOrderByClass.get(s.classId)||0,n));
      }
      for(const s of (incoming.students||[])){
        const mappedClassId=classMap.get(s.classId)||s.classId;
        const key=(mappedClassId+'|'+this.normalizeName(s.nom)+'|'+this.normalizeName(s.prenom));
        let target=current.students.find(x=>(x.classId===mappedClassId)&&this.normalizeName(x.nom)===this.normalizeName(s.nom)&&this.normalizeName(x.prenom)===this.normalizeName(s.prenom));
        if(!target){
          const next=(nextOrderByClass.get(mappedClassId)||0)+1; nextOrderByClass.set(mappedClassId,next);
          target={...s,classId:mappedClassId,importOrder:next};
          await db.put('students',target); current.students.push(target);
        }
        studentMap.set(s.id,target.id);
      }

      // Créneaux : si l'ID existe déjà sur le PC, on garde la version PC.
      for(const c of (incoming.timetable||[])){ if(!current.timetable.some(x=>x.id===c.id)) await db.put('timetable',c); }

      // Calendrier et configuration : on conserve la configuration du PC si le même ID existe.
      for(const ev of (incoming.calendar||[])){ if(!current.calendar.some(x=>x.id===ev.id)) await db.put('calendar',ev); }
      for(const c of (incoming.activityCategories||[])){ if(!current.activityCategories.some(x=>x.id===c.id)) await db.put('activityCategories',c); }
      for(const a of (incoming.activityActions||[])){ if(!current.activityActions.some(x=>x.id===a.id)) await db.put('activityActions',a); }

      // Appels : on remappe les IDs locaux des élèves. Un même appel (date + élève + cours)
      // n'est ajouté qu'une fois, même si le fichier du téléphone est importé plusieurs fois.
      const attendanceKey=a=>`${a.date||''}|${studentMap.get(a.studentId)||a.studentId}|${a.courseId||''}|${a.classId?classMap.get(a.classId)||a.classId:''}`;
      const attKeys=new Set(current.attendance.map(attendanceKey));
      let attendanceAdded=0;
      for(const a of (incoming.attendance||[])){
        const x={...a,studentId:studentMap.get(a.studentId)||a.studentId,classId:a.classId?(classMap.get(a.classId)||a.classId):a.classId};
        const key=attendanceKey(x);
        if(!attKeys.has(key)){ await db.put('attendance',x); attKeys.add(key); attendanceAdded++; }
      }

      // Sessions : dédoublonnage par date + créneau + classe.
      const sessionKey=x=>`${x.date||''}|${x.courseId||''}|${x.classId?classMap.get(x.classId)||x.classId:''}`;
      const sessionKeys=new Set(current.sessions.map(sessionKey));
      for(const s of (incoming.sessions||[])){
        const x={...s,classId:s.classId?(classMap.get(s.classId)||s.classId):s.classId}; const key=sessionKey(x);
        if(!sessionKeys.has(key)){await db.put('sessions',x);sessionKeys.add(key);}
      }

      // Activités : les événements gardent leur ID d'origine. Cela permet de réimporter
      // le même fichier sans doubler les pénalités. Des événements distincts le même jour
      // restent possibles (utile lorsque plusieurs clics ont réellement été faits).
      const existingEventIds=new Set(current.activityEvents.map(e=>e.id));
      for(const e of (incoming.activityEvents||[])){
        if(existingEventIds.has(e.id)) continue;
        const x={...e,studentId:studentMap.get(e.studentId)||e.studentId};
        await db.put('activityEvents',x); existingEventIds.add(x.id);
      }

      // Les paramètres/profil du PC restent prioritaires. On ajoute seulement une clé absente.
      const existingSettingKeys=new Set(current.settings.map(s=>s.key));
      for(const s of (incoming.settings||[])){ if(!existingSettingKeys.has(s.key)){await db.put('settings',s);existingSettingKeys.add(s.key);} }

      input.value='';
      alert(`Fusion terminée avec succès.\n\n${attendanceAdded} nouvel(le)(s) appel(s) ajouté(s).\nLes anciennes données du PC ont été conservées.\n\nUne sauvegarde de sécurité a été téléchargée avant la fusion.`);
      location.reload();
    } catch(e){alert('Erreur lors de la fusion : '+e.message);}
  }

  csvEscape(value) { const str=String(value??''); return /[;"\n]/.test(str)?`"${str.replace(/"/g,'""')}"`:str; }

  async exportCSV(type) {
    const rows=[]; const attendance=await db.getAll('attendance'); const students=await db.getAll('students');
    if(type==='records'){ rows.push(['Date','Jour','Classe','Horaire','Élève','Statut']); const tt=await db.getAll('timetable'); for(const a of attendance.sort((x,y)=>y.date.localeCompare(x.date))){const st=students.find(s=>s.id===a.studentId);const c=tt.find(c=>c.id===a.courseId);rows.push([this.formatDateFR(a.date),this.getDayNameFR(this.getDayOfWeek(a.date)),a.classId,c?`${c.startTime} – ${c.endTime}`:'',st?`${st.nom} ${st.prenom}`:'Inconnu',a.status]);}}
    else if(type==='students_summary'){rows.push(['Élève','Classe','Nombre Absences','Nombre Retards','Total']);for(const st of students.filter(s=>!s.archived)){const r=attendance.filter(a=>a.studentId===st.id);const A=r.filter(x=>x.status==='A').length;const R=r.filter(x=>x.status==='R').length;rows.push([`${st.nom} ${st.prenom}`,st.classId,A,R,A+R]);}}
    else {rows.push(['Classe','Total Absences','Total Retards','Total Incidents']);const classes=await db.getAll('classes');for(const c of classes){const r=attendance.filter(a=>a.classId===c.id);const A=r.filter(x=>x.status==='A').length;const R=r.filter(x=>x.status==='R').length;rows.push([c.name,A,R,A+R]);}}
    const csv='\uFEFF'+rows.map(r=>r.map(v=>this.csvEscape(v)).join(';')).join('\n')+'\n'; const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`bilan_${type}_${this.getTodayISO()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async loadDemoData() {
    if (confirm("Charger les élèves de démonstration pour les 4 classes ?")) {
      const demoStudents = [
        // 3AC-12
        { id: 'demo_1', classId: '3AC-12', nom: 'ALAOUI', prenom: 'Ahmed', archived: false },
        { id: 'demo_2', classId: '3AC-12', nom: 'BENNANI', prenom: 'Yassine', archived: false },
        { id: 'demo_3', classId: '3AC-12', nom: 'EL AMRANI', prenom: 'Fatima', archived: false },
        { id: 'demo_4', classId: '3AC-12', nom: 'CHRAIBI', prenom: 'Omar', archived: false },
        // 2AC-12
        { id: 'demo_5', classId: '2AC-12', nom: 'IDRISSI', prenom: 'Ayoub', archived: false },
        { id: 'demo_6', classId: '2AC-12', nom: 'KHALIFI', prenom: 'Sanae', archived: false },
        // 3AC-13
        { id: 'demo_7', classId: '3AC-13', nom: 'TAZI', prenom: 'Mohamed', archived: false },
        { id: 'demo_8', classId: '3AC-13', nom: 'MOUHLI', prenom: 'Salma', archived: false },
        // 3AC-14
        { id: 'demo_9', classId: '3AC-14', nom: 'ZAIDI', prenom: 'Hamza', archived: false },
        { id: 'demo_10', classId: '3AC-14', nom: 'BERRADA', prenom: 'Lina', archived: false }
      ];

      for (let s of demoStudents) {
        await db.put('students', s);
      }
      alert("Élèves de démonstration créés avec succès !");
      location.reload();
    }
  }

  async clearAllData() {
    if (confirm("⚠️ ATTENTION : Voulez-vous vraiment effacer TOUTES les données ? Cette action est irréversible.")) {
      await db.clearStore('classes');
      await db.clearStore('students');
      await db.clearStore('timetable');
      await db.clearStore('attendance');
      await db.clearStore('calendar');
      if (db.db.objectStoreNames.contains('sessions')) await db.clearStore('sessions');
      if (db.db.objectStoreNames.contains('activityCategories')) await db.clearStore('activityCategories');
      if (db.db.objectStoreNames.contains('activityActions')) await db.clearStore('activityActions');
      if (db.db.objectStoreNames.contains('activityEvents')) await db.clearStore('activityEvents');
      await db.clearStore('settings');
      alert("Toutes les données ont été réinitialisées.");
      location.reload();
    }
  }
}


/* =========================
   v4.7 — Ergonomie enseignant
   ========================= */
(() => {
  const proto = AbsenceApp.prototype;

  // --- Dernière classe utilisée ---
  const _startRollcall_v47 = proto.startRollcall;
  proto.startRollcall = async function(courseId, classId, date, startTime, endTime) {
    await db.put('settings', {key:'lastClassId', value:classId});
    return _startRollcall_v47.call(this, courseId,classId,date,startTime,endTime);
  };

  // --- Appel : tous présents ---
  proto.setAllPresent = async function() {
    if (!this.activeCourse) return;
    const ids = Object.keys(this.rollcallState);
    for (const id of ids) {
      this.rollcallState[id] = null;
      await this.persistAttendanceRecord(id, null);
    }
    this.lastAction = null;
    const allStudents = await db.getAll('students');
    const students = allStudents.filter(s=>s.classId===this.activeCourse.classId && !s.archived);
    this.sortStudentsInDisplayOrder(students);
    this.renderRollcallList(students);
    this.updateCounters();
    document.getElementById('undo-container')?.classList.add('hidden');
    await this.renderDashboard();
    this.showSaveIndicator();
  };

  // --- Glisser élève : gauche=A, droite=R ---
  proto.bindRollcallGesturesV47 = function() {
    const list = document.getElementById('rollcall-students-list');
    if (!list || list.dataset.gesturesV47) return;
    list.dataset.gesturesV47='1';
    let startX=0,startY=0,activeRow=null;
    list.addEventListener('touchstart', e=>{
      const row=e.target.closest('.student-row');
      if(!row) return;
      activeRow=row; startX=e.changedTouches[0].clientX; startY=e.changedTouches[0].clientY;
    }, {passive:true});
    list.addEventListener('touchend', e=>{
      if(!activeRow) return;
      const dx=e.changedTouches[0].clientX-startX, dy=e.changedTouches[0].clientY-startY;
      const row=activeRow; activeRow=null;
      if(Math.abs(dx)<65 || Math.abs(dx)<Math.abs(dy)*1.2) return;
      const id=row.id.replace('student-row-','');
      const status=dx<0?'A':'R';
      row.classList.add(dx<0?'swipe-a':'swipe-r');
      setTimeout(()=>row.classList.remove('swipe-a','swipe-r'),180);
      this.toggleStatus(id,status);
    }, {passive:true});
  };

  const _renderRollcallList_v47 = proto.renderRollcallList;
  proto.renderRollcallList = function(students) {
    _renderRollcallList_v47.call(this,students);
    this.bindRollcallGesturesV47();
  };

  // --- Navigation des cours par glissement (zone haute, sans conflit avec les élèves) ---
  proto.bindCourseSwipeV47 = function() {
    const box=document.querySelector('#view-rollcall .rollcall-header-card');
    if(!box || box.dataset.courseSwipeV47) return;
    box.dataset.courseSwipeV47='1';
    let x=0,y=0;
    box.addEventListener('touchstart',e=>{x=e.changedTouches[0].clientX;y=e.changedTouches[0].clientY},{passive:true});
    box.addEventListener('touchend',e=>{
      const dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;
      if(Math.abs(dx)>70 && Math.abs(dx)>Math.abs(dy)*1.3) this.navigateCourse(dx<0?1:-1);
    },{passive:true});
  };

  // --- Mode cours intensif ---
  proto.toggleIntensiveMode = function() {
    const v=document.getElementById('view-rollcall');
    const on=v.classList.toggle('rollcall-intensive');
    const b=document.getElementById('btn-intensive-mode');
    if(b) b.textContent=on?'↩ Mode normal':'⚡ Cours intensif';
    localStorage.setItem('v47_intensive',on?'1':'0');
  };

  const _init_v47 = proto.init;
  proto.init = async function() {
    await _init_v47.call(this);
    const all=document.getElementById('btn-all-present');
    all?.addEventListener('click',()=>this.setAllPresent());
    document.getElementById('btn-intensive-mode')?.addEventListener('click',()=>this.toggleIntensiveMode());
    if(localStorage.getItem('v47_intensive')==='1') document.getElementById('view-rollcall')?.classList.add('rollcall-intensive');
    this.bindCourseSwipeV47();
  };

  const _navigateTo_v47 = proto.navigateTo;
  proto.navigateTo = async function(viewId) {
    const r=await _navigateTo_v47.call(this,viewId);
    if(viewId==='view-rollcall') this.bindCourseSwipeV47();
    return r;
  };

  // --- Classe mémorisée dans les sélecteurs principaux ---
  proto.applyLastClassToSelect = async function(id) {
    const last=(await db.get('settings','lastClassId'))?.value;
    const el=document.getElementById(id);
    if(el && last && [...el.options].some(o=>o.value===last)) el.value=last;
  };

  // --- Actions fréquentes 4–6 ---
  proto.getQuickActions = async function() {
    const saved=(await db.get('settings','quickActivityActions'))?.value;
    if(Array.isArray(saved) && saved.length) return saved.slice(0,6);
    const actions=(await db.getAll('activityActions')).filter(a=>a.active!==false);
    return actions.slice(0,5).map(a=>a.id);
  };
  proto.saveQuickActions = async function() {
    const ids=[...document.querySelectorAll('#quick-actions-config input[type=checkbox]:checked')].map(x=>x.value).slice(0,6);
    if(ids.length<4){alert('Choisissez au moins 4 actions fréquentes (et jusqu’à 6).');return;}
    await db.put('settings',{key:'quickActivityActions',value:ids});
    await this.renderActivitySettings();
    await this.renderActivitiesView();
    this.showSaveIndicator();
  };

  const _renderActivitySettings_v47=proto.renderActivitySettings;
  proto.renderActivitySettings=async function(){
    await _renderActivitySettings_v47.call(this);
    const box=document.getElementById('quick-actions-config'); if(!box)return;
    const actions=(await db.getAll('activityActions')).filter(a=>a.active!==false);
    const selected=await this.getQuickActions();
    box.innerHTML=`<b>⭐ Actions fréquentes</b><p class="help-text">Cochez 4 à 6 actions à afficher en priorité pendant le cours.</p>
      <div class="quick-actions-config-grid">${actions.map(a=>`<label class="quick-action-check"><input type="checkbox" value="${this.escapeHtml(a.id)}" ${selected.includes(a.id)?'checked':''}> ${a.type==='reward'?'➕':'➖'} ${this.escapeHtml(a.name)}</label>`).join('')}</div>
      <button class="btn btn-sm btn-primary" style="margin-top:8px" onclick="app.saveQuickActions()">Enregistrer les actions fréquentes</button>`;
  };

  // --- Récompenses : actions "+" avec points positifs, plafonnées à la note max ---
  const _openActivityActionForm_v47=proto.openActivityActionForm;
  proto.openActivityActionForm=async function(id='',categoryId=''){
    await _openActivityActionForm_v47.call(this,id,categoryId);
    const type=document.getElementById('activity-action-type');
    if(type){
      const a=id?await db.get('activityActions',id):null;
      type.value=a?.type==='reward'?'reward':'penalty';
    }
  };
  const _saveActivityAction_v47=proto.saveActivityAction;
  proto.saveActivityAction=async function(){
    const type=document.getElementById('activity-action-type')?.value||'penalty';
    const id=document.getElementById('activity-action-id').value||`acta_${Date.now()}`;
    const categoryId=document.getElementById('activity-action-category').value;
    const name=document.getElementById('activity-action-name').value.trim();
    const amount=Number(document.getElementById('activity-action-penalty').value);
    if(!categoryId||!name||!Number.isFinite(amount)||amount<=0){alert('Veuillez saisir une action et un nombre de points positif.');return;}
    const old=await db.get('activityActions',id), all=await db.getAll('activityActions');
    await db.put('activityActions',{id,categoryId,name,penalty:amount,type,order:old?.order??(all.length+1),active:true});
    this.closeModal('modal-activity-action'); await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
  };

  const _addActivityPenalty_v47=proto.addActivityPenalty;
  proto.addActivityPenalty=async function(studentId,actionId){
    const action=await db.get('activityActions',actionId);
    if(action?.type!=='reward') return _addActivityPenalty_v47.call(this,studentId,actionId);
    const student=await db.get('students',studentId); if(!action||!student||action.active===false)return;
    const maxScore=Number((await db.get('settings','activityMaxScore'))?.value||20);
    const current=await this.getStudentActivityScore(studentId);
    const reward=Number(action.penalty||0);
    if(current>=maxScore-1e-9){alert(`La note est déjà à ${maxScore}/${maxScore}.`);return;}
    const amount=Math.min(reward,maxScore-current);
    const id=`acte_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    await db.put('activityEvents',{id,studentId,categoryId:action.categoryId,actionId,penalty:-amount,date:this.getTodayISO(),createdAt:new Date().toISOString(),type:'reward'});
    await this.registerChange(); this.activityLastAction=id; this.showSaveIndicator();
    await this.renderActivitiesView(); await this.renderDashboard();
  };

  const _getScore_v47=proto.getStudentActivityScore;
  proto.getStudentActivityScore=async function(studentId){
    const {maxScore}=await this.getActivityConfig();
    const events=(await db.getAll('activityEvents')).filter(e=>e.studentId===studentId&&!e.archivedAt);
    const adjustment=events.reduce((sum,e)=>sum+Number(e.penalty||0),0);
    return Math.max(0,Math.min(maxScore,maxScore-adjustment));
  };

  // Affichage +/− après le rendu existant
  const _renderActivitiesView_v47=proto.renderActivitiesView;
  proto.renderActivitiesView=async function(){
    await _renderActivitiesView_v47.call(this);
    const selected=await this.getQuickActions();
    document.querySelectorAll('.activity-student-card').forEach(card=>{
      const old=card.querySelector('.quick-actions-bar'); if(old) old.remove();
      const bar=document.createElement('div'); bar.className='quick-actions-bar';
      selected.forEach(id=>{
        const a=window.__v47ActionsCache?.find(x=>x.id===id);
        if(!a || a.active===false)return;
        const b=document.createElement('button'); b.className='btn btn-secondary quick-action-btn activity-action-btn'+(a.type==='reward'?' reward-action':'');
        b.dataset.actionId=a.id; b.innerHTML=`${a.type==='reward'?'➕':'➖'} ${this.escapeHtml(a.name)} <b>${a.type==='reward'?'+':'−'}${Number(a.penalty).toFixed(2)}</b>`;
        b.onclick=()=>this.addActivityPenalty(card.dataset.studentId,a.id);
        bar.appendChild(b);
      });
      if(bar.children.length) card.prepend(bar);
      // Corrige aussi les boutons d'actions standards pour les récompenses.
      card.querySelectorAll('.activity-action-btn[data-action-id]').forEach(btn=>{
        const a=window.__v47ActionsCache?.find(x=>x.id===btn.dataset.actionId);
        if(!a)return;
        const sign=a.type==='reward'?'+':'−';
        btn.classList.toggle('reward-action',a.type==='reward');
        const b=btn.querySelector('b');
        if(b)b.textContent=`${sign}${Number(a.penalty).toFixed(2)}`;
        btn.title=`${a.name} — ${sign}${Number(a.penalty).toFixed(2)}`;
      });
    });
  };

  // Cache des actions pour les boutons rapides
  const _getQuickActions_v47=proto.getQuickActions;
  proto.getQuickActions=async function(){
    const ids=await _getQuickActions_v47.call(this);
    window.__v47ActionsCache=(await db.getAll('activityActions')).filter(a=>a.active!==false);
    return ids;
  };

  // Rendu de la liste de présence : indicateurs discrets
  const _renderTodayCourses_v47=proto.renderTodayCourses;
  proto.renderTodayCourses=async function(){
    await _renderTodayCourses_v47.call(this);
    document.querySelectorAll('.course-status-pill.pending').forEach(x=>x.textContent='● À faire');
    document.querySelectorAll('.course-status-pill.done').forEach(x=>x.textContent='✓ Fait');
  };

  // Résumé immédiat enrichi : dernier appel + prochain cours
  const _finishRollcall_v47=proto.finishRollcall;
  proto.finishRollcall=async function(){
    await _finishRollcall_v47.call(this);
    const card=document.getElementById('summary-details-card');
    if(card && this.activeCourse){
      const a=Object.values(this.rollcallState).filter(x=>x==='A').length;
      const r=Object.values(this.rollcallState).filter(x=>x==='R').length;
      const p=Object.keys(this.rollcallState).length-a-r;
      card.innerHTML += `<div class="summary-highlight"><b>Résumé immédiat</b><br>✓ ${p} présents · 🔴 ${a} absents · 🟠 ${r} retards</div>`;
    }
    await this.renderDashboard();
  };

  // Tableau de bord 4 blocs
  const _renderDashboard_v47=proto.renderDashboard;
  proto.renderDashboard=async function(){
    await _renderDashboard_v47.call(this);
    const today=this.getTodayISO();
    const courses=await this.getCoursesForDate(today);
    const sessions=await db.getAll('sessions');
    const last=[...sessions].filter(s=>s.completed).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
    const classes=await db.getAll('classes');
    const cls=id=>classes.find(c=>c.id===id)?.name||id||'—';
    const set=(id,html)=>{const e=document.getElementById(id);if(e)e.innerHTML=html};
    set('dash-today',`<h4>📅 Aujourd'hui</h4><div class="big">${courses.length} cours</div><div class="small">${today}</div>`);
    const alerts=document.getElementById('dashboard-alerts');
    const alertCount=alerts?.querySelectorAll('.alert-line').length||0;
    set('dash-alerts',`<h4>🚨 À surveiller</h4><div class="big">${alertCount}</div><div class="small">${alertCount?'élève(s)':'Rien à signaler'}</div>`);
    set('dash-last-call',last?`<h4>✓ Dernier appel</h4><div class="big">${cls(last.classId)}</div><div class="small">${this.formatDateFR(last.date)} · ${last.startTime}</div>`:`<h4>✓ Dernier appel</h4><div class="small">Aucun appel encore</div>`);
    const now=new Date().toTimeString().slice(0,5);
    const next=courses.find(c=>c.endTime>=now);
    set('dash-next-course',next?`<h4>⏭ Prochain cours</h4><div class="big">${cls(next.classId)}</div><div class="small">${next.startTime}–${next.endTime}</div>`:`<h4>⏭ Prochain cours</h4><div class="small">Aucun autre cours aujourd'hui</div>`);
  };
})();

const app = new AbsenceApp();
document.addEventListener('DOMContentLoaded', () => app.init());
