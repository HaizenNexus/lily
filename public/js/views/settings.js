import { h, toast } from '../ui.js';
import { state, save, uid, resetAll } from '../store.js';
import { LilyService } from '../services/lily-service.js';
import { deviceCapabilities } from '../services/device-capabilities.js';

const STATUS_TEXT = {
  ready: 'Conectada: a Lily está pronta para responder.',
  'no-config': 'O servidor está no ar, mas ainda falta configurar a chave da IA ou o código de acesso.',
  unavailable: 'Não encontrei o servidor da Lily. Abra o app pelo endereço publicado na Vercel.',
  offline: 'Sem internet. O histórico e as preferências continuam disponíveis.'
};

export function settingsView(root) {
  const s = state.settings;
  const name = h('input', { class: 'input', id: 'nm', value: s.userName, maxlength: 40, oninput: e => { s.userName = e.target.value.trim() || 'Evellin'; save(); } });
  const tone = h('select', { class: 'input', id: 'tn', onchange: e => { s.tone = e.target.value; save(); } },
    [['carinhosa', 'Carinhosa e paciente'], ['objetiva', 'Mais objetiva']].map(([v, l]) => h('option', { value: v, selected: s.tone === v }, l)));
  const memList = h('div'), memText = h('textarea', { class: 'input', rows: 2, placeholder: 'Uma frase ou momento para a Lily guardar…', 'aria-label': 'Nova memória' });
  const drawMem = () => memList.replaceChildren(...(state.memories.length ? state.memories.map(m => h('div', { class: 'item' }, h('div', { class: 't' }, m.text),
    h('button', { class: 'x', 'aria-label': 'Excluir memória', onclick: () => { state.memories = state.memories.filter(x => x.id !== m.id); save(); drawMem(); } }, '×')))
    : [h('p', { class: 'empty' }, 'Nenhuma memória guardada ainda.')]));
  drawMem();

  const statusLine = h('p', { class: 'lead', role: 'status' }, 'Verificando a conexão…');
  const checkStatus = async () => { statusLine.textContent = 'Verificando a conexão…'; statusLine.textContent = STATUS_TEXT[await LilyService.checkStatus()]; };
  checkStatus();
  const code = h('input', { class: 'input', id: 'cd', type: 'password', autocomplete: 'off', placeholder: 'Código de acesso', value: (() => { try { return localStorage.getItem('lily:code') || ''; } catch { return ''; } })() });
  const saveCode = () => { try { localStorage.setItem('lily:code', code.value.trim()); toast('Código salvo'); } catch { toast('Não foi possível salvar o código'); } checkStatus(); };

  const caps = h('p', { class: 'lead' }, 'Verificando este aparelho…');
  deviceCapabilities().then(c => {
    caps.textContent = `Ainda não existe modelo local: sem internet, a Lily não consegue responder. Este aparelho: WebGPU ${c.webgpu ? 'disponível' : 'indisponível'}`
      + (c.memoryGB ? `, cerca de ${c.memoryGB} GB de memória` : '') + (c.cores ? `, ${c.cores} núcleos` : '') + (c.freeStorageMB != null ? `, ${c.freeStorageMB} MB livres para armazenamento` : '') + '.';
  });

  root.append(h('div', { class: 'view' }, h('div', { class: 'scroll' }, h('div', { class: 'wrap' },
    h('h1', {}, 'Minha LILY'), statusLine,
    h('div', { class: 'card' },
      h('div', { class: 'field' }, h('label', { for: 'nm' }, 'Como a Lily deve te chamar'), name),
      h('div', { class: 'field' }, h('label', { for: 'tn' }, 'Jeito de conversar'), tone),
      h('label', { class: 'switch' }, h('span', {}, 'Carinhas e expressões', h('small', {}, ';-;  :3  ^^  KKKKK, só quando combinar com a conversa')),
        h('input', { type: 'checkbox', checked: s.expressions, onchange: e => { s.expressions = e.target.checked; save(); } })),
      h('label', { class: 'switch' }, h('span', {}, 'Usar minhas memórias nas respostas', h('small', {}, 'Só as frases da lista abaixo vão para a IA. O histórico de conversas fica neste aparelho.')),
        h('input', { type: 'checkbox', checked: s.useMemories, onchange: e => { s.useMemories = e.target.checked; save(); } }))),
    h('h2', {}, 'Acesso'),
    h('div', { class: 'card' }, h('div', { class: 'field' }, h('label', { for: 'cd' }, 'Código de acesso da Lily'), code),
      h('div', { class: 'row' }, h('span', { class: 'spacer' }), h('button', { class: 'btn', onclick: saveCode }, 'Salvar e testar'))),
    h('h2', { id: 'memoria' }, 'Memória'),
    h('p', { class: 'lead' }, 'Frases e momentos que a Lily poderá recordar com você.'),
    h('div', { class: 'card' }, memText, h('div', { class: 'row', style: 'margin-top:10px' }, h('span', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => { const t = memText.value.trim(); if (!t) return; state.memories.unshift({ id: uid(), text: t.slice(0, 300) }); save(); memText.value = ''; drawMem(); toast('Memória guardada'); } }, 'Guardar')), memList),
    h('h2', {}, 'Modo offline'), caps,
    h('h2', {}, 'Dados'),
    h('button', { class: 'btn danger', onclick: () => { if (confirm('Apagar conversas, tarefas, memórias, preferências e o código de acesso deste aparelho?')) resetAll(); } }, 'Apagar tudo deste aparelho')))));
  if (location.hash.endsWith('/memoria')) setTimeout(() => document.getElementById('memoria')?.scrollIntoView(), 0);
}
