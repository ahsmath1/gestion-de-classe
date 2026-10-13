// Délégation d'événements : remplace les onclick="app.xxx()" de la V6 sans variable globale.
// Un élément déclare data-action="nom" (et data-on="input|change" si ce n'est pas un clic).
const registry = new Map();
const attached = new WeakMap();   // racine -> ensemble de types déjà écoutés
let errorHandler = (e) => console.error(e);

export function setErrorHandler(fn) { errorHandler = fn; }

export function action(name, fn) {
  if (registry.has(name)) throw new Error(`Action déjà définie : ${name}`);
  registry.set(name, fn);
}

export function attach(root = document, types = ['click', 'change', 'input']) {
  let done = attached.get(root);
  if (!done) { done = new Set(); attached.set(root, done); }
  for (const type of types) {
    if (done.has(type)) continue;            // jamais deux écouteurs du même type sur une racine
    done.add(type);
    root.addEventListener(type, async (ev) => {
      const el = ev.target instanceof Element ? ev.target.closest('[data-action]') : null;
      if (!el || !root.contains(el) || el.disabled) return;
      if ((el.dataset.on || 'click') !== ev.type) return;
      const fn = registry.get(el.dataset.action);
      if (!fn) { errorHandler(new Error(`Action inconnue : ${el.dataset.action}`)); return; }
      try { await fn(el, ev); } catch (e) { errorHandler(e); }
    });
  }
}
