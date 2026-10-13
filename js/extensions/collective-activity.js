/** Extension V7 conservée dans l’ordre d’application historique. */
import { AbsenceApp } from '../core/AbsenceApp.js';
import { db } from '../core/database.js';

(() => {
  const proto = AbsenceApp.prototype;
  // --- Action collective pendant l'appel : pénalité/récompense pour tous les présents ---
  proto.openBulkActivityModal = async function() {
    if (!this.activeCourse || !this.rollcallState) {
      alert('Aucun appel n’est actuellement ouvert.');
      return;
    }
    const presentCount = Object.values(this.rollcallState).filter(s => s === null).length;
    const countEl = document.getElementById('bulk-activity-count');
    if (countEl) countEl.innerHTML = `👥 <b>${presentCount}</b> élève${presentCount > 1 ? 's' : ''} présent${presentCount > 1 ? 's' : ''} seront concernés.`;
    const select = document.getElementById('bulk-activity-action');
    if (!select) return;

    const {categories, actions} = await this.getActivityConfig();
    const activeCategories = categories.filter(c => c.active !== false);
    const activeActions = actions
      .filter(a => a.active !== false)
      .sort((a,b) => {
        const ca = activeCategories.find(c => c.id === a.categoryId);
        const cb = activeCategories.find(c => c.id === b.categoryId);
        return String(ca?.name || '').localeCompare(String(cb?.name || ''), 'fr') ||
               String(a.name || '').localeCompare(String(b.name || ''), 'fr');
      });

    if (!activeActions.length) {
      alert('Aucune action n’est configurée. Ajoutez d’abord une pénalité ou une récompense dans « Configurer les activités ».');
      return;
    }

    select.innerHTML = activeActions.map(a => {
      const cat = activeCategories.find(c => c.id === a.categoryId);
      const reward = a.type === 'reward';
      const sign = reward ? '+' : '−';
      const icon = reward ? '➕' : '➖';
      return `<option value="${this.escapeHtml(a.id)}">${icon} ${this.escapeHtml(cat?.name || 'Sans catégorie')} — ${this.escapeHtml(a.name)} (${sign}${Number(a.penalty || 0).toFixed(2)})</option>`;
    }).join('');

    this.openModal('modal-bulk-activity');
  };

  proto.applyBulkActivityAction = async function() {
    if (!this.activeCourse || !this.rollcallState) return;
    const actionId = document.getElementById('bulk-activity-action')?.value;
    const action = actionId ? await db.get('activityActions', actionId) : null;
    if (!action || action.active === false) {
      alert('Action introuvable ou inactive.');
      return;
    }

    const presentIds = Object.entries(this.rollcallState)
      .filter(([, status]) => status === null)
      .map(([studentId]) => studentId);

    if (!presentIds.length) {
      alert('Aucun élève présent à l’appel.');
      return;
    }

    const categories = await db.getAll('activityCategories');
    const category = categories.find(c => c.id === action.categoryId);
    const maxScore = Number((await db.get('settings','activityMaxScore'))?.value || 20);
    const allEvents = await db.getAll('activityEvents');
    const today = this.activeCourse.date;
    const isReward = action.type === 'reward';
    const amount = Number(action.penalty || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Le nombre de points de l’action est invalide.');
      return;
    }

    const label = `${isReward ? '+' : '−'}${amount.toFixed(2)} ${action.name}`;
    if (!confirm(`Appliquer « ${label} » à ${presentIds.length} élève${presentIds.length > 1 ? 's' : ''} présent${presentIds.length > 1 ? 's' : ''} ?`)) return;

    let applied = 0, skipped = 0;
    for (const studentId of presentIds) {
      const events = allEvents.filter(e => e.studentId === studentId && !e.archivedAt);
      const adjustment = events.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
      const currentScore = Math.max(0, Math.min(maxScore, maxScore - adjustment));

      if (isReward) {
        if (currentScore >= maxScore - 1e-9) { skipped++; continue; }
        const rewardAmount = Math.min(amount, maxScore - currentScore);
        await db.put('activityEvents', {
          id:`acte_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          studentId,
          categoryId:action.categoryId,
          actionId:action.id,
          penalty:-rewardAmount,
          date:today,
          createdAt:new Date().toISOString(),
          type:'reward'
        });
        applied++;
      } else {
        const categoryEvents = events.filter(e => e.categoryId === action.categoryId);
        const categoryAdjustment = categoryEvents.reduce((sum,e) => sum + Number(e.penalty || 0), 0);
        const remaining = Math.max(0, Number(category?.maxPoints || 0) - categoryAdjustment);
        if (remaining <= 1e-9 || amount > remaining + 1e-9 || currentScore <= 0) {
          skipped++;
          continue;
        }
        const penaltyAmount = Math.min(amount, remaining, currentScore);
        await db.put('activityEvents', {
          id:`acte_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          studentId,
          categoryId:action.categoryId,
          actionId:action.id,
          penalty:penaltyAmount,
          date:today,
          createdAt:new Date().toISOString(),
          type:'penalty'
        });
        applied++;
      }
    }

    await this.registerChange();
    this.closeModal('modal-bulk-activity');
    this.showSaveIndicator();
    await this.renderDashboard();
    if (typeof this.renderActivitiesView === 'function') await this.renderActivitiesView();

    const message = isReward
      ? `Récompense appliquée à ${applied} élève${applied > 1 ? 's' : ''}${skipped ? ` · ${skipped} non appliqué${skipped > 1 ? 's' : ''} (note déjà au maximum)` : ''}.`
      : `Pénalité appliquée à ${applied} élève${applied > 1 ? 's' : ''}${skipped ? ` · ${skipped} non appliquée${skipped > 1 ? 's' : ''} (budget de catégorie ou note atteint)` : ''}.`;
    alert(message);
  };

  const _init_bulk_activity = proto.init;
  proto.init = async function() {
    await _init_bulk_activity.call(this);
    document.getElementById('btn-bulk-activity')?.addEventListener('click', () => this.openBulkActivityModal());
  };

})();
