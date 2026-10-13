import { h } from '../core/dom.js';
export const Toast = {
  show(message, type = 'info', duration = 2800) {
    const host = document.getElementById('toast-host');
    if (!host) { console.warn(message); return; }
    const el = h('div', { class: `app-toast app-toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
    host.append(el);
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 220); }, duration);
  }
};
