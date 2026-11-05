/** V7.2 — Contrôle rapide : rotation équitable et historique dans settings IndexedDB. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const CRITERIA = [
  ['homework','Travail à domicile'], ['notebook','Cahier'], ['booklet','Livret'], ['slate','Ardoise']
];
const keyFor = year => `quickChecks_${year}`;

const methods = {
  async getQuickCheckData() {
    const row = await db.get('settings', keyFor(this.activeSchoolYear));
    return row?.value && typeof row.value === 'object' ? row.value : { cycles:{}, records:[] };
  },

  async openQuickCheck(classId = this.activeCourse?.classId || '', date = this.activeCourse?.date || this.selectedDate || new Date().toISOString().slice(0,10), courseId = this.activeCourse?.courseId || null) {
    const classes = await db.getAll('classes');
    const select = document.getElementById('qc-class');
    select.innerHTML = classes.map(c => `<option value="${this.escapeHtml(c.id)}">${this.escapeHtml(c.name || c.id)}</option>`).join('');
    if (classId && classes.some(c=>c.id===classId)) select.value = classId;
    document.getElementById('qc-date').value = date;
    document.getElementById('qc-course-id').value = courseId || '';
    document.getElementById('qc-count').value = '6';
    CRITERIA.forEach(([id]) => { const el=document.getElementById(`qc-${id}`); if(el) el.checked=true; });
    this.qcDraft = null;
    await this.renderQuickCheckSummary();
    this.navigateTo('view-quick-check');
  },

  async renderQuickCheckSummary() {
    const classId = document.getElementById('qc-class')?.value;
    const data = await this.getQuickCheckData();
    const cycle = data.cycles?.[classId] || { number:1, checkedIds:[] };
    const students = (await db.getAll('students')).filter(s=>s.classId===classId && !s.archived);
    const remaining = students.filter(s=>!(cycle.checkedIds||[]).includes(s.id)).length;
    const target=document.getElementById('qc-rotation-summary');
    if(target) target.textContent=`Cycle ${cycle.number || 1} · ${remaining} élève(s) encore à contrôler sur ${students.length}.`;
  },

  async drawQuickCheck() {
    const classId=document.getElementById('qc-class').value;
    const date=document.getElementById('qc-date').value;
    const count=Math.max(1,Math.min(100,Number(document.getElementById('qc-count').value)||6));
    const criteria=CRITERIA.filter(([id])=>document.getElementById(`qc-${id}`).checked).map(([id,label])=>({id,label}));
    if(!classId || !date || !criteria.length){this.showToast('Choisis une classe, une date et au moins un critère.','warning');return;}
    const students=(await db.getAll('students')).filter(s=>s.classId===classId&&!s.archived);
    if(!students.length){this.showToast('Aucun élève actif dans cette classe.','warning');return;}
    const data=await this.getQuickCheckData();
    let cycle=data.cycles?.[classId] || {number:1,checkedIds:[]};
    let remaining=students.filter(s=>!cycle.checkedIds.includes(s.id));
    if(!remaining.length){cycle={number:(cycle.number||1)+1,checkedIds:[]};remaining=[...students];}
    // Mélange aléatoire de Fisher-Yates ; tirage sans doublon dans le cycle.
    for(let i=remaining.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[remaining[i],remaining[j]]=[remaining[j],remaining[i]];}
    const selected=remaining.slice(0,Math.min(count,remaining.length));
    this.qcDraft={classId,date,courseId:document.getElementById('qc-course-id').value||null,cycleNumber:cycle.number,randomIds:selected.map(s=>s.id),criteria,students:selected.map(s=>({...s})),targetCount:count};
    this.renderQuickCheckDraft();
  },

  renderQuickCheckDraft() {
    const draft=this.qcDraft; const host=document.getElementById('qc-student-results');
    if(!draft||!host)return;
    host.innerHTML=draft.students.map((s,i)=>`<article class="card qc-student" data-student="${this.escapeHtml(s.id)}"><strong>${i+1}. ${this.escapeHtml(`${s.nom||''} ${s.prenom||''}`.trim())}</strong><div class="qc-criteria">${draft.criteria.map(c=>`<label class="qc-result"><span>${this.escapeHtml(c.label)}</span><select class="form-control" data-criterion="${c.id}"><option value="unchecked">Non contrôlé</option><option value="ok">Conforme</option><option value="bad">Non conforme</option></select></label>`).join('')}</div></article>`).join('')+`<button class="btn btn-sm btn-secondary" onclick="app.addQuickCheckStudent()">＋ Ajouter un élève ciblé</button>`;
    document.getElementById('qc-draft-info').textContent=`${draft.students.length} élève(s) · Cycle ${draft.cycleNumber} · ${draft.date}`;
  },

  async addQuickCheckStudent() {
    if(!this.qcDraft)return;
    const all=(await db.getAll('students')).filter(s=>s.classId===this.qcDraft.classId&&!s.archived);
    const available=all.filter(s=>!this.qcDraft.students.some(x=>x.id===s.id));
    if(!available.length){this.showToast('Tous les élèves sont déjà dans cette sélection.','info');return;}
    const menu=available.map((s,i)=>`${i+1}. ${s.nom||''} ${s.prenom||''}`).join('\n');
    const answer=prompt(`Ajouter un élève ciblé (indiquer son numéro) :\n${menu}`);
    const index=Number(answer)-1;
    if(!Number.isInteger(index)||index<0||index>=available.length)return;
    this.qcDraft.students.push({...available[index],targeted:true});
    this.renderQuickCheckDraft();
  },

  async getQuickCheckPenaltyActions() {
    // Catégorie dédiée : budget 0 = non plafonné dans le moteur de pénalités.
    let category=(await db.getAll('activityCategories')).find(c=>c.name==='Contrôle rapide automatique');
    if(!category){
      category={id:`qc_cat_${Date.now()}`,name:'Contrôle rapide automatique',icon:'📝',maxPoints:0,order:999,active:true};
      await db.put('activityCategories',category);
    }
    const actions={};
    for(const [id,label] of CRITERIA){
      let action=(await db.getAll('activityActions')).find(a=>a.categoryId===category.id && a.name===label);
      if(!action){action={id:`qc_act_${id}`,categoryId:category.id,name:label,penalty:0.5,order:CRITERIA.findIndex(c=>c[0]===id)+1,active:true,type:'penalty'};await db.put('activityActions',action);}
      else if(Number(action.penalty)!==0.5 || action.active===false){action.penalty=0.5;action.active=true;await db.put('activityActions',action);}
      actions[id]=action;
    }
    return {category,actions};
  },

  async applyQuickCheckPenalties(record) {
    const {category,actions}=await this.getQuickCheckPenaltyActions();
    const allEvents=await db.getAll('activityEvents');
    const applied=[];
    for(const result of record.results){
      for(const [criterion,status] of Object.entries(result.checks||{})){
        if(status!=='bad' || !actions[criterion]) continue;
        // Protection contre une double application si l'enregistrement est relancé.
        if(allEvents.some(e=>e.quickCheckRecordId===record.id && e.studentId===result.studentId && e.quickCheckCriterion===criterion)) continue;
        const current=await this.getStudentActivityScore(result.studentId);
        if(current<=0) continue;
        const amount=Math.min(0.5,current);
        const event={id:`qc_pen_${record.id}_${result.studentId}_${criterion}`,studentId:result.studentId,categoryId:category.id,actionId:actions[criterion].id,penalty:amount,date:record.date,createdAt:new Date().toISOString(),type:'penalty',quickCheckRecordId:record.id,quickCheckCriterion:criterion,source:'quick-check'};
        await db.put('activityEvents',event);allEvents.push(event);
        applied.push({studentId:result.studentId,criterion,amount});
      }
    }
    return applied;
  },

  async saveQuickCheck() {
    const draft=this.qcDraft;if(!draft)return;
    const cards=[...document.querySelectorAll('#qc-student-results .qc-student')];
    const results=[];
    const completedRandomIds=[];
    for(const card of cards){
      const student=draft.students.find(s=>s.id===card.dataset.student);if(!student)continue;
      const checks={};
      for(const select of card.querySelectorAll('[data-criterion]')) checks[select.dataset.criterion]=select.value;
      if(!student.targeted && Object.values(checks).some(v=>v==='ok'||v==='bad')) completedRandomIds.push(student.id);
      results.push({studentId:student.id,studentName:`${student.nom||''} ${student.prenom||''}`.trim(),targeted:!!student.targeted,checks});
    }
    const data=await this.getQuickCheckData();
    const cycle=data.cycles[draft.classId]||{number:draft.cycleNumber,checkedIds:[]};
    // Seuls les élèves issus du tirage aléatoire avancent la rotation ; les ajouts ciblés n'en modifient pas l'équité.
    cycle.number=draft.cycleNumber;
    cycle.checkedIds=[...new Set([...(cycle.checkedIds||[]),...completedRandomIds])];
    const record={id:`qc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,classId:draft.classId,date:draft.date,courseId:draft.courseId,cycleNumber:draft.cycleNumber,criteria:draft.criteria,randomStudentIds:draft.randomIds,rotationCompletedIds:completedRandomIds,results,savedAt:new Date().toISOString(),schoolYear:this.activeSchoolYear};
    // Les pénalités sont créées dans le système existant des activités : elles apparaissent donc dans les notes et historiques habituels.
    const penalties=await this.applyQuickCheckPenalties(record);
    record.appliedPenalties=penalties;
    data.cycles[draft.classId]=cycle;data.records=Array.isArray(data.records)?data.records:[];data.records.push(record);
    await db.put('settings',{key:keyFor(this.activeSchoolYear),value:data});
    await this.registerChange();this.showSaveIndicator();
    const total=penalties.reduce((sum,p)=>sum+p.amount,0);
    this.showToast(`Contrôle enregistré · ${penalties.length} pénalité(s) appliquée(s) : −${total.toFixed(2)} point(s).`,'success');
    this.qcDraft=null;await this.renderQuickCheckHistory();await this.renderQuickCheckSummary();
  },

  async renderQuickCheckStudentHistory(studentId) {
    const host=document.getElementById('student-quick-check-history');if(!host)return;
    const data=await this.getQuickCheckData();
    const rows=(data.records||[]).flatMap(r=>(r.results||[]).filter(x=>x.studentId===studentId).map(x=>({record:r,result:x}))).sort((a,b)=>String(b.record.date).localeCompare(String(a.record.date)));
    host.innerHTML=rows.length?rows.slice(0,20).map(({record,result})=>`<div class="qc-history-row"><strong>${this.escapeHtml(record.date)} · ${this.escapeHtml(record.classId)}</strong><span>${Object.entries(result.checks||{}).map(([k,v])=>`${this.escapeHtml((CRITERIA.find(c=>c[0]===k)||[k,k])[1])} : ${v==='ok'?'Conforme':v==='bad'?'Non conforme':'Non contrôlé'}`).join(' · ')}</span></div>`).join(''):'<p class="help-text">Aucun contrôle rapide enregistré pour cet élève.</p>';
  },

  async renderQuickCheckHistory() {
    const host=document.getElementById('qc-history');if(!host)return;
    const data=await this.getQuickCheckData();const cls=document.getElementById('qc-class')?.value;
    const rows=(data.records||[]).filter(r=>!cls||r.classId===cls).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15);
    host.innerHTML=rows.length?rows.map(r=>`<div class="qc-history-row"><strong>${this.escapeHtml(r.date)} · ${this.escapeHtml(r.classId)}</strong><span>${r.results.length} élève(s) · Cycle ${r.cycleNumber}</span></div>`).join(''):'<p class="help-text">Aucun contrôle enregistré pour cette classe.</p>';
  }
};
Object.assign(AbsenceApp.prototype,methods);
