/** V7 — module métier : statistics-history. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
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
    },

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
};
Object.assign(AbsenceApp.prototype, methods);
