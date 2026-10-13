/** V7 — module métier : attendance-schedule. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async getSchoolBounds() {
      const start = await db.get('settings', 'schoolStart');
      const end = await db.get('settings', 'schoolEnd');
      return { start: start?.value || '2026-09-07', end: end?.value || '2027-07-10' };
    },

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
    },

  async getCoursesForDate(isoDate) {
      if (await this.getDayStatus(isoDate)) return [];
      const day = this.getDayOfWeek(isoDate);
      const timetable = await db.getAll('timetable');
      return timetable.filter(c => c.day === day).sort((a,b) => a.startTime.localeCompare(b.startTime));
    },

  async checkDayStatus(isoDate) { return this.getDayStatus(isoDate); },

  getTeachingPhase(isoDate) {
      if (isoDate >= this.phase1Start && isoDate <= this.phase1End) {
        return { key:'remediation', label:'Phase 1 — Remédiation intensive' };
      }
      if (isoDate >= this.phase2Start) {
        return { key:'explicit', label:'Phase 2 — Enseignement explicite' };
      }
      return { key:'transition', label:'Période intermédiaire' };
    },

  getWeekMondayISO(isoDate) {
      const d = new Date(`${isoDate}T12:00:00`);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d.toISOString().slice(0,10);
    },

  getWeeklySessionNumber(course, allTimetable) {
      const sameClass = allTimetable
        .filter(c => c.classId === course.classId)
        .sort((a,b) => a.day - b.day || a.startTime.localeCompare(b.startTime));
      const idx = sameClass.findIndex(c => c.id === course.id);
      return idx >= 0 ? idx + 1 : null;
    },

  async renderTodayCourses() {
      const list = document.getElementById('today-courses-list'); const banner = document.getElementById('today-banner'); list.innerHTML='';
      const status = await this.getDayStatus(this.selectedDate);
      if (status) { banner.className=`status-banner ${status.type}`; banner.innerText=status.message; banner.classList.remove('hidden'); list.innerHTML='<div class="card"><p style="text-align:center;">Aucun appel disponible pour cette date.</p></div>'; return; }
      banner.classList.add('hidden');
      const courses = await this.getCoursesForDate(this.selectedDate);
      if (!courses.length) { list.innerHTML='<div class="card"><p style="text-align:center;">Aucun cours dans l’emploi du temps pour ce jour.</p></div>'; return; }
      const [sessions,timetable] = await Promise.all([db.getAll('sessions'), db.getAll('timetable')]);
      for (const course of courses) {
        const done = sessions.some(x=>x.date===this.selectedDate && x.courseId===course.id && x.completed);
        const sessionNumber=this.getWeeklySessionNumber(course,timetable);
        const reminders=await this.getClassReminders(course.classId,this.selectedDate);
        const events=await this.getClassEvents(course.classId,this.selectedDate);
        const recentEvents=events.slice(0,2);
        const card=document.createElement('div'); card.className='course-card';
        card.innerHTML=`<div class="course-main-info">
          <div class="course-time">🕒 ${course.startTime} – ${course.endTime}</div>
          <div class="course-class"><strong>${this.escapeHtml(String(course.classId).replace(/^(\d+)AC-(.+)$/,'$1-$2'))}</strong>${sessionNumber?` <span class="session-number">· S${sessionNumber}</span>`:''}</div>
          ${reminders.length?`<div class="course-reminders"><b>📌 Rappels</b>${reminders.map(r=>`<div class="class-reminder-line"><span>${this.escapeHtml(r.text)}</span><button class="mini-done" onclick="event.stopPropagation();app.completeClassReminder('${r.id}')" title="Terminer">✓</button></div>`).join('')}</div>`:''}
          ${recentEvents.length?`<div class="course-events"><b>📝 Événements visibles</b>${recentEvents.map(e=>`<div class="class-event-line"><span>${this.formatDateFR(e.date)}${e.sessionNumber?` · S${e.sessionNumber}`:''} — ${this.escapeHtml(e.text)}</span><button class="mini-event-action" onclick="event.stopPropagation();app.toggleClassEventVisibility('${e.id}')" title="Masquer cet événement">🙈</button></div>`).join('')}<button class="btn btn-sm btn-secondary event-journal-link" onclick="event.stopPropagation();app.navigateTo('view-calendar')">👁️ Gérer les événements</button></div>`:''}
          <div class="course-tools"><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();app.addClassReminder('${this.escapeHtml(course.classId)}','${this.selectedDate}')">📌 Rappel</button><button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();app.addClassEvent('${this.escapeHtml(course.classId)}','${this.selectedDate}','${this.escapeHtml(course.id)}')">📝 Événement</button></div>
        </div><div><span class="course-status-pill ${done?'done':'pending'}">${done?'✓ Effectué':'⏳ En attente'}</span></div>`;
        card.onclick=()=>this.startRollcall(course.id,course.classId,this.selectedDate,course.startTime,course.endTime); list.appendChild(card);
      }
    },

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
    },

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
          <div class="student-name">${String(idx + 1).padStart(2, '0')}. ${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</div>
          <div class="student-actions">
            <button class="btn-toggle btn-a ${status === 'A' ? 'active' : ''}" onclick="app.toggleStatus('${student.id}', 'A')">A</button>
            <button class="btn-toggle btn-r ${status === 'R' ? 'active' : ''}" onclick="app.toggleStatus('${student.id}', 'R')">R</button>
          </div>
        `;
        list.appendChild(row);
      });
    },

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
    },

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
    },

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
    },

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
    },

  async filterStudentsRollcall(query) {
      const allStudents = await db.getAll('students');
      const classStudents = allStudents.filter(s => s.classId === this.activeCourse.classId && !s.archived);
      const filtered = classStudents.filter(s => 
        `${s.nom} ${s.prenom}`.toLowerCase().includes(query.toLowerCase())
      );
      this.renderRollcallList(filtered);
    },

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
    },

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
      await this.registerChange();
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
    },

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
    },

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
    },

  async editCourse(id) {
      const c=await db.get('timetable',id); if(!c)return; await this.openModal('modal-course',true);
      document.getElementById('modal-course-title').innerText='Modifier le créneau'; document.getElementById('course-id').value=c.id; document.getElementById('course-class-id').value=c.classId; document.getElementById('course-day').value=String(c.day); document.getElementById('course-start-time').value=c.startTime; document.getElementById('course-end-time').value=c.endTime;
    },

  async saveCourse() {
      const id=document.getElementById('course-id').value||`course_${Date.now()}`; const classId=document.getElementById('course-class-id').value; const day=parseInt(document.getElementById('course-day').value,10); const startTime=document.getElementById('course-start-time').value; const endTime=document.getElementById('course-end-time').value;
      if(!classId||!startTime||!endTime||startTime>=endTime){alert('Veuillez vérifier la classe et les horaires.');return;}
      const all=await db.getAll('timetable'); const conflict=all.find(c=>c.id!==id&&c.day===day&&c.classId===classId&&startTime<c.endTime&&endTime>c.startTime); if(conflict){alert('Ce créneau chevauche déjà un autre cours de cette classe.');return;}
      await db.put('timetable',{id,classId,day,startTime,endTime}); this.closeModal('modal-course'); this.renderTimetableEditor(); this.showSaveIndicator();
    },

  async deleteCourse(id) {
      if (confirm("Supprimer ce créneau ?")) {
        await db.delete('timetable', id);
        this.renderTimetableEditor();
        this.showSaveIndicator();
      }
    }
};
Object.assign(AbsenceApp.prototype, methods);
