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
    this.activityClassMode = true; // Mode compact pour la saisie rapide pendant le cours
    this.language = 'fr';
  }

  async init() {
    await db.init();
    await this.loadLanguage();
    this.setupTheme();
    this.registerServiceWorker();
    this.bindEvents();
    this.updateCurrentDateDisplay();
    await this.renderProfile();
    await this.renderDashboard();

    // Premier lancement sur un nouvel appareil : aucun compte en ligne n'est créé.
    const configured = await db.get('settings', 'profileConfigured');
    if (!configured?.value) {
      setTimeout(() => this.showFirstSetup(), 250);
    }
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
    document.title = `${appName} 2026/2027`;
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
  }

  i18n = {
    fr: { subjectLabel:'Matière enseignée :', languageLabel:'Langue de l’application :', welcomeSubjectLabel:'Votre matière :', profilePrefix:'Profil :', profileNotConfigured:'Profil : non configuré', teacherOf:'Enseignant de', teacher:'Enseignant', teacherNotEntered:'Enseignant non renseigné', classesConfigured:'classe(s) configurée(s)', profileButton:'👤 Mon profil', startRollcall:"Lancer l'appel", todayCourses:'📅 Mes cours du jour', todayCoursesSub:"Saisie directe de l'appel", students:'👨‍🎓 Élèves', studentsSub:'Gestion et listes par classe', activities:'⭐ Activités & comportement', activitiesSub:'Notes sur 20 et pénalités en un clic', stats:'📊 Statistiques', statsSub:'Bilans et classements', history:'📋 Historique', historySub:'Recherche et modification', timetable:'⚙️ Emploi du temps', timetableSub:'Configuration des créneaux', calendar:'🗓 Calendrier', calendarSub:'Vacances et jours fériés', backup:'💾 Sauvegarde / Export', backupSub:'JSON, Excel et CSV', home:'← Accueil', todayTitle:'Cours du jour', today:"Aujourd'hui", studentsBack:'← Élèves', studentDetail:'Fiche Individuelle', activityDetail:'⭐ Activités et comportement', manageActivities:'Gérer les activités', attendanceHistory:'Historique de présence', configure:'⚙️ Configurer', newPeriod:'↻ Nouvelle période', courseMode:'⚡ Mode cours', statsTitle:'📊 Statistiques & Bilans', historyTitle:'📋 Historique des Appels', timetableTitle:'⚙️ Configuration Emploi du Temps', addCourse:'+ Ajouter un créneau', calendarTitle:'🗓 Calendrier Scolaire 2026/2027', addHoliday:'+ Ajouter Vacances / Férié / Exception', backupTitle:'💾 Sauvegarde & Exports', teacherProfile:'👤 Profil enseignant', editProfile:'Configurer / modifier mon profil', fullBackup:'💾 Sauvegarde Complète (JSON)', exportJson:'Exporter la sauvegarde JSON', restoreBackup:'↩ Restaurer une Sauvegarde', restoreData:'Restaurer les données', mergeBackup:'🔄 Fusionner une sauvegarde', mergeBackupHelp:'Ajoute les données du téléphone aux données du PC sans supprimer les anciennes données. Une sauvegarde automatique du PC sera téléchargée avant la fusion.', mergeData:'🔄 Fusionner avec les données actuelles', excelExport:'📊 Export Excel / CSV', printPdf:'🖨 Imprimer / Exporter en PDF', demoReset:'⚠️ Données de Démonstration & Réinitialisation', demoStudents:'Charger des Élèves de Démonstration', clearAll:'🗑 Effacer TOUTES les données', profileTitle:'👤 Mon profil enseignant', cancel:'Annuler', save:'Enregistrer', welcome:'👋 Bienvenue !', startSetup:'Commencer avec cette configuration', addStudent:'Ajouter un Élève', importStudents:"📥 Importer une liste d'élèves", startImport:"Lancer l'importation", manageClasses:'⚙️ Gérer les Classes', addClass:'Ajouter la classe', close:'Fermer', addCourseModal:'Ajouter un Créneau', addHolidayModal:'Ajouter des Vacances / Jour Férié', activityConfig:'⚙️ Configuration — Activités et comportement', saveMaxScore:'Enregistrer la note maximale', addCategory:'+ Ajouter une catégorie', addAction:'+ Ajouter une action', category:'Catégorie', actionPenalty:'Action / pénalité', activityHistory:'Historique', rollcallSaved:'APPEL ENREGISTRÉ', backToToday:'Retour aux cours du jour', searchStudent:'🔎 Rechercher un élève...', searchStudentByName:'🔎 Rechercher un élève par nom...', searchStudentName:'🔎 Nom ou prénom...', teacherNamePlaceholder:'ex. Ahmed EL ...'},
    ar: { subjectLabel:'المادة التي تدرسها:', languageLabel:'لغة التطبيق:', welcomeSubjectLabel:'المادة التي تدرسها:', profilePrefix:'الملف الشخصي:', profileNotConfigured:'الملف الشخصي: غير مُعد', teacherOf:'أستاذ مادة', teacher:'الأستاذ', teacherNotEntered:'اسم الأستاذ غير مُدخل', classesConfigured:'قسم(أقسام) مُعدّة', profileButton:'👤 ملفي الشخصي', startRollcall:'بدء تسجيل الحضور', todayCourses:'📅 حصصي اليوم', todayCoursesSub:'تسجيل الحضور مباشرة', students:'👨‍🎓 التلاميذ', studentsSub:'التدبير واللوائح حسب القسم', activities:'⭐ الأنشطة والسلوك', activitiesSub:'نقط من 20 وخصومات بنقرة واحدة', stats:'📊 الإحصائيات', statsSub:'الحصيلة والترتيب', history:'📋 السجل', historySub:'البحث والتعديل', timetable:'⚙️ استعمال الزمن', timetableSub:'إعداد الحصص', calendar:'🗓 التقويم', calendarSub:'العطل والأيام الرسمية', backup:'💾 النسخ والتصدير', backupSub:'JSON وExcel وCSV', home:'← الرئيسية', todayTitle:'حصص اليوم', today:'اليوم', studentsBack:'← التلاميذ', studentDetail:'بطاقة التلميذ', activityDetail:'⭐ الأنشطة والسلوك', manageActivities:'تدبير الأنشطة', attendanceHistory:'سجل الحضور', configure:'⚙️ الإعدادات', newPeriod:'↻ فترة جديدة', courseMode:'⚡ وضع الحصة', statsTitle:'📊 الإحصائيات والحصيلة', historyTitle:'📋 سجل الحضور', timetableTitle:'⚙️ إعداد استعمال الزمن', addCourse:'+ إضافة حصة', calendarTitle:'🗓 التقويم المدرسي 2026/2027', addHoliday:'+ إضافة عطلة / يوم رسمي / استثناء', backupTitle:'💾 النسخ والتصدير', teacherProfile:'👤 ملف الأستاذ', editProfile:'إعداد / تعديل ملفي', fullBackup:'💾 النسخ الاحتياطي الكامل (JSON)', exportJson:'تصدير النسخة الاحتياطية JSON', restoreBackup:'↩ استعادة نسخة احتياطية', restoreData:'استعادة البيانات', mergeBackup:'🔄 دمج نسخة احتياطية', mergeBackupHelp:'إضافة بيانات الهاتف إلى بيانات الحاسوب دون حذف البيانات القديمة. سيتم تنزيل نسخة احتياطية تلقائياً قبل الدمج.', mergeData:'🔄 دمج مع البيانات الحالية', excelExport:'📊 تصدير Excel / CSV', printPdf:'🖨 طباعة / تصدير PDF', demoReset:'⚠️ بيانات تجريبية وإعادة التهيئة', demoStudents:'تحميل تلاميذ تجريبيين', clearAll:'🗑 حذف جميع البيانات', profileTitle:'👤 ملف الأستاذ', cancel:'إلغاء', save:'حفظ', welcome:'👋 مرحباً!', startSetup:'بدء العمل بهذه الإعدادات', addStudent:'إضافة تلميذ', importStudents:'📥 استيراد لائحة التلاميذ', startImport:'بدء الاستيراد', manageClasses:'⚙️ تدبير الأقسام', addClass:'إضافة القسم', close:'إغلاق', addCourseModal:'إضافة حصة', addHolidayModal:'إضافة عطلة / يوم رسمي', activityConfig:'⚙️ إعدادات الأنشطة والسلوك', saveMaxScore:'حفظ النقطة القصوى', addCategory:'+ إضافة فئة', addAction:'+ إضافة إجراء', category:'الفئة', actionPenalty:'الإجراء / الخصم', activityHistory:'السجل', rollcallSaved:'تم تسجيل الحضور', backToToday:'العودة إلى حصص اليوم', searchStudent:'🔎 البحث عن تلميذ...', searchStudentByName:'🔎 البحث عن تلميذ بالاسم...', searchStudentName:'🔎 الاسم أو النسب...', teacherNamePlaceholder:'مثال: أحمد ...'}
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
    if (isoDate < start) return { type: 'info', message: '📚 Avant le début des cours 2026/2027' };
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

  updateCurrentDateDisplay() {
    const today = this.getTodayISO();
    const dayName = this.language === 'ar' ? this.getDayNameAR(this.getDayOfWeek(today)) : this.getDayNameFR(this.getDayOfWeek(today));
    document.getElementById('current-date-display').innerText = `${dayName} ${this.formatDateFR(today)}`;
  }

  // --- DASHBOARD LOGIC ---
  async renderDashboard() {
    const today = this.getTodayISO();
    const banner = document.getElementById('day-status-banner');
    const dayStatus = await this.getDayStatus(today);
    if (dayStatus) { banner.className = `status-banner ${dayStatus.type}`; banner.innerText = dayStatus.message; banner.classList.remove('hidden'); }
    else banner.classList.add('hidden');
    const info = document.getElementById('next-course-info');
    const btn = document.getElementById('btn-start-next-course');
    const courses = await this.getCoursesForDate(today);
    if (!courses.length) { info.innerText = dayStatus ? dayStatus.message : "Aucun cours programmé aujourd’hui"; btn.classList.add('hidden'); return; }
    const now = new Date().toTimeString().substring(0,5);
    const next = courses.find(c => c.endTime >= now);
    if (!next) { info.innerText = 'Tous les cours du jour sont terminés'; btn.classList.add('hidden'); return; }
    const label = now >= next.startTime && now <= next.endTime ? 'Cours en cours' : 'Prochain cours';
    info.innerText = `${label} : ${next.startTime} – ${next.endTime} | ${next.classId}`;
    btn.classList.remove('hidden'); btn.onclick = () => this.startRollcall(next.id, next.classId, today, next.startTime, next.endTime);
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
    alert(`${count} élève(s) importé(s).${skipped?` ${skipped} doublon(s) ignoré(s).`:''}`); input.value=''; this.closeModal('modal-import'); await this.renderStudentsList(); this.showSaveIndicator();
  }

  // --- CLASSES MANAGEMENT ---
  async renderClassesManageList() {
    const classes = await db.getAll('classes');
    const container = document.getElementById('classes-list-manage');
    container.innerHTML = classes.map(c => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <span><strong>${c.name}</strong></span>
        <button class="btn btn-sm btn-danger" onclick="app.deleteClass('${c.id}')">Supprimer</button>
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

    await db.put('classes', { id: name, name });
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

  async deleteClass(classId) {
    if (confirm(`Supprimer la classe ${classId} ?`)) {
      await db.delete('classes', classId);
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

    this.navigateTo('view-student-detail');
  }

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
    if (selectedPeriod === 'S1') allAttendance = allAttendance.filter(a => a.date >= '2026-09-07' && a.date <= '2027-01-31');
    if (selectedPeriod === 'S2') allAttendance = allAttendance.filter(a => a.date >= '2027-02-01' && a.date <= '2027-06-30');

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
          <div class="activity-row-main">
            <div class="activity-row-number">${String(idx+1).padStart(2,'0')}</div>
            <div class="activity-row-name"><strong>${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</strong><span class="activity-event-count">${events.length} pénalité(s)</span></div>
            <div class="activity-score" aria-label="Note actuelle">${score.toFixed(2)}<span> / ${maxScore}</span></div>
            <button class="activity-row-history" title="Historique" onclick="app.showActivityHistory('${student.id}')">📋</button>
          </div>
          <div class="activity-row-actions-area">${actionButtons}</div>`;
      } else {
        card.innerHTML=`
          <div class="activity-student-head">
            <div class="activity-student-name"><strong>${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</strong><div class="activity-event-count">${events.length} pénalité(s)</div></div>
            <div class="activity-score" aria-label="Note actuelle">${score.toFixed(2)}<span> / ${maxScore}</span></div>
          </div>
          <div class="activity-categories">${actionButtons}</div>
          <div class="activity-card-actions">
            <button class="btn btn-sm btn-secondary" onclick="app.showActivityHistory('${student.id}')">📋 Historique</button>
            <button class="btn btn-sm btn-secondary" onclick="app.showStudentDetail('${student.id}')">👁 Fiche élève</button>
          </div>`;
      }
      container.appendChild(card);
    }
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
    this.activityLastAction=id;
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
        ${actions.filter(a=>a.categoryId===c.id).map(a=>`<div class="config-subitem"><span>${this.escapeHtml(a.name)} <b>−${Number(a.penalty).toFixed(2)}</b></span><span><button class="btn btn-sm btn-secondary" onclick="app.editActivityAction('${a.id}')">✏️</button><button class="btn btn-sm btn-danger" onclick="app.deleteActivityAction('${a.id}')">🗑</button></span></div>`).join('')}
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
      settings: await db.getAll('settings')
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absences_2026_2027_${this.getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async getBackupData() {
    return {
      classes: await db.getAll('classes'),
      students: await db.getAll('students'),
      timetable: await db.getAll('timetable'),
      attendance: await db.getAll('attendance'),
      calendar: await db.getAll('calendar'),
      sessions: await db.getAll('sessions'),
      activityCategories: await db.getAll('activityCategories'),
      activityActions: await db.getAll('activityActions'),
      activityEvents: await db.getAll('activityEvents'),
      settings: await db.getAll('settings')
    };
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
    try { const data=JSON.parse(await input.files[0].text()); if(!data.classes||!data.students||!data.timetable||!data.attendance||!data.calendar)throw new Error('Structure de sauvegarde incomplète.'); if(!confirm('La restauration remplacera les données actuelles. Continuer ?'))return;
      for(const store of ['classes','students','timetable','attendance','calendar','sessions','activityCategories','activityActions','activityEvents','settings']) if(db.db.objectStoreNames.contains(store)) await db.clearStore(store);
      for(const x of data.classes)await db.put('classes',x); for(const x of data.students)await db.put('students',x); for(const x of data.timetable)await db.put('timetable',x); for(const x of data.attendance)await db.put('attendance',x); for(const x of data.calendar)await db.put('calendar',x); for(const x of (data.sessions||[]))await db.put('sessions',x); for(const x of (data.activityCategories||[]))await db.put('activityCategories',x); for(const x of (data.activityActions||[]))await db.put('activityActions',x); for(const x of (data.activityEvents||[]))await db.put('activityEvents',x); for(const x of (data.settings||[]))await db.put('settings',x);
      alert('Restauration réussie.'); location.reload();
    } catch(e){alert('Erreur lors de la restauration : '+e.message);}
  }

  async mergeJSON() {
    const input=document.getElementById('import-json-file');
    if(!input.files.length){alert('Veuillez choisir un fichier JSON à fusionner.');return;}
    try {
      const incoming=JSON.parse(await input.files[0].text());
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

const app = new AbsenceApp();
document.addEventListener('DOMContentLoaded', () => app.init());
