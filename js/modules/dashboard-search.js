/** V7 — module métier : dashboard-search. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async openGlobalSearch() {
      await this.openModal('modal-global-search'); const input=document.getElementById('global-search-input'); if(input){input.value=''; input.focus();}
      this.renderGlobalSearch('');
    },

  async renderGlobalSearch(q) {
      const box=document.getElementById('global-search-results'); if(!box)return; q=(q||'').trim().toLowerCase();
      if(q.length<2){box.innerHTML='<p class="help-text">Tapez au moins 2 caractères.</p>';return;}
      const [classes,students]=await Promise.all([db.getAll('classes'),db.getAll('students')]);
      const cs=classes.filter(c=>(c.name||'').toLowerCase().includes(q)).slice(0,8);
      const ss=students.filter(s=>!s.archived&&`${s.nom||''} ${s.prenom||''}`.toLowerCase().includes(q)).slice(0,12);
      box.innerHTML=[cs.length?'<h4>Classes</h4>'+cs.map(c=>`<div class="global-result"><button onclick="app.closeModal('modal-global-search');app.navigateTo('view-students');setTimeout(()=>{const s=document.getElementById('select-class-filter');if(s){s.value='${this.escapeHtml(c.id)}';app.renderStudentsList();}},50)">📚 ${this.escapeHtml(c.name)}</button></div>`).join(''):'', ss.length?'<h4>Élèves</h4>'+ss.map(s=>`<button class="global-result single" onclick="app.closeModal('modal-global-search');app.showStudentDetail('${this.escapeHtml(s.id)}')">👤 ${this.escapeHtml(s.nom)} ${this.escapeHtml(s.prenom)}</button>`).join(''):''].join('') || '<p class="help-text">Aucun résultat.</p>';
    },

  updateCurrentDateDisplay() {
      const today = this.getTodayISO();
      const dayName = this.language === 'ar' ? this.getDayNameAR(this.getDayOfWeek(today)) : this.getDayNameFR(this.getDayOfWeek(today));
      document.getElementById('current-date-display').innerText = `${dayName} ${this.formatDateFR(today)}`;
    },

  async renderDashboard() {
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
};
Object.assign(AbsenceApp.prototype, methods);
