/** Extension V7 conservée dans l’ordre d’application historique. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

(() => {
  const proto = AbsenceApp.prototype;

  const _renderActivitySettings_v51 = proto.renderActivitySettings;
  proto.renderActivitySettings = async function() {
    await _renderActivitySettings_v51.call(this);
    if (this.currentStudentDetailId && document.getElementById('student-activity-manager')) {
      await this.renderStudentActivityManager(this.currentStudentDetailId);
    }
  };

  const _saveActivityAction_v51 = proto.saveActivityAction;
  proto.saveActivityAction = async function() {
    await _saveActivityAction_v51.call(this);
    if (this.currentStudentDetailId && document.getElementById('student-activity-manager')) {
      await this.renderStudentActivityManager(this.currentStudentDetailId);
    }
  };

  const _deleteActivityAction_v51 = proto.deleteActivityAction;
  proto.deleteActivityAction = async function(id) {
    await _deleteActivityAction_v51.call(this,id);
    if (this.currentStudentDetailId && document.getElementById('student-activity-manager')) {
      await this.renderStudentActivityManager(this.currentStudentDetailId);
    }
  };

  const _deleteActivityCategory_v51 = proto.deleteActivityCategory;
  proto.deleteActivityCategory = async function(id) {
    await _deleteActivityCategory_v51.call(this,id);
    if (this.currentStudentDetailId && document.getElementById('student-activity-manager')) {
      await this.renderStudentActivityManager(this.currentStudentDetailId);
    }
  };
})();
