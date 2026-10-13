// Routeur : une seule vue active, rendu attendu, protection contre les rendus périmés.
export class Router {
  constructor({ onError = (e) => console.error(e) } = {}) {
    this.views = new Map();
    this.current = null;
    this.token = 0;
    this.onError = onError;
  }

  register(id, view) {
    if (this.views.has(id)) throw new Error(`Vue déjà enregistrée : ${id}`);
    if (typeof view?.render !== 'function') throw new Error(`La vue ${id} n'a pas de méthode render().`);
    this.views.set(id, view);
  }

  async navigate(id, params = {}) {
    const view = this.views.get(id);
    if (!view) throw new Error(`Vue inconnue : ${id}`);
    const section = document.getElementById(id);
    if (!section) throw new Error(`Section HTML absente : ${id}`);
    const token = ++this.token;
    const previous = this.views.get(this.current);
    if (previous?.leave) { try { await previous.leave(); } catch (e) { this.onError(e); } }
    document.querySelectorAll('section.view').forEach(s => s.classList.toggle('active', s === section));
    this.current = id;
    window.scrollTo(0, 0);
    try {
      // isStale() devient vrai dès qu'une autre navigation a démarré : la vue doit alors ne rien écrire.
      await view.render(params, { isStale: () => token !== this.token });
    } catch (e) { this.onError(e); }
  }
}
