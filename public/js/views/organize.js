import { h, fmtDate } from '../ui.js';
import { state, save, uid } from '../store.js';

const TABS = [
  ['tarefa', 'Tarefas', 'Nova tarefa…'],
  ['lembrete', 'Lembretes', 'Lembrar de…'],
  ['nota', 'Anotações', 'Escreva sua anotação…']
];

export function organizeView(root) {
  let tab = 'tarefa';
  const list = h('div'), tabs = h('div', { class: 'tabs', role: 'tablist' });
  const text = h('textarea', { class: 'input', rows: 2, 'aria-label': 'Texto' });
  const when = h('input', { class: 'input', type: 'datetime-local', 'aria-label': 'Data e hora do lembrete' });
  const add = () => {
    const t = text.value.trim(); if (!t) return;
    state.items.unshift({ id: uid(), type: tab, text: t, when: tab === 'lembrete' && when.value ? when.value : null, done: false, ts: Date.now() });
    save(); text.value = ''; when.value = ''; draw();
  };
  text.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && tab !== 'nota') { e.preventDefault(); add(); } });

  function draw() {
    const [, , ph] = TABS.find(t => t[0] === tab);
    text.placeholder = ph; text.rows = tab === 'nota' ? 4 : 2; when.hidden = tab !== 'lembrete';
    tabs.replaceChildren(...TABS.map(([id, label]) => h('button', { role: 'tab', 'aria-selected': String(id === tab), onclick: () => { tab = id; draw(); } }, label)));
    const items = state.items.filter(i => i.type === tab);
    list.replaceChildren(...(items.length ? items.map(i => h('div', { class: 'item' + (i.done ? ' done' : '') },
      tab !== 'nota' ? h('input', { type: 'checkbox', checked: i.done, 'aria-label': 'Concluir', onchange: e => { i.done = e.target.checked; save(); draw(); } }) : null,
      h('div', { class: 't' }, i.text, i.when ? h('small', {}, 'Para ' + fmtDate(i.when)) : tab === 'nota' ? h('small', {}, fmtDate(i.ts)) : null),
      h('button', { class: 'x', 'aria-label': 'Excluir', onclick: () => { state.items = state.items.filter(x => x.id !== i.id); save(); draw(); } }, '×')))
      : [h('p', { class: 'empty' }, tab === 'tarefa' ? 'Nenhuma tarefa ainda. Adicione a primeira acima.' : tab === 'lembrete' ? 'Nenhum lembrete ainda.' : 'Nenhuma anotação ainda.')]));
  }
  draw();
  root.append(h('div', { class: 'view' }, h('div', { class: 'scroll' }, h('div', { class: 'wrap' },
    h('h1', {}, 'Minha organização'), h('p', { class: 'lead' }, 'Tudo fica salvo só neste aparelho.'),
    tabs, h('div', { class: 'card' }, h('div', { class: 'field' }, text), h('div', { class: 'row wrap-r' }, when, h('span', { class: 'spacer' }), h('button', { class: 'btn', type: 'button', onclick: add }, 'Adicionar'))),
    h('div', { style: 'height:8px' }), list))));
}
