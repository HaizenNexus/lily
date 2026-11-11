import { h, toast } from '../ui.js';
import { state, save, uid, resetAll } from '../store.js';
import { LilyService } from '../services/lily-service.js';
import { deviceCapabilities } from '../services/device-capabilities.js';
import { OfflineLLM } from '../services/offline-llm.js';

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

  
const offlineStatus = h(
  'p',
  { class: 'lead', role: 'status' },
  'Verificando suporte à IA local...'
);

const offlineDetails = h('p', { class: 'lead' });

const offlineProgress = h('progress', {
  class: 'offline-progress',
  max: 100,
  value: 0
});
offlineProgress.hidden = true;

const offlineProgressText = h('p', {
  class: 'lead',
  'aria-live': 'polite'
});
offlineProgressText.hidden = true;

let offlineBusy = false;

async function refreshOfflineStatus() {
  if (!OfflineLLM.isSupported()) {
    offlineStatus.textContent =
      'Este navegador não oferece os recursos necessários para executar a IA local.';

    offlineDetails.textContent =
      'É necessário HTTPS, WebAssembly, Web Workers e armazenamento local compatível.';

    offlineLoadButton.disabled = true;
    offlineUnloadButton.disabled = true;
    return;
  }

  try {
    const [caps, cached] = await Promise.all([
      deviceCapabilities(),
      OfflineLLM.hasCachedModel()
    ]);

    const loaded = OfflineLLM.isLoaded();

    if (loaded) {
      offlineStatus.textContent =
        'IA offline carregada e pronta para uso nesta sessão.';
    } else if (cached) {
      offlineStatus.textContent =
        'Modelo já baixado neste aparelho. Está pronto para ser carregado.';
    } else {
      offlineStatus.textContent =
        'Modelo ainda não instalado. O primeiro download precisa de internet.';
    }

    const details = [];

    if (caps.memoryGB) {
      details.push(`RAM estimada: ${caps.memoryGB} GB`);
    }

    if (caps.cores) {
      details.push(`Núcleos disponíveis: ${caps.cores}`);
    }

    if (caps.freeStorageMB != null) {
      details.push(`Armazenamento livre estimado: ${caps.freeStorageMB} MB`);
    }

    offlineDetails.textContent = details.join(' • ');

    offlineLoadButton.textContent = loaded
      ? 'Modelo carregado'
      : cached
        ? 'Carregar modelo offline'
        : 'Baixar e carregar modelo offline';

    offlineLoadButton.disabled = loaded || offlineBusy;
    offlineUnloadButton.disabled = !loaded || offlineBusy;

  } catch (error) {
    offlineStatus.textContent =
      `Não foi possível verificar o modelo: ${error.message}`;

    offlineLoadButton.disabled = true;
    offlineUnloadButton.disabled = true;
  }
}

async function loadOfflineModel() {
  if (offlineBusy || !OfflineLLM.isSupported()) return;

  offlineBusy = true;
  offlineLoadButton.disabled = true;
  offlineUnloadButton.disabled = true;

  offlineProgress.hidden = false;
  offlineProgressText.hidden = false;
  offlineProgress.value = 0;

  offlineProgressText.textContent = 'Preparando o download...';

  try {
    await OfflineLLM.load({
      onProgress: ({ loaded, total, percent }) => {
        offlineProgress.value = percent;

        const downloadedMB = (loaded / 1048576).toFixed(0);
        const totalMB = total
          ? (total / 1048576).toFixed(0)
          : '?';

        offlineProgressText.textContent =
          percent >= 100
            ? 'Download concluído. Preparando a IA na CPU...'
            : `Baixando modelo: ${percent}% (${downloadedMB} de ${totalMB} MB)`;
      }
    });

    offlineProgress.value = 100;

    offlineProgressText.textContent =
      'Modelo carregado com sucesso! A IA local está pronta.';

    toast('IA offline carregada!');

  } catch (error) {
    offlineProgress.hidden = true;
    offlineProgressText.hidden = true;

    offlineStatus.textContent =
      `Falha ao carregar a IA offline: ${error.message || 'Erro desconhecido'}`;

    toast('Não foi possível carregar o modelo.');
  } finally {
    offlineBusy = false;
    await refreshOfflineStatus();
  }
}

async function unloadOfflineModel() {
  if (offlineBusy) return;

  offlineBusy = true;
  offlineUnloadButton.disabled = true;

  try {
    await OfflineLLM.unload();

    toast('Modelo liberado da memória.');

    offlineProgress.hidden = true;
    offlineProgressText.hidden = true;

  } catch (error) {
    offlineStatus.textContent =
      `Erro ao liberar o modelo: ${error.message}`;
  } finally {
    offlineBusy = false;
    await refreshOfflineStatus();
  }
}

const offlineLoadButton = h(
  'button',
  {
    class: 'btn',
    type: 'button',
    onclick: loadOfflineModel
  },
  'Baixar e carregar modelo offline'
);

const offlineUnloadButton = h(
  'button',
  {
    class: 'btn',
    type: 'button',
    onclick: unloadOfflineModel,
    disabled: true
  },
  'Liberar memória'
);

refreshOfflineStatus();


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
   
h('h2', {}, 'Modo offline'),

h('div', { class: 'card' },
  h('h3', {}, 'Inteligência artificial local'),

  offlineStatus,
  offlineDetails,
  offlineProgress,
  offlineProgressText,

  h('div', {
    class: 'row',
    style: 'gap:10px; margin-top:12px; flex-wrap:wrap'
  },
    offlineLoadButton,
    offlineUnloadButton
  ),

  h('p', { class: 'lead' },
    'O primeiro download exige internet e ocupa aproximadamente 491 MB. Depois, o modelo pode ser carregado localmente. A execução utiliza a CPU deste aparelho.'
  )
),

    h('h2', {}, 'Dados'),
    h('button', { class: 'btn danger', onclick: () => { if (confirm('Apagar conversas, tarefas, memórias, preferências e o código de acesso deste aparelho?')) resetAll(); } }, 'Apagar tudo deste aparelho')))));
  if (location.hash.endsWith('/memoria')) setTimeout(() => document.getElementById('memoria')?.scrollIntoView(), 0);
}
