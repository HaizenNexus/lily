import { h, toast } from './ui.js';
import { state, save, newConv } from './store.js';
import { LilyService } from './services/lily-service.js';
import { chatView, cancelStream } from './views/chat.js';
import { studyView } from './views/study.js';
import { organizeView } from './views/organize.js';
import { historyView } from './views/history.js';
import { settingsView } from './views/settings.js';

const I = {
  chat: 'M4 5h16v11H9l-5 4z', study: 'M3 8l9-4 9 4-9 4zM7 10v5c0 1.5 2.2 3 5 3s5-1.5 5-3v-5',
  org: 'M5 4h14v16H5zM9 9l2 2 4-4M9 15h6', hist: 'M4 12a8 8 0 1 0 3-6.2M4 4v4h4M12 8v4l3 2', me: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z'
};
const ROUTES = {
  conversar: ['Conversar', I.chat, chatView], estudar: ['Estudar', I.study, studyView],
  organizacao: ['Organização', I.org, organizeView], historico: ['Histórico', I.hist, historyView], 'minha-lily': ['Minha LILY', I.me, settingsView]
};
const view = document.getElementById('view'), nav = document.getElementById('nav');
const go = hash => { location.hash = hash; };

nav.append(...Object.entries(ROUTES).map(([k, [label, d]]) => {
  const a = h('a', { href: '#/' + k, 'data-r': k }, label);
  a.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`);
  return a;
}));

function route() {
  const key = (location.hash.split('/')[1] || 'conversar');
  const [title, , render] = ROUTES[key] || ROUTES.conversar;
  cancelStream();
  view.replaceChildren();
  render(view, go);
  document.title = title + ' · LILY';
  nav.querySelectorAll('a').forEach(a => a.dataset.r === key ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'));
  menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false');
}

// Menu de configurações
const menu = document.getElementById('menu'), menuBtn = document.getElementById('menuBtn');
menuBtn.addEventListener('click', e => { e.stopPropagation(); menu.hidden = !menu.hidden; menuBtn.setAttribute('aria-expanded', String(!menu.hidden)); });
document.addEventListener('click', e => { if (!menu.contains(e.target)) { menu.hidden = true; menuBtn.setAttribute('aria-expanded', 'false'); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.hidden = true; menuBtn.focus(); } });
document.getElementById('menuNew').addEventListener('click', () => { newConv(); location.hash = '#/conversar'; route(); });

// Online/offline + presença
const mode = document.getElementById('mode'), presence = document.getElementById('presence');
LilyService.getAccessCode = () => { try { return localStorage.getItem('lily:code') || ''; } catch { return ''; } };
const PRESENCE = { ready: 'Pronta para conversar', 'no-config': 'IA ainda não configurada', unavailable: 'Servidor indisponível', offline: 'Sem internet · histórico disponível' };
async function status() {
  const on = navigator.onLine;
  mode.classList.toggle('off', !on); mode.lastElementChild.textContent = on ? 'Online' : 'Offline';
  presence.textContent = 'Verificando…';
  presence.textContent = PRESENCE[await LilyService.checkStatus()];
}
addEventListener('online', status); addEventListener('offline', status); status();

// Instalação como app
let deferred;
const installBtn = document.getElementById('menuInstall');
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; installBtn.hidden = false; });
installBtn.addEventListener('click', async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; installBtn.hidden = true; });
addEventListener('appinstalled', () => toast('LILY instalada!'));

addEventListener('hashchange', route);
route();
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
