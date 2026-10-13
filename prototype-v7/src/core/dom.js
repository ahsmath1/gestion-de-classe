// Rendu sûr : jamais d'innerHTML. Les textes passent par des nœuds texte.
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction']);
const FORBIDDEN = new Set(['style', 'innerhtml', 'outerhtml', 'srcdoc']);

function toNode(c) { return c instanceof Node ? c : document.createTextNode(String(c)); }
function flatten(children) { return children.flat(Infinity).filter(c => c !== null && c !== undefined && c !== false); }

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    const key = k.toLowerCase();
    if (key.startsWith('on')) throw new Error(`Gestionnaire en ligne interdit (${k}) : utiliser data-action.`);
    if (FORBIDDEN.has(key)) throw new Error(`Attribut interdit : ${k}`);
    if (k === 'class') el.className = String(v);
    else if (k === 'text') el.textContent = String(v);
    else if (k === 'dataset') { for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = String(dv); }
    else {
      if (URL_ATTRS.has(key) && /^\s*(javascript|data|vbscript):/i.test(String(v))) throw new Error(`URL interdite dans ${k}`);
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  el.append(...flatten(children).map(toNode));
  return el;
}

export function mount(parent, ...children) { parent.replaceChildren(...flatten(children).map(toNode)); }
