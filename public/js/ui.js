import lilyAvatar from '../assets/lily-avatar.png';

export const AVATAR = lilyAvatar;

/** Cria elementos DOM sem innerHTML (evita injeção de HTML vindo do usuário). */
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

export const avatar = (size = 'sm') =>
  h('img', { class: `avatar avatar-${size}`, src: AVATAR, alt: '', width: size === 'sm' ? 34 : 44, height: size === 'sm' ? 34 : 44, loading: 'lazy' });

let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 2400);
}

export const fmtDate = ts => new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
