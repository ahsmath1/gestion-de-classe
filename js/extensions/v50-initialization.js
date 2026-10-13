/** Extension V7 conservée dans l’ordre d’application historique. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

(() => {
  const proto = AbsenceApp.prototype;
  const _init_v50 = proto.init;
  proto.init = async function() {
    await _init_v50.call(this);
    // Marqueur lisible par l'interface et les sauvegardes.
    await db.put('settings',{key:'appVersion',value:'7.0.0-compat'});
    await db.put('settings',{key:'dbSchemaVersion',value:8});
    this.showSaveIndicator();
  };
})();
