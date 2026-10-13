/** V7 — module métier : pedagogical-followup. Méthodes conservées et regroupées par domaine. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

const methods = {
  getPracticesDomains() {
      return [
        {id:'postureEcouteEngagement',name:'Posture, écoute et engagement en classe',positive:[
          'Écoute attentivement les explications et reste concentré pendant la séance.',
          'Participe régulièrement et de manière pertinente aux échanges.',
          'Pose des questions lorsqu’une notion ou une consigne n’est pas comprise.',
          'S’implique activement dans les différentes phases du cours.',
          'Manifeste de la curiosité et de l’intérêt pour les activités mathématiques.'
        ], improve:[
          'Doit maintenir son attention pendant toute la durée de la séance.',
          'Éviter les distractions pendant les phases d’explication.',
          'Gagnerait à participer davantage à l’oral.',
          'Doit apprendre à signaler rapidement une difficulté plutôt que de rester passif.',
          'Doit adopter une posture plus active face aux apprentissages.'
        ]},
        {id:'initiativeBrouillon',name:'Initiative et travail au brouillon',positive:[
          'Se met rapidement au travail sans attendre la correction.',
          'Cherche activement une stratégie pour résoudre un problème.',
          'Utilise efficacement le brouillon pour faire des essais et organiser sa réflexion.',
          'N’hésite pas à tester plusieurs méthodes.',
          'Persévère même lorsqu’une première tentative échoue.'
        ], improve:[
          'Doit oser commencer une recherche seul avant de demander de l’aide.',
          'Utiliser davantage le brouillon pour essayer, schématiser et raisonner.',
          'Ne pas abandonner trop rapidement face à une difficulté.',
          'Doit conserver ses essais et ses erreurs afin de comprendre ce qui n’a pas fonctionné.',
          'Gagnerait à développer progressivement son autonomie dans la recherche.'
        ]},
        {id:'rigueurEcrit',name:'Rigueur de l’écrit et présentation mathématique',positive:[
          'Présente un travail propre, lisible et organisé.',
          'Pose correctement les calculs et respecte les étapes du raisonnement.',
          'Utilise correctement les symboles et les signes mathématiques.',
          'Rédige les réponses de manière claire et structurée.',
          'Réalise des figures géométriques précises et soignées.'
        ], improve:[
          'Doit améliorer la présentation et l’organisation de ses calculs.',
          'Penser à écrire toutes les étapes importantes du raisonnement.',
          'Veiller à aligner correctement les calculs et les signes d’égalité.',
          'Les réponses doivent être formulées par des phrases lorsque cela est nécessaire.',
          'Les constructions géométriques doivent être réalisées avec davantage de précision.'
        ]},
        {id:'langageMathematique',name:'Langage et communication mathématique',positive:[
          'Utilise un vocabulaire mathématique adapté.',
          'Explique clairement sa démarche à l’oral.',
          'Sait présenter une méthode de résolution au tableau.',
          'Justifie ses réponses en utilisant les propriétés mathématiques appropriées.',
          'Reformule correctement une consigne ou un résultat.'
        ], improve:[
          'Doit enrichir son vocabulaire mathématique.',
          'Éviter les formulations approximatives et utiliser les termes mathématiques appropriés.',
          'Doit apprendre à expliquer pourquoi une réponse est correcte.',
          'Les justifications doivent être davantage développées.',
          'Gagnerait à verbaliser les différentes étapes de son raisonnement.'
        ]},
        {id:'gestionErreurs',name:'Gestion des erreurs et autocorrection',positive:[
          'Accepte l’erreur comme une étape normale de l’apprentissage.',
          'Identifie l’origine de ses erreurs.',
          'Corrige son travail avec attention.',
          'Tient compte des remarques données lors de la correction.',
          'Cherche à ne pas reproduire les mêmes erreurs.'
        ], improve:[
          'Doit prendre le temps d’analyser ses erreurs plutôt que de simplement recopier la correction.',
          'Apprendre à identifier précisément l’étape où l’erreur a été commise.',
          'Doit relire son travail avant de le considérer comme terminé.',
          'Porter une attention particulière aux erreurs de signe et de calcul.',
          'Utiliser les corrections précédentes pour éviter de reproduire les mêmes erreurs.'
        ]},
        {id:'raisonnementProblemes',name:'Raisonnement et résolution de problèmes',positive:[
          'Analyse correctement les données avant de commencer.',
          'Identifie les informations utiles et la question posée.',
          'Choisit une stratégie adaptée à la situation.',
          'Sait expliquer les étapes suivies pour parvenir au résultat.',
          'Fait preuve de persévérance face aux situations-problèmes.'
        ], improve:[
          'Doit prendre le temps d’analyser la situation avant de commencer les calculs.',
          'Gagnerait à rechercher une stratégie plutôt qu’à appliquer directement une formule.',
          'Doit apprendre à distinguer les données utiles des données inutiles.',
          'Penser à vérifier si la méthode choisie répond réellement à la question.',
          'Doit développer sa capacité à résoudre une situation sans modèle immédiatement fourni.'
        ]},
        {id:'memorisation',name:'Mémorisation et mobilisation des connaissances',positive:[
          'Réutilise correctement les notions étudiées dans de nouvelles situations.',
          'Mobilise les propriétés et méthodes apprises de manière pertinente.',
          'Connaît les formules et propriétés essentielles.',
          'Fait le lien entre les différentes notions étudiées.',
          'Réinvestit les corrections et les méthodes précédemment rencontrées.'
        ], improve:[
          'Doit consolider les notions essentielles vues en classe.',
          'Apprendre les définitions, propriétés et formules importantes.',
          'Gagnerait à revoir régulièrement les notions plutôt qu’avant les évaluations uniquement.',
          'Doit apprendre à reconnaître quand utiliser une propriété ou une méthode.',
          'Renforcer le réinvestissement des connaissances dans des exercices différents.'
        ]},
        {id:'autonomieOrganisationMateriel',name:'Autonomie, organisation et gestion du matériel',positive:[
          'Arrive avec le matériel nécessaire et l’utilise correctement.',
          'Organise efficacement son cahier et ses documents.',
          'Travaille de manière autonome après lecture de la consigne.',
          'Gère correctement son temps pendant les activités.',
          'Prend en charge son propre travail et demande de l’aide de manière pertinente.'
        ], improve:[
          'Doit apporter systématiquement le matériel nécessaire.',
          'Améliorer l’organisation du cahier et des documents.',
          'Doit apprendre à lire attentivement une consigne avant de solliciter de l’aide.',
          'Gagnerait à mieux gérer son temps pendant les exercices.',
          'Développer progressivement son autonomie face aux tâches mathématiques.'
        ]}
      ];
    },

  normalizePractices(p) {
      const domains=this.getPracticesDomains(); const src=p||{}; const out={};
      for(const d of domains){ const x=src[d.id]||{}; out[d.id]={niveau:x.niveau||'non_evalue',positives:Array.isArray(x.positives)?x.positives:[],ameliorations:Array.isArray(x.ameliorations)?x.ameliorations:[],remarque:x.remarque||''}; }
      out.remarqueGenerale=src.remarqueGenerale||''; return out;
    },

  async renderStudentPractices(student){
      const container=document.getElementById('student-practices-container'); if(!container)return;
      const p=this.normalizePractices(student.pratiquesAttitudes); const ar=this.language==='ar';
      const levels=ar?[['non_evalue','غير مُقيّم'],['tres_satisfaisant','مرضٍ جدًا'],['satisfaisant','مرضي'],['a_ameliorer','يحتاج إلى تحسين'],['insuffisant','غير كاف']]:[['non_evalue','Non évalué'],['tres_satisfaisant','Très satisfaisant'],['satisfaisant','Satisfaisant'],['a_ameliorer','À améliorer'],['insuffisant','Insuffisant']];
      const esc=v=>this.escapeHtml(v);
      container.innerHTML=this.getPracticesDomains().map(d=>{const x=p[d.id];return `<div class="practice-domain-card"><h4>${esc(d.name)}</h4><div class="practice-level"><label>${ar?'المستوى':'Niveau'} :</label><select class="form-control practice-level-select" data-domain="${d.id}">${levels.map(([v,l])=>`<option value="${v}" ${x.niveau===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="practice-cols"><div><b>${ar?'مواقف إيجابية':'Attitudes positives'}</b>${d.positive.map((t,i)=>`<label class="practice-check"><input type="checkbox" data-domain="${d.id}" data-kind="positives" data-index="${i}" ${x.positives.includes(i)?'checked':''}> <span>${esc(t)}</span></label>`).join('')}</div><div><b>${ar?'محاور التحسين':'Axes d’amélioration'}</b>${d.improve.map((t,i)=>`<label class="practice-check"><input type="checkbox" data-domain="${d.id}" data-kind="ameliorations" data-index="${i}" ${x.ameliorations.includes(i)?'checked':''}> <span>${esc(t)}</span></label>`).join('')}</div></div><div class="form-group"><label>${ar?'ملاحظة شخصية':'Remarque personnelle'} :</label><textarea class="form-control practice-note" data-domain="${d.id}" rows="2" placeholder="${ar?'ملاحظة اختيارية...':'Remarque facultative...'}">${esc(x.remarque)}</textarea></div></div>`}).join('');
      const g=document.getElementById('student-practices-general'); if(g)g.value=p.remarqueGenerale;
    },

  getBehaviorDomains() {
      return [
        { id:'rituelsOrganisation', name:'Rituels & organisation', nameAr:'الطقوس والتنظيم', items:[
          { fr:'Entrée/sortie agitées.', ar:'الدخول/الخروج بشكل غير منظم.' },
          { fr:'Affaires ou matériel souvent non préparés.', ar:'الأدوات أو اللوازم غالبًا غير مُعدة.' },
          { fr:'Oublie régulièrement le matériel de mathématiques.', ar:'ينسى بانتظام لوازم الرياضيات.' },
          { fr:"A besoin d'aide pour organiser son espace de travail.", ar:'يحتاج إلى مساعدة لتنظيم فضاء عمله.' }
        ]},
        { id:'ecouteConcentration', name:'Écoute & concentration', nameAr:'الإنصات والتركيز', items:[
          { fr:'Se distrait ou bavarde pendant les explications.', ar:'يتشتت انتباهه أو يتحدث أثناء الشرح.' },
          { fr:'A du mal à maintenir son attention.', ar:'يجد صعوبة في الحفاظ على انتباهه.' },
          { fr:"Intervient ou lève la main pendant les explications sans attendre le signal.", ar:'يتدخل أو يرفع يده أثناء الشرح دون انتظار الإشارة.' },
          { fr:'Ne regarde pas attentivement le tableau ou le support présenté.', ar:'لا يتابع السبورة أو الدعامة المعروضة بانتباه.' }
        ]},
        { id:'travailEngagement', name:'Travail & engagement', nameAr:'العمل والانخراط', items:[
          { fr:'Démarre difficilement le travail.', ar:'يجد صعوبة في الشروع في العمل.' },
          { fr:'Participe peu aux activités.', ar:'يشارك بشكل ضعيف في الأنشطة.' },
          { fr:"A besoin d'être régulièrement incité à travailler.", ar:'يحتاج إلى تحفيز متكرر للعمل.' },
          { fr:'Abandonne rapidement face à une difficulté.', ar:'يستسلم بسرعة أمام الصعوبة.' },
          { fr:'Bavarde pendant le travail en binôme ou autonome.', ar:'يتحدث أثناء العمل الثنائي أو الفردي.' },
          { fr:'Gère difficilement le temps de travail.', ar:'يجد صعوبة في تدبير وقت العمل.' }
        ]},
        { id:'rigueurRaisonnement', name:'Rigueur & raisonnement', nameAr:'الدقة والاستدلال', items:[
          { fr:'Manque de précision dans ses écrits mathématiques.', ar:'ينقصه الدقة في كتاباته الرياضياتية.' },
          { fr:'Utilise un vocabulaire mathématique imprécis.', ar:'يستعمل مفردات رياضياتية غير دقيقة.' },
          { fr:'A des difficultés à expliquer son raisonnement.', ar:'يجد صعوبة في شرح استدلاله.' },
          { fr:'Évite ou refuse de présenter son travail au tableau.', ar:'يتجنب أو يرفض تقديم عمله على السبورة.' },
          { fr:'Corrige difficilement ses erreurs.', ar:'يجد صعوبة في تصحيح أخطائه.' },
          { fr:'Ne vérifie pas suffisamment la cohérence de ses résultats.', ar:'لا يتحقق بشكل كافٍ من انسجام نتائجه.' }
        ]},
        { id:'respectCollaboration', name:'Respect & collaboration', nameAr:'الاحترام والتعاون', items:[
          { fr:'Interrompt les autres ou ne respecte pas le tour de parole.', ar:'يقاطع الآخرين أو لا يحترم التناوب في الكلام.' },
          { fr:'Se moque des erreurs de ses camarades.', ar:'يسخر من أخطاء زملائه.' },
          { fr:'Dérange les autres pendant leur travail.', ar:'يزعج الآخرين أثناء عملهم.' },
          { fr:'Participe difficilement au travail de groupe ou en binôme.', ar:'يجد صعوبة في المشاركة في العمل الجماعي أو الثنائي.' },
          { fr:"Ne respecte pas suffisamment le matériel ou l'environnement de travail.", ar:'لا يحترم بشكل كافٍ الأدوات أو محيط العمل.' }
        ]}
      ];
    },

  normalizeBehaviorChecks(raw) {
      const domains = this.getBehaviorDomains(); const src = raw || {}; const out = {};
      for (const d of domains) { const arr = src[d.id]; out[d.id] = Array.isArray(arr) ? arr.map(Number).filter(n=>Number.isInteger(n)) : []; }
      return out;
    },

  async renderStudentBehaviors(student) {
      const container = document.getElementById('student-behaviors-container'); if (!container) return;
      const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
      const ar = this.language === 'ar'; const esc = v => this.escapeHtml(v);
      container.innerHTML = this.getBehaviorDomains().map(d => {
        const sel = checks[d.id] || [];
        const rows = d.items.map((it, i) => `<label class="behavior-check-item"><input type="checkbox" data-domain="${d.id}" data-index="${i}" ${sel.includes(i)?'checked':''}> <span>${esc(ar?it.ar:it.fr)}</span></label>`).join('');
        return `<div class="behavior-domain-card"><h4>${esc(ar?d.nameAr:d.name)}</h4><div class="behavior-check-list">${rows}</div></div>`;
      }).join('');
    },

  getRemarkActionMap() {
      return {
        devoirMaison: ['acta_homework'],
        travailDomicile: ['acta_late', 'acta_incomplete', 'acta_consigne'],
        oubliLivre: ['acta_book'],
        oubliCahier: ['acta_notebook'],
        oubliMateriel: ['acta_material'],
        manqueParticipation: ['acta_participation', 'acta_refuse'],
        manqueConcentration: ['acta_listen'],
        collaboration: ['acta_group_refuse', 'acta_group_no', 'acta_respect']
      };
    },

  getRemarkThresholds() {
      return {
        devoirMaison: 2,
        travailDomicile: 5,
        oubliLivre: { low: 2, high: 4 },
        oubliCahier: 3,
        oubliMateriel: 3,
        manqueParticipation: 3,
        manqueConcentration: 3,
        collaboration: 3
      };
    },

  joinList(list, ar) {
      if (list.length === 1) return list[0];
      const sep = ar ? ' و' : ' et ';
      if (list.length === 2) return list.join(sep);
      return (ar ? list.slice(0, -1).join('، ') : list.slice(0, -1).join(', ')) + sep + list[list.length - 1];
    },

  countRemarkOccurrences(events) {
      const map = this.getRemarkActionMap(); const counts = {};
      for (const key in map) counts[key] = events.filter(e => map[key].includes(e.actionId)).length;
      return counts;
    },

  buildGeneralRemark(student, events) {
      const ar = this.language === 'ar';
      const counts = this.countRemarkOccurrences(events);
      const th = this.getRemarkThresholds();
      const phrases = [];
  
      // 1. Devoir maison / travail à domicile (jamais fusionnés dans le calcul,
      // mais regroupés dans une phrase commune si les deux seuils sont atteints).
      const dmFlag = counts.devoirMaison >= th.devoirMaison;
      const tdFlag = counts.travailDomicile >= th.travailDomicile;
      if (dmFlag && tdFlag) {
        phrases.push(ar
          ? 'لا يُنجز الواجبات المنزلية ولا العمل في المنزل بانتظام. من الضروري مزيد من الانتظام في العمل الشخصي لترسيخ التعلمات.'
          : 'Les devoirs à la maison et le travail à domicile ne sont pas réalisés régulièrement. Une plus grande régularité dans le travail personnel est nécessaire pour consolider les apprentissages.');
      } else if (dmFlag) {
        phrases.push(ar
          ? 'لا يُنجز الواجبات المنزلية بانتظام. من الضروري العمل الشخصي المنتظم لترسيخ التعلمات.'
          : 'Les devoirs à la maison ne sont pas réalisés régulièrement. Un travail personnel plus régulier est nécessaire pour consolider les apprentissages.');
      } else if (tdFlag) {
        phrases.push(ar
          ? 'لا يُنجز العمل في المنزل بانتظام. من الضروري مزيد من الانتظام في العمل الشخصي لترسيخ التعلمات.'
          : "Le travail à domicile n'est pas réalisé régulièrement. Une plus grande régularité dans le travail personnel est nécessaire pour consolider les apprentissages.");
      }
  
      // 2. Matériel (livre / cahier / matériel), avec un seuil à deux paliers pour le livre.
      const matItems = [];
      if (counts.oubliLivre >= th.oubliLivre.high) matItems.push({ fr: 'son livre scolaire', ar: 'كتابه المدرسي', high: true });
      else if (counts.oubliLivre >= th.oubliLivre.low) matItems.push({ fr: 'son livre scolaire', ar: 'كتابه المدرسي', high: false });
      if (counts.oubliCahier >= th.oubliCahier) matItems.push({ fr: 'son cahier', ar: 'كراسته', high: false });
      if (counts.oubliMateriel >= th.oubliMateriel) matItems.push({ fr: 'son matériel', ar: 'لوازمه', high: false });
      if (matItems.length === 1) {
        const it = matItems[0];
        if (it.high) phrases.push(ar ? `ينسى ${it.ar} بانتظام. ينبغي تحسين تحضير اللوازم قبل الحصص.` : `L'élève oublie régulièrement ${it.fr}. Une meilleure préparation du matériel avant les cours est nécessaire.`);
        else phrases.push(ar ? `ينسى ${it.ar} غالبًا وعليه الحرص على تحضير لوازمه قبل كل حصة.` : `L'élève oublie souvent ${it.fr} et doit veiller à préparer son matériel avant chaque séance.`);
      } else if (matItems.length > 1) {
        const list = this.joinList(matItems.map(i => ar ? i.ar : i.fr), ar);
        phrases.push(ar ? `على التلميذ الحرص على تحضير ${list} قبل كل حصة.` : `L'élève doit veiller à préparer ${list} avant chaque séance.`);
      }
  
      // 3. Comportement en classe repéré via les pénalités déjà existantes.
      const classroom = [];
      if (counts.manqueParticipation >= th.manqueParticipation) classroom.push(ar ? 'يشارك بشكل غير كافٍ في الأنشطة' : 'participe insuffisamment aux activités');
      if (counts.manqueConcentration >= th.manqueConcentration) classroom.push(ar ? 'يعاني من نقص التركيز أثناء الشرح' : "manque de concentration pendant les explications");
      if (counts.collaboration >= th.collaboration) classroom.push(ar ? 'يحتاج إلى تحسين سلوكه تجاه زملائه والعمل الجماعي' : 'doit améliorer son comportement envers ses camarades et le travail collectif');
      if (classroom.length) phrases.push(ar ? `داخل القسم، ${this.joinList(classroom, ar)}.` : `En classe, l'élève ${this.joinList(classroom, ar)}.`);
  
      // 4. Comportements cochés dans les 5 domaines (Rituels & organisation, etc.).
      const domainTemplates = {
        rituelsOrganisation: { fr: 'veiller à préparer son matériel et organiser son espace de travail', ar: 'الحرص على تحضير لوازمه وتنظيم فضاء عمله' },
        ecouteConcentration: { fr: 'améliorer son écoute et sa concentration pendant les explications', ar: 'تحسين إنصاته وتركيزه أثناء الشرح' },
        travailEngagement: { fr: 's’engager davantage dans les activités et faire preuve de persévérance', ar: 'الانخراط أكثر في الأنشطة والتحلي بالمثابرة' },
        rigueurRaisonnement: { fr: 'gagner en rigueur dans la rédaction et l’explication de son raisonnement', ar: 'اكتساب مزيد من الدقة في التحرير وشرح استدلاله' },
        respectCollaboration: { fr: 'améliorer le respect des autres et la collaboration en classe', ar: 'تحسين احترام الآخرين والتعاون داخل القسم' }
      };
      const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
      const domainClauses = [];
      for (const d of this.getBehaviorDomains()) { if ((checks[d.id]||[]).length > 0 && domainTemplates[d.id]) domainClauses.push(ar ? domainTemplates[d.id].ar : domainTemplates[d.id].fr); }
      if (domainClauses.length) phrases.push(ar ? `على مستوى السلوك، على التلميذ ${this.joinList(domainClauses, ar)}.` : `Sur le plan du comportement, l'élève doit ${this.joinList(domainClauses, ar)}.`);
  
      if (!phrases.length) return '';
      return phrases.join(' ');
    },

  async renderStudentGeneralRemark(student) {
      const box = document.getElementById('student-general-remark'); if (!box) return;
      const events = (await db.getAll('activityEvents')).filter(e => e.studentId === student.id && !e.archivedAt);
      box.textContent = this.buildGeneralRemark(student, events);
    },

  async printStudentReport() {
      const st = await db.get('students', this.currentStudentDetailId);
      if (!st) return;
      const [attAll, evAll, timetable, categories, actions] = await Promise.all([
        db.getAll('attendance'), db.getAll('activityEvents'), db.getAll('timetable'),
        db.getAll('activityCategories'), db.getAll('activityActions')
      ]);
      const att = attAll.filter(a => a.studentId === st.id).sort((a,b) => b.date.localeCompare(a.date) || String(b.timestamp||0).localeCompare(String(a.timestamp||0)));
      const ev = evAll.filter(e => e.studentId === st.id && !e.archivedAt).sort((a,b) => String(b.createdAt||b.date).localeCompare(String(a.createdAt||a.date)));
      const maxScore = Number((await db.get('settings','activityMaxScore'))?.value || 20);
      const deducted = ev.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
      const score = Math.max(0, Math.min(maxScore, maxScore - deducted));
      const esc = v => this.escapeHtml(v);
      const attendanceRows = att.length ? att.map(r => {
        const c = timetable.find(x => x.id === r.courseId);
        const horaire = c ? `${c.startTime} – ${c.endTime}` : 'Horaire non renseigné';
        return `<tr><td>${esc(this.formatDateFR(r.date))}</td><td>${esc(horaire)}</td><td><b>${r.status==='A'?'Absence (A)':'Retard (R)'}</b></td></tr>`;
      }).join('') : '<tr><td colspan="3">Aucune absence ou retard enregistré.</td></tr>';
      const eventRows = ev.length ? ev.map(e => {
        const c = categories.find(x => x.id === e.categoryId);
        const a = actions.find(x => x.id === e.actionId);
        return `<tr><td>${esc(this.formatDateFR(e.date))}</td><td>${esc(c?.name || 'Catégorie supprimée')}</td><td>${esc(a?.name || 'Action supprimée')}</td><td>${e.type==='reward'||Number(e.penalty)<0?'+':'−'}${Math.abs(Number(e.penalty||0)).toFixed(2)}</td></tr>`;
      }).join('') : '<tr><td colspan="4">Aucune pénalité enregistrée.</td></tr>';
      const behaviorReport = this.buildBehaviorsReportHtml(st, esc);
      const generalRemark = this.buildGeneralRemark(st, ev).trim();
      const practicesReport = this.buildPracticesReportHtml(st.pratiquesAttitudes, esc);
      this.openPrintReport(`Rapport — ${st.nom} ${st.prenom}`, `
        <h1>${esc(st.nom)} ${esc(st.prenom)}</h1>
        <p><b>Classe :</b> ${esc(st.classId)} — <b>Année :</b> ${esc(this.activeSchoolYear)}</p>
        <h2>Présence détaillée</h2>
        <p><b>Absences :</b> ${att.filter(a=>a.status==='A').length} &nbsp; | &nbsp; <b>Retards :</b> ${att.filter(a=>a.status==='R').length}</p>
        <table border="1" cellspacing="0" cellpadding="7" width="100%"><thead><tr><th>Date</th><th>Horaire</th><th>Statut</th></tr></thead><tbody>${attendanceRows}</tbody></table>
        <h2>Comportement détaillé</h2>
        <p>Note actuelle : <b>${score.toFixed(2)} / ${maxScore}</b> — Ajustement net : <b>${deducted>0?'−':'+'}${Math.abs(deducted).toFixed(2)} point(s)</b></p>
        <table border="1" cellspacing="0" cellpadding="7" width="100%"><thead><tr><th>Date</th><th>Catégorie</th><th>Pénalité</th><th>Points</th></tr></thead><tbody>${eventRows}</tbody></table>
        ${behaviorReport}
        ${generalRemark ? `<h2>Remarques générales</h2><p>${esc(generalRemark)}</p>` : ''}
        ${st.customRemark && String(st.customRemark).trim() ? `<div style="margin-top:12px;padding:12px;border-left:4px solid #888;background:#f7f7f7"><b>✍️ Remarque personnalisée :</b><p style="margin:6px 0 0">${esc(st.customRemark)}</p></div>` : ''}
        ${practicesReport}
      `);
    },

  buildBehaviorsReportHtml(student, esc) {
      const ar = this.language === 'ar';
      const checks = this.normalizeBehaviorChecks(student.pratiquesComportements);
      const domains = this.getBehaviorDomains().map(d => {
        const sel = checks[d.id] || []; if (!sel.length) return null;
        const items = sel.map(i => d.items[i]).filter(Boolean).map(it => `<li>${esc(ar ? it.ar : it.fr)}</li>`).join('');
        return `<div style="margin-bottom:12px;padding:8px 10px;border:1px solid #ddd;border-radius:8px"><h3 style="margin:0 0 6px">${esc(ar ? d.nameAr : d.name)}</h3><ul>${items}</ul></div>`;
      }).filter(Boolean);
      if (!domains.length) return '';
      const body = domains.join('');
      return `<h2>${ar ? 'الممارسات والسلوكات في الرياضيات' : 'Pratiques et comportements en mathématiques'}</h2>${body}`;
    },

  buildPracticesReportHtml(data, esc){
      const p=this.normalizePractices(data); const levels={non_evalue:'Non évalué',tres_satisfaisant:'Très satisfaisant',satisfaisant:'Satisfaisant',a_ameliorer:'À améliorer',insuffisant:'Insuffisant'};
      const ds=this.getPracticesDomains();
      const cards=ds.map(d=>{
        const x=p[d.id]||{niveau:'non_evalue',positives:[],ameliorations:[],remarque:''};
        const pos=x.positives.map(i=>d.positive[Number(i)]).filter(Boolean);
        const imp=x.ameliorations.map(i=>d.improve[Number(i)]).filter(Boolean);
        const hasContent=x.niveau && x.niveau!=='non_evalue' || pos.length || imp.length || x.remarque;
        if(!hasContent) return '';
        return `<div style="margin-bottom:16px;padding:10px;border:1px solid #ddd;border-radius:8px"><h3>${esc(d.name)}</h3><p><b>Niveau :</b> ${esc(levels[x.niveau]||levels.non_evalue)}</p>${pos.length?`<p><b>Points positifs :</b></p><ul>${pos.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}${imp.length?`<p><b>Axes d’amélioration :</b></p><ul>${imp.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>`:''}${x.remarque?`<p><b>Remarque personnelle :</b> ${esc(x.remarque)}</p>`:''}</div>`;
      }).join('');
      if(!cards && !p.remarqueGenerale) return '';
      return `<h2>Pratiques et attitudes en mathématiques</h2>${cards}${p.remarqueGenerale?`<h3>Remarque générale sur les pratiques de travail</h3><p>${esc(p.remarqueGenerale)}</p>`:''}`;
    },

  openPrintReport(title,html){ const w=window.open('','_blank','width=900,height=700'); if(!w){alert('Autorisez les fenêtres pop-up pour imprimer le rapport.');return;} w.document.write(`<html><head><title>${this.escapeHtml(title)}</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:35px;line-height:1.5}h1{margin-bottom:4px}h2{border-bottom:1px solid #ddd;padding-bottom:5px}@media print{body{padding:10px}}</style></head><body>${html}<script>window.onload=()=>window.print()<\/script></body></html>`); w.document.close(); },

  async printClassReport(){ const classes=await db.getAll('classes'), students=await db.getAll('students'), att=await db.getAll('attendance'); const rows=classes.map(c=>{const ss=students.filter(s=>s.classId===c.id&&!s.archived);const aa=att.filter(a=>a.classId===c.id);return `<tr><td>${this.escapeHtml(c.name)}</td><td>${ss.length}</td><td>${aa.filter(a=>a.status==='A').length}</td><td>${aa.filter(a=>a.status==='R').length}</td></tr>`}).join(''); this.openPrintReport(`Rapport de classe — ${this.activeSchoolYear}`,`<h1>Rapport global des classes</h1><p>Année scolaire : <b>${this.activeSchoolYear}</b></p><table border="1" cellspacing="0" cellpadding="8" width="100%"><tr><th>Classe</th><th>Élèves</th><th>Absences</th><th>Retards</th></tr>${rows}</table>`); }
};
Object.assign(AbsenceApp.prototype, methods);
