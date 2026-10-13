/** Extension V7 conservée dans l’ordre d’application historique. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

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
    if (this.currentStudentDetailId === studentId) await this.renderStudentActivityManager(studentId);
    await this.renderActivitiesView(); await this.renderDashboard();
  };

  const _getScore_v47=proto.getStudentActivityScore;
  proto.getStudentActivityScore=async function(studentId){
    const {maxScore}=await this.getActivityConfig();
    const events=(await db.getAll('activityEvents')).filter(e=>e.studentId===studentId&&!e.archivedAt);
    const adjustment=events.reduce((sum,e)=>sum+Number(e.penalty||0),0);
    return Math.max(0,Math.min(maxScore,maxScore-adjustment));
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
