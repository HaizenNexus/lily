import { h, fmtDate, toast } from '../ui.js';
import { state, save, newConv } from '../store.js';

export function historyView(root, go) {
  const list = h('div');
  function draw() {
    list.replaceChildren(...(state.convs.length ? state.convs.map(c => h('div', { class: 'conv' + (c.id === state.currentId ? ' cur' : '') },
      h('button', { class: 'main', onclick: () => { state.currentId = c.id; save(); go('#/conversar'); } }, h('b', {}, c.title), h('small', {}, `${c.messages.filter(m => m.role !== 'notice').length} mensagens · ${fmtDate(c.updated)}`)),
      h('button', { class: 'btn ghost sm', onclick: () => { const n = prompt('Novo nome da conversa:', c.title); if (n && n.trim()) { c.title = n.trim().slice(0, 60); save(); draw(); } } }, 'Renomear'),
      h('button', { class: 'btn danger sm', onclick: () => { if (confirm(`Excluir "${c.title}"?`)) { state.convs = state.convs.filter(x => x.id !== c.id); if (state.currentId === c.id) state.currentId = null; save(); draw(); toast('Conversa excluída'); } } }, 'Excluir')))
      : [h('p', { class: 'empty' }, 'Você ainda não tem conversas. Comece uma nova com a Lily.')]));
  }
  draw();
  root.append(h('div', { class: 'view' }, h('div', { class: 'scroll' }, h('div', { class: 'wrap' },
    h('div', { class: 'row' }, h('h1', {}, 'Histórico'), h('span', { class: 'spacer' }), h('button', { class: 'btn', onclick: () => { newConv(); go('#/conversar'); } }, 'Nova conversa')),
    h('p', { class: 'lead' }, 'Suas conversas anteriores com a Lily.'), list))));
}
