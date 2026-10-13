// État applicatif minimal, observable. Pas de variable globale.
export function createState(initial = {}) {
  let current = { ...initial };
  const subscribers = new Set();
  return {
    get: () => current,
    set(patch) { current = { ...current, ...patch }; subscribers.forEach(fn => fn(current)); },
    subscribe(fn) { subscribers.add(fn); return () => subscribers.delete(fn); }
  };
}
export const state = createState({ view: null, dbMode: 'inconnu', schoolYear: null });
