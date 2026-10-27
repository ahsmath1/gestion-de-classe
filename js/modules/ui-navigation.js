/** V7 — module métier : ui-navigation. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
      }[ch]));
    },

  getTodayISO() {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

  dateFromISO(isoStr) {
      const [y, m, d] = isoStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    },

  addDaysISO(isoStr, delta) {
      const d = this.dateFromISO(isoStr);
      d.setDate(d.getDate() + delta);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    },

  formatDateFR(isoStr) {
      if (!isoStr) return '';
      const parts = isoStr.split('-');
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    },

  getDayOfWeek(isoStr) { return this.dateFromISO(isoStr).getDay(); },

  getDayNameAR(dayNum) { return ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'][dayNum] || ''; },

  getDayNameFR(dayNum) {
      const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
      return days[dayNum];
    },

  showSaveIndicator() {
      const el = document.getElementById('save-indicator');
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      el.innerText = `✓ Sauvegardé à ${timeStr}`;
      el.classList.add('active');
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => el.classList.remove('active'), 2500);
    },

  showToast(message, type='success', duration=2200) {
      let host = document.getElementById('toast-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'toast-host';
        host.setAttribute('aria-live','polite');
        document.body.appendChild(host);
      }
      const toast = document.createElement('div');
      toast.className = `app-toast app-toast-${type}`;
      toast.textContent = message;
      host.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('show'));
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 220); }, duration);
    },

  navigateTo(viewId) {
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      document.getElementById(viewId).classList.add('active');
      this.currentView = viewId;
      document.querySelectorAll(".bottom-nav [data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===viewId));
      window.scrollTo(0, 0);
  
      if (viewId === 'view-today') this.renderTodayCourses();
      if (viewId === 'view-progression') this.renderProgression();
      if (viewId === 'view-students') this.renderStudentsList();
      if (viewId === 'view-stats') this.renderStats();
      if (viewId === 'view-history') this.renderHistory();
      if (viewId === 'view-timetable') this.renderTimetableEditor();
      if (viewId === 'view-calendar') { this.renderCalendarView(); this.initClassEventsJournalFilters(); }
      if (viewId === 'view-activities') this.renderActivitiesView();
      if (viewId === 'view-student-detail') this.renderStudentActivityDetail(this.activityStudentId);
    },

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
    },

  async quickExpressCall() {
      const courses=await this.getCoursesForDate(this.selectedDate); const sessions=await db.getAll('sessions');
      const pending=courses.filter(c=>!sessions.some(s=>s.date===this.selectedDate&&s.courseId===c.id&&s.completed));
      if(pending.length===1){const c=pending[0]; return this.startRollcall(c.id,c.classId,this.selectedDate,c.startTime,c.endTime);}
      await this.navigateTo('view-today');
      if(pending.length>1){const list=document.getElementById('today-courses-list'); list?.classList.add('quick-attention'); setTimeout(()=>list?.classList.remove('quick-attention'),1000);}
    },

  async openModal(modalId, preserveCourse = false) {
      if (modalId === 'modal-student') {
        const classes = await db.getAll('classes');
        const select = document.getElementById('student-class-id');
        select.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
        document.getElementById('student-id').value = '';
        document.getElementById('student-nom').value = '';
        document.getElementById('student-prenom').value = '';
        document.getElementById('modal-student-title').innerText = "Ajouter un Élève";
      }
  
      if (modalId === 'modal-import') {
        const classes = await db.getAll('classes');
        const select = document.getElementById('import-class-id');
        select.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
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
        select.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
        if (!preserveCourse) { document.getElementById('course-id').value=''; document.getElementById('modal-course-title').innerText='Ajouter un Créneau'; document.getElementById('course-day').value='1'; document.getElementById('course-start-time').value='08:30'; document.getElementById('course-end-time').value='09:30'; }
      }
  
      document.getElementById(modalId).classList.add('active');
    },

  closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
    }
};
Object.assign(AbsenceApp.prototype, methods);
