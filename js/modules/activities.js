/** V7 — module métier : activities. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async getActivityConfig() {
      const categories = (await db.getAll('activityCategories')).filter(c => c.active !== false).sort((a,b) => (a.order||0)-(b.order||0));
      const actions = (await db.getAll('activityActions')).filter(a => a.active !== false).sort((a,b) => (a.order||0)-(b.order||0));
      return { categories, actions, maxScore: Number((await db.get('settings','activityMaxScore'))?.value || 20) };
    },

  async getStudentActivityScore(studentId) {
      const { maxScore } = await this.getActivityConfig();
      const events = (await db.getAll('activityEvents')).filter(e => e.studentId === studentId && !e.archivedAt);
      const deducted = events.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
      return Math.max(0, Math.min(maxScore, maxScore - deducted));
    },

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
    },

  toggleActivityStudent(studentId) {
      if (this.activityExpandedStudents.has(studentId)) this.activityExpandedStudents.delete(studentId);
      else this.activityExpandedStudents.add(studentId);
      const card = document.querySelector(`.activity-student-card[data-student-id="${CSS.escape(studentId)}"]`);
      if (card) card.classList.toggle('activity-student-expanded', this.activityExpandedStudents.has(studentId));
    },

  toggleActivityClassMode() {
      this.activityClassMode = !this.activityClassMode;
      const btn = document.getElementById('activity-mode-toggle');
      if (btn) btn.innerHTML = this.activityClassMode ? '⚡ Mode cours' : '▦ Mode détaillé';
      this.renderActivitiesView();
    },

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
      if (this.currentStudentDetailId === studentId) await this.renderStudentActivityManager(studentId);
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
    },

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
    },

  async deleteActivityEvent(eventId,studentId) {
      if(!confirm('Annuler cette pénalité ?')) return;
      await db.delete('activityEvents',eventId);
      this.showActivityHistory(studentId);
      if (this.currentStudentDetailId === studentId) await this.renderStudentActivityManager(studentId);
      await this.renderActivitiesView();
      this.showSaveIndicator();
    },

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
    },

  async saveActivityMaxScore() {
      const value=Number(document.getElementById('activity-max-score').value);
      const categories=await db.getAll('activityCategories');
      const total=categories.filter(c=>c.active!==false).reduce((s,c)=>s+Number(c.maxPoints||0),0);
      if(!Number.isFinite(value)||value<=0){alert('La note maximale doit être supérieure à 0.');return;}
      if(total > value + 1e-9){alert(`La somme des budgets des catégories (${total}) dépasse la note maximale (${value}). Réduisez d'abord les budgets des catégories.`);return;}
      await db.put('settings',{key:'activityMaxScore',value});
      this.showSaveIndicator(); await this.renderActivitySettings(); await this.renderActivitiesView();
    },

  openActivityCategoryForm(id='') {
      const c=id ? null : null;
      document.getElementById('activity-category-id').value=id;
      document.getElementById('activity-category-name').value='';
      document.getElementById('activity-category-icon').value='📌';
      document.getElementById('activity-category-max').value='5';
      if(id) this.editActivityCategory(id); else document.getElementById('modal-activity-category').classList.add('active');
    },

  async editActivityCategory(id) {
      const c=await db.get('activityCategories',id); if(!c)return;
      document.getElementById('activity-category-id').value=c.id;
      document.getElementById('activity-category-name').value=c.name;
      document.getElementById('activity-category-icon').value=c.icon||'📌';
      document.getElementById('activity-category-max').value=c.maxPoints;
      document.getElementById('modal-activity-category').classList.add('active');
    },

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
    },

  async deleteActivityCategory(id) {
      if(!confirm('Supprimer cette catégorie des actions disponibles ? L’historique sera conservé.'))return;
      const c=await db.get('activityCategories',id); if(c){c.active=false;await db.put('activityCategories',c);}
      const actions=await db.getAll('activityActions');
      for(const a of actions.filter(x=>x.categoryId===id)){a.active=false;await db.put('activityActions',a);}
      await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
    },

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
    },

  async editActivityAction(id){ await this.openActivityActionForm(id); },

  async saveActivityAction() {
      const id=document.getElementById('activity-action-id').value||`acta_${Date.now()}`;
      const categoryId=document.getElementById('activity-action-category').value;
      const name=document.getElementById('activity-action-name').value.trim();
      const penalty=Number(document.getElementById('activity-action-penalty').value);
      if(!categoryId||!name||!Number.isFinite(penalty)||penalty<=0){alert('Veuillez saisir une action et une pénalité positive.');return;}
      const old=await db.get('activityActions',id), all=await db.getAll('activityActions');
      await db.put('activityActions',{id,categoryId,name,penalty,order:old?.order??(all.length+1),active:true});
      this.closeModal('modal-activity-action'); await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
    },

  async deleteActivityAction(id) {
      if(!confirm('Supprimer cette action des boutons disponibles ? L’historique sera conservé.'))return;
      const a=await db.get('activityActions',id); if(a){a.active=false;await db.put('activityActions',a);}
      await this.renderActivitySettings(); await this.renderActivitiesView(); this.showSaveIndicator();
    },

  async resetActivityPeriod() {
      if(!confirm('Commencer une nouvelle période ? Les pénalités actuelles seront archivées et les notes repartiront à la note maximale.')) return;
      const events=await db.getAll('activityEvents');
      const periodId=`${Date.now()}`;
      for(const e of events){e.period= e.period || '2026-2027'; e.archivedAt=new Date().toISOString(); await db.put('activityEvents',e);}
      // Les événements archivés ne doivent plus intervenir dans la note courante.
      await db.put('settings',{key:'activityCurrentPeriod',value:periodId});
      // Recréer la note courante par absence d'événements actifs : les anciens restent consultables.
      this.showSaveIndicator(); await this.renderActivitiesView();
    },

  async renderStudentActivityManager(studentId) {
      const container = document.getElementById('student-activity-manager');
      if (!container || !studentId) return;
      const student = await db.get('students', studentId);
      if (!student) return;
  
      const {categories, actions, maxScore} = await this.getActivityConfig();
      const allEvents = await db.getAll('activityEvents');
      const events = allEvents.filter(e => e.studentId === studentId && !e.archivedAt);
      const adjustment = events.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
      const score = Math.max(0, Math.min(maxScore, maxScore - adjustment));
  
      const counts = events.length;
      const rewardCount = events.filter(e => Number(e.penalty || 0) < 0).length;
      const penaltyCount = events.filter(e => Number(e.penalty || 0) > 0).length;
  
      const actionButton = (a, scoreNow, remaining) => {
        const isReward = a.type === 'reward';
        const amount = Number(a.penalty || 0);
        const disabled = isReward
          ? scoreNow >= maxScore - 1e-9
          : (scoreNow <= 0 || (remaining > 0 && amount > remaining + 1e-9) || remaining <= 1e-9);
        return `<button class="btn btn-sm activity-action-btn ${isReward ? 'reward-action' : ''}"
          data-action-id="${this.escapeHtml(a.id)}" ${disabled ? 'disabled' : ''}
          onclick="app.addActivityPenalty('${this.escapeHtml(studentId)}','${this.escapeHtml(a.id)}')">
          ${isReward ? '➕' : '➖'} ${this.escapeHtml(a.name)}
          <b>${isReward ? '+' : '−'}${amount.toFixed(2)}</b>
        </button>`;
      };
  
      container.innerHTML = `
        <div class="student-activity-manager">
          <div class="student-activity-score-line">
            <div><span class="help-text">Note actuelle</span><strong>${score.toFixed(2)} / ${maxScore}</strong></div>
            <div class="student-activity-event-count">${counts} événement${counts > 1 ? 's' : ''} · ${penaltyCount} pénalité${penaltyCount > 1 ? 's' : ''} · ${rewardCount} récompense${rewardCount > 1 ? 's' : ''}</div>
            <button class="btn btn-sm btn-secondary" onclick="app.showActivityHistory('${this.escapeHtml(studentId)}')">📋 Historique</button>
          </div>
          ${categories.map(cat => {
            const catEvents = events.filter(e => e.categoryId === cat.id);
            const catAdjustment = catEvents.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
            const remaining = Math.max(0, Number(cat.maxPoints || 0) - catAdjustment);
            const catActions = actions.filter(a => a.categoryId === cat.id);
            return `<div class="student-activity-category">
              <div class="student-activity-category-title">
                <strong>${cat.icon || '📌'} ${this.escapeHtml(cat.name)}</strong>
                <span>−${catAdjustment.toFixed(2)} / ${Number(cat.maxPoints || 0)}</span>
              </div>
              <div class="student-activity-actions">
                ${catActions.length ? catActions.map(a => actionButton(a, score, remaining)).join('') : '<span class="help-text">Aucune action configurée.</span>'}
              </div>
            </div>`;
          }).join('')}
          ${!categories.length ? '<p class="help-text">Aucune catégorie d’activité n’est configurée. Utilisez « Configurer les activités » pour commencer.</p>' : ''}
        </div>`;
    },

  async renderStudentActivityDetail(studentId) {
      if(!studentId) return;
      const student=await db.get('students',studentId); if(!student)return;
      const score=await this.getStudentActivityScore(studentId);
      const el=document.getElementById('student-activity-summary');
      if(el) el.innerHTML=`<div class="activity-score-large">${score.toFixed(2)} / 20</div>`;
    }
};
Object.assign(AbsenceApp.prototype, methods);
