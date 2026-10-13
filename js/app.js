/** Entrée V7 modulaire. Les modules sont chargés dans l’ordre requis par les extensions historiques. */
import { AbsenceApp } from './core/AbsenceApp.js';
import { db } from './core/database.js';
import './modules/lifecycle-profile.js';
import './modules/data-backup.js';
import './modules/ui-navigation.js';
import './modules/dashboard-search.js';
import './modules/attendance-schedule.js';
import './modules/students-classes.js';
import './modules/pedagogical-followup.js';
import './modules/calendar-journal.js';
import './modules/activities.js';
import './modules/statistics-history.js';
import './extensions/v47-enhancements.js';
import './extensions/v50-initialization.js';
import './extensions/v51-activity-settings.js';
import './extensions/collective-activity.js';

const app = new AbsenceApp();
window.app = app;
window.db = db;
document.addEventListener('DOMContentLoaded', () => app.init());
