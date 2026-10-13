/** V7 — module métier : data-backup. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  async getYearData(includeSettings=true) {
      const data = {
        year: this.activeSchoolYear,
        classes: await db.getAll('classes'), students: await db.getAll('students'), timetable: await db.getAll('timetable'),
        attendance: await db.getAll('attendance'), calendar: await db.getAll('calendar'), sessions: await db.getAll('sessions'),
        activityCategories: await db.getAll('activityCategories'), activityActions: await db.getAll('activityActions'), activityEvents: await db.getAll('activityEvents'),
        classReminders: await db.getAll('classReminders'), classEvents: await db.getAll('classEvents')
      };
      if (includeSettings) {
        const settings = await db.getAll('settings');
        data.settings = settings.filter(x => !['teacherName','teacherSubject','language','profileConfigured','appVersion','activeSchoolYear'].includes(x.key));
      }
      return data;
    },

  async saveYearArchive(year) {
      const data = await this.getYearData(true);
      data.year = year;
      await db.put('schoolYears', { year, data, archivedAt: new Date().toISOString() });
    },

  async clearYearData() {
      for (const store of ['classes','students','timetable','attendance','calendar','sessions','activityCategories','activityActions','activityEvents','classReminders','classEvents']) {
        if (db.db.objectStoreNames.contains(store)) await db.clearStore(store);
      }
    },

  async restoreYearArchive(year) {
      const archive = await db.get('schoolYears', year);
      if (!archive?.data) throw new Error('Année archivée introuvable.');
      const d = archive.data;
      await db.replaceStores({
        classes:d.classes||[], students:d.students||[], timetable:d.timetable||[],
        attendance:d.attendance||[], calendar:d.calendar||[], sessions:d.sessions||[],
        activityCategories:d.activityCategories||[], activityActions:d.activityActions||[],
        activityEvents:d.activityEvents||[], classReminders:d.classReminders||[], classEvents:d.classEvents||[], settings:d.settings||[]
      });
    },

  async createLocalSafetyBackup(reason='sécurité') {
      try {
        const data = await this.getBackupData();
        const key = `gestion_classe_safety_${this.activeSchoolYear}`;
        localStorage.setItem(key, JSON.stringify({
          savedAt: new Date().toISOString(),
          reason,
          appVersion: '7.0.0-compat',
          data
        }));
        return true;
      } catch (e) {
        console.warn('Sauvegarde locale de sécurité impossible', e);
        return false;
      }
    },

  async registerChange() {
      // Le compteur est conservé dans IndexedDB : un rechargement de la page
      // ne remet plus à zéro la fréquence de sauvegarde automatique.
      this.changeCounter++;
      await db.put('settings', { key: `autoBackupChangeCounter_${this.activeSchoolYear}`, value: this.changeCounter });
      const interval = Number((await db.get('settings','autoBackupInterval'))?.value || 0);
      if (interval > 0 && this.changeCounter % interval === 0) {
        try {
          const data = await this.getBackupData();
          const savedAt = new Date().toISOString();
          localStorage.setItem(`gestion_classe_autobackup_${this.activeSchoolYear}`, JSON.stringify({savedAt,reason:'automatique',appVersion:'7.0.0-compat',data}));
          this.lastAutoBackupAt = savedAt;
          this.showSaveIndicator();
        } catch(e) {
          console.warn('Auto-backup impossible',e);
          this.showToast('La sauvegarde automatique locale a échoué. Exportez une sauvegarde JSON sur un autre support.','warning',5000);
        }
      }
    },

  validateBackupData(data) {
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Le fichier ne contient pas une sauvegarde valide.');
      const required = ['classes','students','timetable','attendance','calendar'];
      for (const name of required) {
        if (!Array.isArray(data[name])) throw new Error(`Sauvegarde invalide : la rubrique « ${name} » est absente ou incorrecte.`);
      }
      const optional = ['sessions','activityCategories','activityActions','activityEvents','classReminders','classEvents','settings','schoolYears'];
      for (const name of optional) {
        if (data[name] !== undefined && !Array.isArray(data[name])) throw new Error(`Sauvegarde invalide : la rubrique « ${name} » doit être une liste.`);
      }
      for (const [index, row] of data.classes.entries()) {
        if (!row || typeof row !== 'object' || row.id == null || row.name == null) throw new Error(`Sauvegarde invalide : classe n° ${index + 1} incomplète.`);
      }
      for (const [index, row] of data.students.entries()) {
        if (!row || typeof row !== 'object' || row.id == null || row.classId == null) throw new Error(`Sauvegarde invalide : élève n° ${index + 1} sans identifiant ou sans classe.`);
      }
      for (const name of ['timetable','attendance','calendar']) {
        for (const [index, row] of data[name].entries()) {
          if (!row || typeof row !== 'object' || row.id == null) throw new Error(`Sauvegarde invalide : élément n° ${index + 1} de « ${name} » sans identifiant.`);
        }
      }
      return true;
    },

  async restoreLocalAutoBackup() {
      const raw=localStorage.getItem(`gestion_classe_autobackup_${this.activeSchoolYear}`);
      if(!raw){this.showToast('Aucune sauvegarde automatique locale disponible.','warning');return;}
      try {
        const pack=JSON.parse(raw);
        const data=pack.data || {};
        this.validateBackupData(data);
        if(!confirm(`Restaurer la sauvegarde automatique du ${new Date(pack.savedAt).toLocaleString()} ?\n\nUne sauvegarde de sécurité de l'état actuel sera créée avant la restauration.`))return;
        await this.createLocalSafetyBackup('avant restauration automatique');
        await db.replaceStores({
          classes:data.classes, students:data.students, timetable:data.timetable,
          attendance:data.attendance, calendar:data.calendar, sessions:data.sessions||[],
          activityCategories:data.activityCategories||[], activityActions:data.activityActions||[],
          activityEvents:data.activityEvents||[], classReminders:data.classReminders||[],
          classEvents:(data.classEvents||[]).map(e=>({...e,schoolYear:e.schoolYear||data.schoolYear||this.activeSchoolYear,visible:e.visible!==false})),
          settings:data.settings||[], ...(Array.isArray(data.schoolYears)?{schoolYears:data.schoolYears}:{})
        });
        location.reload();
      } catch(e){this.showToast('Impossible de restaurer la sauvegarde automatique : '+e.message,'error');}
    },

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
        classReminders: await db.getAll('classReminders'),
        classEvents: await db.getAll('classEvents'),
        settings: await db.getAll('settings'),
        schoolYears: await db.getAll('schoolYears'),
        schoolYear: this.activeSchoolYear,
        appVersion: '7.0.0-compat',
        exportedAt: new Date().toISOString()
      };
  
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gestion_classe_${this.activeSchoolYear.replace('/','_')}_${this.getTodayISO()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

  async getBackupData() {
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
        classReminders: await db.getAll('classReminders'),
        classEvents: await db.getAll('classEvents'),
        settings: await db.getAll('settings'),
        schoolYears: await db.getAll('schoolYears'),
        schoolYear: this.activeSchoolYear,
        appVersion: '7.0.0-compat',
        exportedAt: new Date().toISOString()
      };
      return data;
    },

  downloadBackupData(data, filename) {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    },

  normalizeName(value) {
      return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
    },

  async importJSON() {
      const input=document.getElementById('import-json-file'); if(!input.files.length){this.showToast('Veuillez choisir un fichier JSON.','warning');return;}
      try {
        const data=JSON.parse(await input.files[0].text());
        this.validateBackupData(data);
        if(data.schoolYear && data.schoolYear !== this.activeSchoolYear && !confirm(`Cette sauvegarde concerne ${data.schoolYear}, alors que l’année active est ${this.activeSchoolYear}.\n\nContinuer la restauration ?`)) return;
        if(!confirm('La restauration remplacera les données actuelles. Une sauvegarde locale de sécurité sera créée avant toute modification. Continuer ?'))return;
        await this.createLocalSafetyBackup('avant restauration JSON');
        const payload = {
          classes:data.classes||[], students:data.students||[], timetable:data.timetable||[],
          attendance:data.attendance||[], calendar:data.calendar||[], sessions:data.sessions||[],
          activityCategories:data.activityCategories||[], activityActions:data.activityActions||[],
          activityEvents:data.activityEvents||[], classReminders:data.classReminders||[],
          classEvents:(data.classEvents||[]).map(e=>({ ...e, schoolYear:e.schoolYear||data.schoolYear||this.activeSchoolYear, visible:e.visible !== false })),
          settings:data.settings||[]
        };
        // Un ancien export v4.x peut ne pas contenir schoolYears : dans ce cas,
        // on conserve les archives locales au lieu de les effacer.
        if (Array.isArray(data.schoolYears)) payload.schoolYears = data.schoolYears;
        await db.replaceStores(payload);
        this.showToast('Restauration réussie.','success');
        setTimeout(()=>location.reload(),450);
      } catch(e){this.showToast('Erreur lors de la restauration : '+e.message,'error',3500);}
    },

  async mergeJSON() {
      const input=document.getElementById('import-json-file');
      if(!input.files.length){alert('Veuillez choisir un fichier JSON à fusionner.');return;}
      try {
        const incoming=JSON.parse(await input.files[0].text());
        this.validateBackupData(incoming);
        if(incoming.schoolYear && incoming.schoolYear !== this.activeSchoolYear) { alert(`Impossible de fusionner : la sauvegarde concerne ${incoming.schoolYear}, tandis que le PC est sur ${this.activeSchoolYear}.\n\nChangez d’abord d’année scolaire ou utilisez une restauration.`); return; }
        if(!confirm('FUSION SÉCURISÉE\n\nLes anciennes données du PC seront conservées. Les nouvelles données seront ajoutées et les doublons ignorés.\n\nUne sauvegarde automatique des données actuelles du PC sera téléchargée avant la fusion. Continuer ?')) return;
  
        // 1) Sauvegarde de sécurité AVANT toute modification.
        const before=await this.getBackupData();
        this.downloadBackupData(before, `securite_avant_fusion_${this.getTodayISO()}.json`);
  
        const current={
          classes:await db.getAll('classes'), students:await db.getAll('students'), timetable:await db.getAll('timetable'),
          attendance:await db.getAll('attendance'), calendar:await db.getAll('calendar'), sessions:await db.getAll('sessions'),
          activityCategories:await db.getAll('activityCategories'), activityActions:await db.getAll('activityActions'),
          activityEvents:await db.getAll('activityEvents'), classReminders:await db.getAll('classReminders'), classEvents:await db.getAll('classEvents'), settings:await db.getAll('settings')
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
  
        // Journal de classe : les événements gardent leur ID pour éviter les doublons.
        // Un ancien export sans 'visible' est considéré comme visible.
        const existingClassEventIds=new Set(current.classEvents.map(e=>e.id));
        for(const e of (incoming.classEvents||[])){
          if(existingClassEventIds.has(e.id)) continue;
          const x={...e, classId:classMap.get(e.classId)||e.classId, schoolYear:e.schoolYear||this.activeSchoolYear, visible:e.visible !== false};
          await db.put('classEvents',x); existingClassEventIds.add(x.id);
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
    },

  csvEscape(value) { const str=String(value??''); return /[;"\n]/.test(str)?`"${str.replace(/"/g,'""')}"`:str; },

  async exportCSV(type) {
      const rows=[]; const attendance=await db.getAll('attendance'); const students=await db.getAll('students');
      if(type==='records'){ rows.push(['Date','Jour','Classe','Horaire','Élève','Statut']); const tt=await db.getAll('timetable'); for(const a of attendance.sort((x,y)=>y.date.localeCompare(x.date))){const st=students.find(s=>s.id===a.studentId);const c=tt.find(c=>c.id===a.courseId);rows.push([this.formatDateFR(a.date),this.getDayNameFR(this.getDayOfWeek(a.date)),a.classId,c?`${c.startTime} – ${c.endTime}`:'',st?`${st.nom} ${st.prenom}`:'Inconnu',a.status]);}}
      else if(type==='students_summary'){rows.push(['Élève','Classe','Nombre Absences','Nombre Retards','Total']);for(const st of students.filter(s=>!s.archived)){const r=attendance.filter(a=>a.studentId===st.id);const A=r.filter(x=>x.status==='A').length;const R=r.filter(x=>x.status==='R').length;rows.push([`${st.nom} ${st.prenom}`,st.classId,A,R,A+R]);}}
      else {rows.push(['Classe','Total Absences','Total Retards','Total Incidents']);const classes=await db.getAll('classes');for(const c of classes){const r=attendance.filter(a=>a.classId===c.id);const A=r.filter(x=>x.status==='A').length;const R=r.filter(x=>x.status==='R').length;rows.push([c.name,A,R,A+R]);}}
      const csv='\uFEFF'+rows.map(r=>r.map(v=>this.csvEscape(v)).join(';')).join('\n')+'\n'; const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`bilan_${type}_${this.getTodayISO()}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },

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
    },

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
};
Object.assign(AbsenceApp.prototype, methods);
