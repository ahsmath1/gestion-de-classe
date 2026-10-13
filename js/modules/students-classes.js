/** V7 — module métier : students-classes. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async getClassReminders(classId, date) {
      const rows = (await db.getAll('classReminders')).filter(r => r.classId === classId && r.schoolYear === this.activeSchoolYear && !r.completed);
      return rows.filter(r => !r.dueDate || r.dueDate <= date).sort((a,b) => String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
    },

  async getClassEvents(classId, date) {
      return (await db.getAll('classEvents'))
        .filter(e => e.classId === classId && e.schoolYear === this.activeSchoolYear && e.date <= date && e.visible !== false)
        .sort((a,b) => b.date.localeCompare(a.date) || (b.createdAt||0)-(a.createdAt||0));
    },

  async addClassReminder(classId, date) {
      const text = prompt(`Rappel pour ${classId} :`, '');
      if (!text?.trim()) return;
      const due = prompt('Date du rappel (AAAA-MM-JJ) :', date) || date;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) { this.showToast('Date invalide.','warning'); return; }
      await db.put('classReminders', { id:`rem_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, classId, text:text.trim(), dueDate:due, completed:false, schoolYear:this.activeSchoolYear, createdAt:Date.now() });
      await this.registerChange(); this.showSaveIndicator(); await this.renderTodayCourses();
    },

  async addClassEvent(classId, date, courseId) {
      const text = prompt(`Événement pour ${classId} — ${this.formatDateFR(date)} :`, '');
      if (!text?.trim()) return;
      const timetable = await db.getAll('timetable');
      const course = timetable.find(c => c.id === courseId);
      const sessionNumber = course ? this.getWeeklySessionNumber(course, timetable) : null;
      await db.put('classEvents', { id:`evt_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, classId, date, courseId:courseId||null, sessionNumber, text:text.trim(), visible:true, schoolYear:this.activeSchoolYear, createdAt:Date.now() });
      await this.registerChange(); this.showSaveIndicator(); await this.renderTodayCourses();
    },

  async completeClassReminder(id) {
      const r=await db.get('classReminders',id); if(!r)return;
      r.completed=true; r.completedAt=Date.now(); await db.put('classReminders',r); await this.registerChange(); this.showSaveIndicator(); await this.renderTodayCourses();
    },

  async renderStudentsList() {
      const classes = await db.getAll('classes');
      const selectFilter = document.getElementById('select-class-filter');
      
      // Remplir le selecteur de classe si vide
      if (selectFilter.children.length === 0) {
        selectFilter.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name)}</option>`).join('');
      }
  
      const selectedClassId = selectFilter.value || classes[0]?.id;
      const globalSearch = document.getElementById('search-student-global').value.toLowerCase();
  
      const allStudents = await db.getAll('students');
      const classActiveStudents = allStudents.filter(s => s.classId === selectedClassId && !s.archived);
      const groupFilter = document.getElementById('select-remediation-group-filter');
      if (groupFilter) {
        const previousGroup = groupFilter.value;
        const groups = [...new Set(classActiveStudents.map(s => String(s.remediationGroup || '').trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fr',{sensitivity:'base'}));
        groupFilter.innerHTML = `<option value="">Tous les groupes</option><option value="__unassigned__">Élèves non affectés</option>${groups.map(g=>`<option value="${this.escapeHtml(g)}">${this.escapeHtml(g)}</option>`).join('')}`;
        if ([...groupFilter.options].some(o => o.value === previousGroup)) groupFilter.value = previousGroup;
      }
      let filtered = classActiveStudents;
      const selectedGroup = groupFilter?.value || '';
      if (selectedGroup === '__unassigned__') filtered = filtered.filter(s => !String(s.remediationGroup || '').trim());
      else if (selectedGroup) filtered = filtered.filter(s => String(s.remediationGroup || '').trim() === selectedGroup);
      if (globalSearch) filtered = filtered.filter(s => `${s.nom} ${s.prenom}`.toLowerCase().includes(globalSearch));
  
      this.sortStudentsInDisplayOrder(filtered);
  
      const container = document.getElementById('students-manage-list');
      container.innerHTML = '';
  
      if (filtered.length === 0) {
        container.innerHTML = `<div class="card"><p style="text-align:center;">Aucun élève trouvé dans cette classe.</p></div>`;
        return;
      }
  
      const classOrder = this.sortStudentsInDisplayOrder(allStudents.filter(s => s.classId === selectedClassId && !s.archived));
      filtered.forEach((student, idx) => {
        const item = document.createElement('div');
        item.className = 'manage-item';
        const orderIndex = classOrder.findIndex(s => s.id === student.id);
        item.innerHTML = `
          <div>
            <strong>${idx + 1}. ${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</strong>
            <small style="display:block;color:var(--text-muted, #777)">Position dans la classe : ${orderIndex + 1}/${classOrder.length}</small>
            <small style="display:block;color:var(--text-muted, #777)">${student.remediationGroup ? `Groupe : ${this.escapeHtml(student.remediationGroup)}` : 'Groupe : non affecté'}</small>
          </div>
          <div class="student-row-actions">
            <button class="btn btn-sm btn-secondary" title="Monter l'élève" aria-label="Monter ${this.escapeHtml(student.nom)}" ${orderIndex<=0?'disabled':''} onclick="app.moveStudent('${this.escapeHtml(student.id)}',-1)">↑</button>
            <button class="btn btn-sm btn-secondary" title="Descendre l'élève" aria-label="Descendre ${this.escapeHtml(student.nom)}" ${orderIndex>=classOrder.length-1?'disabled':''} onclick="app.moveStudent('${this.escapeHtml(student.id)}',1)">↓</button>
            <button class="btn btn-sm btn-secondary" onclick="app.showStudentDetail('${this.escapeHtml(student.id)}')">👁 Fiche</button>
            <button class="btn btn-sm btn-secondary" onclick="app.editStudent('${this.escapeHtml(student.id)}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteStudent('${this.escapeHtml(student.id)}')">🗑</button>
          </div>
        `;
        container.appendChild(item);
      });
    },

  async moveStudent(studentId, direction) {
      const student = await db.get('students', studentId);
      if (!student || student.archived) return;
      const allStudents = await db.getAll('students');
      const classStudents = this.sortStudentsInDisplayOrder(allStudents.filter(s => s.classId === student.classId && !s.archived));
      const from = classStudents.findIndex(s => s.id === studentId);
      const to = from + Number(direction);
      if (from < 0 || to < 0 || to >= classStudents.length) return;
      [classStudents[from], classStudents[to]] = [classStudents[to], classStudents[from]];
      // Normaliser les positions pour que l'ordre soit stable après redémarrage,
      // importation et sauvegarde/restauration.
      for (let i = 0; i < classStudents.length; i++) {
        classStudents[i].importOrder = i + 1;
        await db.put('students', classStudents[i]);
      }
      await this.registerChange();
      await this.renderStudentsList();
      this.showSaveIndicator();
    },

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
    },

  async editStudent(studentId) {
      const student = await db.get('students', studentId);
      if (!student) return;
  
      await this.openModal('modal-student');
      document.getElementById('modal-student-title').innerText = "Modifier l'Élève";
      document.getElementById('student-id').value = student.id;
      document.getElementById('student-class-id').value = student.classId;
      document.getElementById('student-nom').value = student.nom;
      document.getElementById('student-prenom').value = student.prenom;
    },

  async deleteStudent(studentId) {
      if (confirm("Êtes-vous sûr de vouloir supprimer cet élève ? L'historique sera conservé.")) {
        const student = await db.get('students', studentId);
        student.archived = true; // Archivage sécurisé pour ne pas perdre les anciennes absences
        await db.put('students', student);
        this.renderStudentsList();
        this.showSaveIndicator();
      }
    },

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
    },

  async renderClassesManageList() {
      const classes = await db.getAll('classes');
      const container = document.getElementById('classes-list-manage');
      container.innerHTML = classes.map(c => `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span><strong>${this.escapeHtml(c.name)}</strong></span>
          <button class="btn btn-sm btn-secondary" onclick="app.duplicateClass('${c.id}')">📋 Dupliquer</button> <button class="btn btn-sm btn-danger" onclick="app.deleteClass('${c.id}')">Supprimer</button>
        </div>
      `).join('');
    },

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
    },

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
    },

  async duplicateClass(classId) {
      const source=await db.get('classes',classId); if(!source)return; const name=prompt(`Nom de la nouvelle classe à partir de ${source.name} :`,`${source.name}-copie`); if(!name)return; const clean=name.trim(); if(!clean)return; if(await db.get('classes',clean)){alert('Cette classe existe déjà.');return;}
      await db.put('classes',{id:clean,name:clean}); const students=await db.getAll('students'); const sourceStudents=students.filter(s=>s.classId===classId&&!s.archived); const copy=confirm(`Copier aussi les ${sourceStudents.length} élèves dans ${clean} ?`); if(copy){let order=0;for(const st of sourceStudents){order++;await db.put('students',{...st,id:`std_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,classId:clean,importOrder:order});}}
      await this.refreshClassSelectors(clean); await this.renderClassesManageList(); await this.renderStudentsList(); await this.registerChange(); this.showSaveIndicator(); alert(`Classe ${clean} créée${copy?' avec les élèves copiés':''}.`);
    },

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
    },

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
        <h3>${this.escapeHtml(student.nom)} ${this.escapeHtml(student.prenom)}</h3>
        <p><b>Classe :</b> ${student.classId}</p>
        <p><b>Année Scolaire :</b> 2026 / 2027</p>
        <div class="stats-summary-grid" style="margin-top:12px;">
          <div class="stat-card"><div class="stat-number" style="color:var(--accent-a);">${aCount}</div><div>Absences</div></div>
          <div class="stat-card"><div class="stat-number" style="color:var(--accent-r);">${rCount}</div><div>Retards</div></div>
          <div class="stat-card"><div class="stat-number">${aCount + rCount}</div><div>Total</div></div>
        </div>
        <div class="form-group" style="margin-top:14px;">
          <label for="student-remediation-group">Groupe de remédiation</label>
          <input class="form-control" id="student-remediation-group" maxlength="80" value="${this.escapeHtml(student.remediationGroup || '')}" placeholder="Ex. Groupe A — fractions, Groupe B — calcul..." />
          <small class="help-text">Le nom est libre : vous pouvez organiser les élèves par besoin d’apprentissage, compétence ou priorité.</small>
          <button class="btn btn-primary" style="margin-top:8px;min-height:40px;" onclick="app.saveStudentRemediationGroup('${this.escapeHtml(student.id)}')">💾 Enregistrer le groupe</button>
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
      await this.renderStudentActivityManager(studentId);
      this.navigateTo('view-student-detail');
    },

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
    },

  async saveStudentNotes() {
      if(!this.currentStudentDetailId)return; const st=await db.get('students',this.currentStudentDetailId); if(!st)return;
      st.observation=document.getElementById('student-observation')?.value.trim()||''; st.goal=document.getElementById('student-goal')?.value.trim()||''; await db.put('students',st); await this.registerChange(); this.showSaveIndicator(); alert('Suivi pédagogique enregistré.');
    },

  async saveStudentPractices(){
      if(!this.currentStudentDetailId)return; const st=await db.get('students',this.currentStudentDetailId); if(!st)return;
      const p=this.normalizePractices(st.pratiquesAttitudes); document.querySelectorAll('.practice-level-select').forEach(el=>{if(p[el.dataset.domain])p[el.dataset.domain].niveau=el.value;});
      document.querySelectorAll('.practice-check').forEach(label=>{const el=label.querySelector('input');const x=p[el.dataset.domain];if(!x)return;const arr=x[el.dataset.kind];const i=Number(el.dataset.index);if(el.checked&&!arr.includes(i))arr.push(i);if(!el.checked)x[el.dataset.kind]=arr.filter(v=>Number(v)!==i);});
      document.querySelectorAll('.practice-note').forEach(el=>{if(p[el.dataset.domain])p[el.dataset.domain].remarque=el.value.trim();});
      p.remarqueGenerale=document.getElementById('student-practices-general')?.value.trim()||''; st.pratiquesAttitudes=p; await db.put('students',st); await this.registerChange(); this.showSaveIndicator(); alert(this.language==='ar'?'تم حفظ الممارسات والمواقف.':'Pratiques et attitudes enregistrées.');
    },

  async saveStudentRemediationGroup(studentId) {
      const student = await db.get('students', studentId);
      if (!student) return;
      student.remediationGroup = document.getElementById('student-remediation-group')?.value.trim() || '';
      await db.put('students', student);
      await this.registerChange();
      this.showSaveIndicator();
      this.showToast(student.remediationGroup ? `Groupe « ${student.remediationGroup} » enregistré.` : 'Affectation au groupe supprimée.', 'success');
      await this.renderStudentsList();
    },

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
};
Object.assign(AbsenceApp.prototype, methods);
