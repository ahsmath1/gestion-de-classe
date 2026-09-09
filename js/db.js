/**
 * Module IndexedDB - AbsenceAppDB
 */
const DB_NAME = 'AbsenceAppDB';
const DB_VERSION = 5;

class AppDatabase {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('students')) {
          const studentStore = db.createObjectStore('students', { keyPath: 'id' });
          studentStore.createIndex('classId', 'classId', { unique: false });
        }
        if (!db.objectStoreNames.contains('timetable')) {
          const ttStore = db.createObjectStore('timetable', { keyPath: 'id' });
          ttStore.createIndex('day', 'day', { unique: false });
        }
        if (!db.objectStoreNames.contains('attendance')) {
          const attStore = db.createObjectStore('attendance', { keyPath: 'id' });
          attStore.createIndex('date', 'date', { unique: false });
          attStore.createIndex('studentId', 'studentId', { unique: false });
          attStore.createIndex('courseId', 'courseId', { unique: false });
        }
        if (!db.objectStoreNames.contains('calendar')) {
          db.createObjectStore('calendar', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('date', 'date', { unique: false });
          sessionStore.createIndex('courseId', 'courseId', { unique: false });
        }
        if (!db.objectStoreNames.contains('activityCategories')) {
          const store = db.createObjectStore('activityCategories', { keyPath: 'id' });
          store.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains('activityActions')) {
          const store = db.createObjectStore('activityActions', { keyPath: 'id' });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('order', 'order', { unique: false });
        }
        if (!db.objectStoreNames.contains('activityEvents')) {
          const store = db.createObjectStore('activityEvents', { keyPath: 'id' });
          store.createIndex('studentId', 'studentId', { unique: false });
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('categoryId', 'categoryId', { unique: false });
          store.createIndex('actionId', 'actionId', { unique: false });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.seedInitialData().then(() => resolve(this));
      };

      request.onerror = (event) => reject(event.target.error);
    });
  }

  async seedInitialData() {
    // Valeurs initiales / migration idempotente : elles sont ajoutées si absentes
    // et les éléments de référence portant un ID connu sont corrigés si nécessaire.
    const defaultClasses = [
      { id: '2AC-12', name: '2AC-12' },
      { id: '3AC-12', name: '3AC-12' },
      { id: '3AC-13', name: '3AC-13' },
      { id: '3AC-14', name: '3AC-14' }
    ];
    for (const cls of defaultClasses) {
      if (!(await this.get('classes', cls.id))) await this.put('classes', cls);
    }

    // Emploi du temps de référence fourni par l'enseignant.
    const defaultTimetable = [
      { id: 'c_lun_1', day: 1, startTime: '08:30', endTime: '09:30', classId: '3AC-13' },
      { id: 'c_lun_2', day: 1, startTime: '09:30', endTime: '10:30', classId: '3AC-12' },
      { id: 'c_lun_3', day: 1, startTime: '10:30', endTime: '11:30', classId: '2AC-12' },
      { id: 'c_lun_4', day: 1, startTime: '11:30', endTime: '12:30', classId: '3AC-14' },
      { id: 'c_mar_1', day: 2, startTime: '14:30', endTime: '15:30', classId: '3AC-12' },
      { id: 'c_mar_2', day: 2, startTime: '15:30', endTime: '16:30', classId: '2AC-12' },
      { id: 'c_mar_3', day: 2, startTime: '16:30', endTime: '17:30', classId: '3AC-13' },
      { id: 'c_mar_4', day: 2, startTime: '17:30', endTime: '18:30', classId: '3AC-14' },
      { id: 'c_mer_1', day: 3, startTime: '15:30', endTime: '16:30', classId: '3AC-13' },
      { id: 'c_mer_2', day: 3, startTime: '16:30', endTime: '17:30', classId: '3AC-12' },
      { id: 'c_jeu_1', day: 4, startTime: '10:30', endTime: '11:30', classId: '3AC-13' },
      { id: 'c_jeu_2', day: 4, startTime: '11:30', endTime: '12:30', classId: '2AC-12' },
      { id: 'c_ven_1', day: 5, startTime: '14:30', endTime: '16:30', classId: '3AC-14' },
      { id: 'c_ven_2', day: 5, startTime: '16:30', endTime: '17:30', classId: '2AC-12' },
      { id: 'c_ven_3', day: 5, startTime: '17:30', endTime: '18:30', classId: '3AC-12' },
      { id: 'c_sam_1', day: 6, startTime: '08:30', endTime: '09:30', classId: '2AC-12' },
      { id: 'c_sam_2', day: 6, startTime: '09:30', endTime: '10:30', classId: '3AC-12' },
      { id: 'c_sam_3', day: 6, startTime: '10:30', endTime: '11:30', classId: '3AC-13' },
      { id: 'c_sam_4', day: 6, startTime: '11:30', endTime: '12:30', classId: '3AC-14' }
    ];
    // Ajouter les créneaux de référence uniquement s'ils sont absents.
    // Une modification faite par l'enseignant ne doit jamais être écrasée
    // lors d'un simple rechargement ou après une restauration.
    for (const course of defaultTimetable) {
      if (!(await this.get('timetable', course.id))) await this.put('timetable', course);
    }

    // Calendrier de référence 2026/2027. Les fêtes religieuses dont la date
    // grégorienne dépend de l'observation lunaire sont indiquées comme
    // "date indicative" et restent modifiables depuis l'application.
    const defaultCalendar = [
      { id: 'cal_start', title: 'Début effectif obligatoire des cours', startDate: '2026-09-07', endDate: '2026-09-07', type: 'event' },
      { id: 'cal_1', title: 'Première période inter-vacances', startDate: '2026-10-18', endDate: '2026-10-25', type: 'vacation' },
      { id: 'cal_2', title: 'Fête de l’Unité', startDate: '2026-10-31', endDate: '2026-10-31', type: 'holiday' },
      { id: 'cal_3', title: 'Marche Verte', startDate: '2026-11-06', endDate: '2026-11-06', type: 'holiday' },
      { id: 'cal_4', title: 'Fête de l’Indépendance', startDate: '2026-11-18', endDate: '2026-11-18', type: 'holiday' },
      { id: 'cal_5', title: 'Deuxième période inter-vacances', startDate: '2026-12-06', endDate: '2026-12-13', type: 'vacation' },
      { id: 'cal_6', title: 'Nouvel An', startDate: '2027-01-01', endDate: '2027-01-01', type: 'holiday' },
      { id: 'cal_7', title: 'Manifeste de l’Indépendance', startDate: '2027-01-11', endDate: '2027-01-11', type: 'holiday' },
      { id: 'cal_8', title: 'Nouvel An Amazigh', startDate: '2027-01-14', endDate: '2027-01-14', type: 'holiday' },
      { id: 'cal_9', title: 'Vacances de mi-année', startDate: '2027-01-24', endDate: '2027-01-31', type: 'vacation' },
      { id: 'cal_10', title: 'Troisième période inter-vacances', startDate: '2027-03-21', endDate: '2027-03-28', type: 'vacation' },
      { id: 'cal_11', title: 'Aïd Al Fitr — date indicative à confirmer', startDate: '2027-03-08', endDate: '2027-03-11', type: 'holiday' },
      { id: 'cal_12', title: 'Fête du Travail', startDate: '2027-05-01', endDate: '2027-05-01', type: 'holiday' },
      { id: 'cal_13', title: 'Quatrième période inter-vacances', startDate: '2027-05-09', endDate: '2027-05-16', type: 'vacation' },
      { id: 'cal_14', title: 'Aïd Al Adha — date indicative à confirmer', startDate: '2027-05-15', endDate: '2027-05-17', type: 'holiday' },
      { id: 'cal_15', title: '1er Mouharram — date indicative à confirmer', startDate: '2027-06-06', endDate: '2027-06-06', type: 'holiday' }
    ];
    const existingCalendar = await this.getAll('calendar');
    if (existingCalendar.length === 0) {
      for (const ev of defaultCalendar) await this.put('calendar', ev);
    } else {
      // IMPORTANT : ne jamais réécrire les événements du calendrier à chaque
      // démarrage. L'ancienne version appliquait des "correctifs" à des IDs
      // qui avaient entre-temps changé de rôle, ce qui créait des doublons
      // (ex. deux fois "Troisième période inter-vacances").
      //
      // Cette migration unique répare uniquement les valeurs manifestement
      // issues de cette ancienne anomalie, puis ne touche plus au calendrier.
      const migrationKey = 'calendarMigrationV3';
      const alreadyMigrated = await this.get('settings', migrationKey);
      if (!alreadyMigrated) {
        const exactLegacyRows = {
          cal_2: { title: 'Aïd Al Mawlid', startDate: '2026-08-25', endDate: '2026-08-26', type: 'holiday' },
          cal_3: { title: 'Première période inter-vacances', startDate: '2026-10-18', endDate: '2026-10-25', type: 'vacation' },
          cal_9: { title: 'Troisième période inter-vacances', startDate: '2027-03-21', endDate: '2027-03-28', type: 'vacation' },
          cal_12: { title: 'Quatrième période inter-vacances', startDate: '2027-05-09', endDate: '2027-05-16', type: 'vacation' },
          cal_13: { title: 'Aïd Al Adha — date indicative à confirmer', startDate: '2027-05-15', endDate: '2027-05-17', type: 'holiday' },
          cal_14: { title: '1er Mouharram — date indicative à confirmer', startDate: '2027-06-06', endDate: '2027-06-06', type: 'holiday' }
        };
        const canonicalById = Object.fromEntries(defaultCalendar.map(ev => [ev.id, ev]));
        for (const [id, legacy] of Object.entries(exactLegacyRows)) {
          const current = await this.get('calendar', id);
          const isExactLegacy = current && ['title','startDate','endDate','type'].every(k => current[k] === legacy[k]);
          if (isExactLegacy && canonicalById[id]) await this.put('calendar', { ...current, ...canonicalById[id] });
        }

        // Supprime uniquement le doublon connu cal_15 créé par l'ancienne
        // migration si cal_14 contient déjà exactement le même événement.
        const cal14 = await this.get('calendar', 'cal_14');
        const cal15 = await this.get('calendar', 'cal_15');
        if (cal14 && cal15 &&
            cal14.title === cal15.title && cal14.startDate === cal15.startDate &&
            cal14.endDate === cal15.endDate && cal14.type === cal15.type) {
          await this.delete('calendar', 'cal_15');
        }

        // Ajouter les événements de référence manquants, sans jamais remplacer
        // un événement personnalisé existant.
        const afterMigration = await this.getAll('calendar');
        if (afterMigration.length === 0) {
          for (const ev of defaultCalendar) await this.put('calendar', ev);
        } else {
          for (const ev of defaultCalendar) {
            if (!(await this.get('calendar', ev.id))) await this.put('calendar', ev);
          }
        }
        await this.put('settings', { key: migrationKey, value: true });
      }
    }


    // Configuration initiale du module « Activités et comportement ».
    // Elle n'est créée que si l'utilisateur n'a pas encore de configuration.
    const existingActivityCategories = await this.getAll('activityCategories');
    if (existingActivityCategories.length === 0) {
      const defaultActivityCategories = [
        { id:'act_mat', name:'Matériel et préparation', icon:'📚', maxPoints:5, order:1, active:true },
        { id:'act_home', name:'Travail à domicile', icon:'📝', maxPoints:5, order:2, active:true },
        { id:'act_part', name:'Participation et engagement', icon:'🙋', maxPoints:5, order:3, active:true },
        { id:'act_group', name:'Coopération et travail collectif', icon:'🤝', maxPoints:5, order:4, active:true }
      ];
      const defaultActivityActions = [
        {id:'acta_book',categoryId:'act_mat',name:'Livre scolaire absent',penalty:0.5,order:1,active:true},
        {id:'acta_notebook',categoryId:'act_mat',name:'Cahier absent',penalty:0.5,order:2,active:true},
        {id:'acta_material',categoryId:'act_mat',name:'Matériel incomplet',penalty:0.5,order:3,active:true},
        {id:'acta_homework',categoryId:'act_home',name:'Devoir non fait',penalty:1,order:1,active:true},
        {id:'acta_late',categoryId:'act_home',name:'Devoir en retard',penalty:0.5,order:2,active:true},
        {id:'acta_incomplete',categoryId:'act_home',name:'Travail incomplet',penalty:0.5,order:3,active:true},
        {id:'acta_consigne',categoryId:'act_home',name:'Consignes non respectées',penalty:0.5,order:4,active:true},
        {id:'acta_participation',categoryId:'act_part',name:'Participation insuffisante',penalty:0.5,order:1,active:true},
        {id:'acta_listen',categoryId:'act_part',name:'Manque d’écoute',penalty:0.5,order:2,active:true},
        {id:'acta_refuse',categoryId:'act_part',name:'Refus de participer',penalty:0.5,order:3,active:true},
        {id:'acta_group_refuse',categoryId:'act_group',name:'Refus du travail de groupe',penalty:0.5,order:1,active:true},
        {id:'acta_group_no',categoryId:'act_group',name:'Ne participe pas au travail collectif',penalty:0.5,order:2,active:true},
        {id:'acta_respect',categoryId:'act_group',name:'Ne respecte pas les autres',penalty:0.5,order:3,active:true}
      ];
      for (const c of defaultActivityCategories) await this.put('activityCategories', c);
      for (const a of defaultActivityActions) await this.put('activityActions', a);
    }
    // Ne jamais écraser les réglages personnalisés au démarrage.
    if (!(await this.get('settings', 'activityMaxScore'))) {
      await this.put('settings', { key: 'activityMaxScore', value: 20 });
    }

    // Marqueur de version de l'application : uniquement initialisé s'il n'existe pas.
    if (!(await this.get('settings', 'appVersion'))) {
      await this.put('settings', { key: 'appVersion', value: '3.4.0' });
    }
    if (!(await this.get('settings', 'schoolStart'))) {
      await this.put('settings', { key: 'schoolStart', value: '2026-09-07' });
    }
    if (!(await this.get('settings', 'schoolEnd'))) {
      await this.put('settings', { key: 'schoolEnd', value: '2027-07-10' });
    }

    // Profil enseignant : les données restent locales à cet appareil/navigateur.
    if (!(await this.get('settings', 'teacherName'))) {
      await this.put('settings', { key: 'teacherName', value: '' });
    }
    if (!(await this.get('settings', 'profileConfigured'))) {
      await this.put('settings', { key: 'profileConfigured', value: false });
    }
    if (!(await this.get('settings', 'teacherSubject'))) await this.put('settings', { key: 'teacherSubject', value: 'Mathématiques' });
    if (!(await this.get('settings', 'appName'))) await this.put('settings', { key: 'appName', value: 'Gestion de classe' });
    if (!(await this.get('settings', 'language'))) await this.put('settings', { key: 'language', value: 'fr' });
    if (!(await this.get('settings', 'teacherSubject'))) {
      await this.put('settings', { key: 'teacherSubject', value: 'Mathématiques' });
    }
    if (!(await this.get('settings', 'appName'))) {
      await this.put('settings', { key: 'appName', value: 'Gestion de classe' });
    }
    if (!(await this.get('settings', 'language'))) {
      await this.put('settings', { key: 'language', value: 'fr' });
    }
  }

  // Méthodes génériques
  async getAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async put(storeName, item) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(item);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async delete(storeName, key) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async clearStore(storeName) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

const db = new AppDatabase();
