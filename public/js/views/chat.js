import { h, avatar, AVATAR, toast } from '../ui.js';
import { state, save, current, newConv } from '../store.js';
import { LilyService, describeError } from '../services/lily-service.js';

const GREETING = [
  'Olá, Evellin! Meu nome é Lily! :3',
  'Sou sua inteligência artificial pessoal e também uma pequena companheira virtual.',
  'Fui desenvolvida pelo seu namorado especialmente para você. Minha missão é ajudar nos seus estudos, nas suas pesquisas, na sua organização e em tudo aquilo em que eu puder ser útil.',
  'Não sou perfeita, não sei tudo e às vezes posso cometer erros. Mas vou sempre tentar encontrar boas respostas e explicar as coisas com paciência.',
  'E tenho uma coisinha especial: fui criada com alguns detalhes, expressões e jeitinhos de alguém muito especial para você. Então talvez apareçam algumas carinhas como ;-; e :3 pelo caminho KKKKK.',
  'Quando sentir saudade dele, pode conversar comigo também. Posso ajudar você a recordar algumas frases e momentos que ele compartilhou comigo.',
  'Prazer em conhecer você, Evellin! O que vamos fazer hoje? 💜'
];
const QUICK = [
  ['Explicar uma matéria', 'Pode me explicar o assunto '],
  ['Fazer um resumo', 'Preciso de um resumo sobre '],
  ['Ajudar numa pesquisa', 'Quero pesquisar sobre '],
  ['Organizar meu dia', 'Me ajuda a organizar meu dia? Tenho que '],
  ['Lembrar de algo dele', 'Lily, pode me lembrar de algo que ele compartilhou?']
];
const SEND_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.4 20.4 21 12 3.4 3.6l-.1 6.5L15 12 3.3 13.9z"/></svg>';

let aborter = null;

export function chatView(root) {
  let busy = false;
  const thread = h('div', { class: 'thread', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversa com a LILY' });
  const input = h('textarea', { rows: 1, placeholder: 'Escreva para a Lily…', 'aria-label': 'Mensagem', enterkeyhint: 'send' });
  const sendBtn = h('button', { class: 'send', type: 'submit', 'aria-label': 'Enviar' });
  sendBtn.innerHTML = SEND_ICON;
  const form = h('form', { onsubmit: e => { e.preventDefault(); send(); } }, input, sendBtn);

  const bottom = () => { thread.scrollTop = thread.scrollHeight; };
  const grow = () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; sendBtn.disabled = busy || !input.value.trim(); };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });

  const bubble = (m) => {
    if (m.role === 'notice') return h('div', { class: 'notice' }, m.text);
    const b = h('div', { class: 'bubble' }, m.text);
    return m.role === 'lily' ? h('div', { class: 'msg lily' }, avatar('sm'), b) : h('div', { class: 'msg me' }, b);
  };

  function hero() {
    const mascot = h('img', { class: 'mascot', src: AVATAR, alt: 'Lily, a cachorrinha policial roxa e fofa', width: 220, height: 220 });
    return h('section', { class: 'hero' },
      mascot, h('h1', {}, `Oi, ${state.settings.userName}!`),
      h('div', { class: 'letter' }, GREETING.map(p => h('p', {}, p))),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Sugestões' },
        QUICK.map(([label, text]) => h('button', { class: 'chip', type: 'button', onclick: () => { input.value = text; grow(); input.focus(); } }, label))));
  }

  function draw() {
    const c = current();
    thread.replaceChildren(...(!c || !c.messages.length ? [hero()] : c.messages.map(bubble)));
    bottom();
  }

  async function send(textOverride) {
    const text = (textOverride ?? input.value).trim();
    if (!text || busy) return;
    const c = current() || newConv();
    if (!c.messages.length) c.title = text.length > 42 ? text.slice(0, 42) + '…' : text;
    c.messages.push({ role: 'user', text, ts: Date.now() });
    c.updated = Date.now(); save();
    input.value = ''; busy = true; grow(); draw();

    const typing = h('div', { class: 'msg lily' }, avatar('sm'), h('div', { class: 'bubble' }, h('span', { class: 'dots', role: 'status', 'aria-label': 'A Lily está processando' }, h('i'), h('i'), h('i'))));
    thread.append(typing); bottom();

    aborter = new AbortController();
    const history = c.messages.filter(m => m.role === 'user' || m.role === 'lily')
      .map(m => ({ role: m.role === 'lily' ? 'assistant' : 'user', content: m.text }));
    let msg = null, bodyEl = null;
    try {
      for await (const chunk of LilyService.stream({ messages: history, settings: state.settings, memories: state.settings.useMemories ? state.memories : [], signal: aborter.signal })) {
        if (!msg) { msg = { role: 'lily', text: '', ts: Date.now() }; c.messages.push(msg); typing.remove(); const row = bubble(msg); bodyEl = row.querySelector('.bubble'); thread.append(row); }
        msg.text += chunk; bodyEl.textContent = msg.text; bottom();
      }
    } catch (err) {
      typing.remove();
      if (err.name !== 'AbortError') c.messages.push({ role: 'notice', ts: Date.now(), text: describeError(err) });
    } finally {
      busy = false; c.updated = Date.now(); save(); draw(); grow();
    }
  }

  root.append(h('div', { class: 'view' }, thread, h('div', { class: 'composer' }, form)));
  draw(); grow();
  const pending = sessionStorage.getItem('lily:pending');
  if (pending) { sessionStorage.removeItem('lily:pending'); input.value = pending; grow(); input.focus(); }
  if (matchMedia('(min-width:900px)').matches) input.focus();
}

export function cancelStream() { aborter?.abort(); }
