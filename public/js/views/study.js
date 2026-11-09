import { h } from '../ui.js';
import { newConv, save } from '../store.js';

const TOOLS = [
  { id: 'pesquisa', name: 'Pesquisa escolar', desc: 'Organizar o tema e o que buscar. A Lily ainda não pesquisa na internet.', label: 'Tema da pesquisa', make: (t, n) => `Quero fazer uma pesquisa escolar sobre "${t}". ${n ? 'Detalhes: ' + n + '. ' : ''}Me ajuda a montar a estrutura e indicar o que pesquisar?` },
  { id: 'explicar', name: 'Explicar matéria', desc: 'Entender um conteúdo com calma.', label: 'Qual matéria ou assunto?', make: (t, n) => `Pode me explicar "${t}" com calma, passo a passo e com exemplos? ${n}` },
  { id: 'resumo', name: 'Resumos', desc: 'Transformar um conteúdo em resumo.', label: 'O que deve ser resumido?', make: (t, n) => `Faça um resumo de "${t}". ${n ? 'Preferência: ' + n : ''}` },
  { id: 'trabalho', name: 'Organizar trabalho', desc: 'Dividir um trabalho em etapas.', label: 'Qual é o trabalho?', make: (t, n) => `Preciso organizar o trabalho "${t}". ${n ? 'Prazo/observações: ' + n + '. ' : ''}Me ajuda a dividir em etapas?` },
  { id: 'revisao', name: 'Revisar conteúdo', desc: 'Praticar com perguntas e revisão.', label: 'O que você quer revisar?', make: (t, n) => `Quero revisar "${t}". Pode me fazer perguntas para eu treinar? ${n}` }
];

export function studyView(root, go) {
  let sel = TOOLS[0];
  const form = h('div');
  const grid = h('div', { class: 'grid' });

  function drawForm() {
    const topic = h('input', { class: 'input', id: 'st', placeholder: 'Escreva aqui…', required: true });
    const note = h('textarea', { class: 'input', id: 'sn', placeholder: 'Ex.: nível do 2º ano, prazo, pontos que tenho dúvida…' });
    form.replaceChildren(h('form', { class: 'card', onsubmit: e => {
      e.preventDefault();
      const c = newConv(sel.name + ': ' + topic.value.slice(0, 30));
      save();
      sessionStorage.setItem('lily:pending', sel.make(topic.value.trim(), note.value.trim()).trim());
      go('#/conversar');
    } },
      h('h2', { style: 'margin-top:0' }, sel.name),
      h('div', { class: 'field' }, h('label', { for: 'st' }, sel.label), topic),
      h('div', { class: 'field' }, h('label', { for: 'sn' }, 'Detalhes (opcional)'), note),
      h('button', { class: 'btn', type: 'submit' }, 'Montar pedido para a Lily')));
  }
  function drawGrid() {
    grid.replaceChildren(...TOOLS.map(t => h('button', { class: 'tool', type: 'button', 'aria-pressed': String(t === sel), onclick: () => { sel = t; drawGrid(); drawForm(); } }, h('b', {}, t.name), h('span', {}, t.desc))));
  }
  drawGrid(); drawForm();
  root.append(h('div', { class: 'view' }, h('div', { class: 'scroll' }, h('div', { class: 'wrap' },
    h('h1', {}, 'Estudar'), h('p', { class: 'lead' }, 'Escolha o tipo de ajuda. O pedido fica pronto na conversa para você revisar antes de enviar.'),
    grid, h('div', { style: 'height:16px' }), form))));
}
