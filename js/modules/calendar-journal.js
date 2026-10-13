/** V7 — module métier : calendar-journal. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  setClassEventsFilter(filter) {
      document.querySelectorAll('[data-event-filter]').forEach(btn => btn.classList.toggle('active', btn.dataset.eventFilter === filter));
      const el = document.getElementById('class-events-filter');
      if (el) el.value = filter;
      this.renderClassEventsJournal();
    },

  async renderClassEventsJournal() {
      const container = document.getElementById('class-events-journal-list');
      const filter = document.getElementById('class-events-filter')?.value || 'all';
      const classFilter = document.getElementById('class-events-class-filter')?.value || 'all';
      if (!container) return;
      const events = (await db.getAll('classEvents'))
        .filter(e => e.schoolYear === this.activeSchoolYear)
        .filter(e => classFilter === 'all' || e.classId === classFilter)
        .filter(e => filter === 'all' || (filter === 'visible' ? e.visible !== false : e.visible === false))
        .sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt||0)-(a.createdAt||0));
      const allClasses = await db.getAll('classes');
      const classMap = new Map(allClasses.map(c => [c.id, c.name || c.id]));
      if (!events.length) {
        container.innerHTML = '<div class="card"><p class="help-text" style="text-align:center;">Aucun événement dans ce filtre.</p></div>';
        return;
      }
      container.innerHTML = events.map(e => {
        const visible = e.visible !== false;
        return `<div class="journal-event ${visible ? '' : 'is-hidden'}">
          <div class="journal-event-main">
            <div class="journal-event-meta"><strong>${this.escapeHtml(String(e.classId).replace(/^(\d+)AC-(.+)$/,'$1-$2'))}</strong> · ${this.formatDateFR(e.date)}${e.sessionNumber ? ` · S${e.sessionNumber}` : ''}${!visible ? ' · <span class="muted">Masqué</span>' : ''}</div>
            <div class="journal-event-text">${this.escapeHtml(e.text)}</div>
          </div>
          <div class="journal-event-actions">
            <button class="btn btn-sm btn-secondary" onclick="app.toggleClassEventVisibility('${e.id}')" title="${visible ? 'Masquer' : 'Afficher'}">${visible ? '🙈 Masquer' : '👁️ Afficher'}</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteClassEvent('${e.id}')" title="Supprimer définitivement">🗑️</button>
          </div>
        </div>`;
      }).join('');
    },

  async toggleClassEventVisibility(id) {
      const event = await db.get('classEvents', id);
      if (!event) return;
      event.visible = event.visible === false;
      await db.put('classEvents', event);
      await this.registerChange();
      this.showSaveIndicator();
      this.showToast(event.visible ? 'Événement réaffiché.' : 'Événement masqué.', 'success');
      await this.renderClassEventsJournal();
      await this.renderTodayCourses();
    },

  async deleteClassEvent(id) {
      const event = await db.get('classEvents', id);
      if (!event) return;
      if (!confirm(`Supprimer définitivement cet événement ?\n\n${event.text}`)) return;
      await db.delete('classEvents', id);
      await this.registerChange();
      this.showSaveIndicator();
      this.showToast('Événement supprimé définitivement.', 'success');
      await this.renderClassEventsJournal();
      await this.renderTodayCourses();
    },

  async initClassEventsJournalFilters() {
      const select = document.getElementById('class-events-class-filter');
      if (!select) return;
      const current = select.value || 'all';
      const classes = (await db.getAll('classes')).sort((a,b) => String(a.name||a.id).localeCompare(String(b.name||b.id),'fr'));
      select.innerHTML = '<option value="all">Toutes les classes</option>' + classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(String(c.id).replace(/^(\d+)AC-(.+)$/,'$1-$2'))}</option>`).join('');
      select.value = classes.some(c => c.id === current) ? current : 'all';
      await this.renderClassEventsJournal();
    },

  async renderCalendarView() {
      const calendar = await db.getAll('calendar');
      calendar.sort((a,b) => a.startDate.localeCompare(b.startDate));
  
      const container = document.getElementById('calendar-events-list');
      container.innerHTML = calendar.map(ev => `
        <div class="manage-item" style="margin-top:8px;">
          <div>
            <strong>${this.escapeHtml(ev.title)}</strong>
            <div>Du ${this.formatDateFR(ev.startDate)} au ${this.formatDateFR(ev.endDate)}</div>
          </div>
          <div>
            <button class="btn btn-sm btn-secondary" onclick="app.editHoliday('${ev.id}')">✏️</button> <button class="btn btn-sm btn-danger" onclick="app.deleteHoliday('${ev.id}')">🗑</button>
          </div>
        </div>
      `).join('');
    },

  async editHoliday(id) {
      const ev=await db.get('calendar',id); if(!ev)return; await this.openModal('modal-holiday'); document.getElementById('holiday-id').value=ev.id; document.getElementById('holiday-title').value=ev.title; document.getElementById('holiday-type').value=ev.type; document.getElementById('holiday-start').value=ev.startDate; document.getElementById('holiday-end').value=ev.endDate;
    },

  async saveHoliday() {
      const id=document.getElementById('holiday-id')?.value||`hol_${Date.now()}`; const title=document.getElementById('holiday-title').value.trim(); const type=document.getElementById('holiday-type').value; const startDate=document.getElementById('holiday-start').value; const endDate=document.getElementById('holiday-end').value||startDate;
      if(!title||!startDate||endDate<startDate){alert('Veuillez vérifier l’intitulé et les dates.');return;}
      await db.put('calendar',{id,title,type,startDate,endDate}); this.closeModal('modal-holiday'); this.renderCalendarView(); this.showSaveIndicator();
    },

  async deleteHoliday(id) {
      if (confirm("Supprimer cet événement ?")) {
        await db.delete('calendar', id);
        this.renderCalendarView();
      }
    }
};
Object.assign(AbsenceApp.prototype, methods);
