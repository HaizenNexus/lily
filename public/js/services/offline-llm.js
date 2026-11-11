
import { Wllama } from '@wllama/wllama';

// Motor WebAssembly hospedado junto com a LILY.
const WLLAMA_PATHS = {
  default: '/assets/wllama.wasm'
};

// Qwen2.5 0.5B Instruct, quantização Q4_K_M.
const MODEL_URL =
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf';

let engine = null;
let loadingPromise = null;

function getEngine() {
  if (!globalThis.isSecureContext) {
    throw new Error(
      'A IA offline precisa ser executada em HTTPS ou localhost.'
    );
  }

  if (!engine) {
    engine = new Wllama(WLLAMA_PATHS, {
      allowOffline: true,
      parallelDownloads: 1,
      suppressNativeLog: true
    });

    // Não utilizar CDN para arquivos de compatibilidade.
    engine.setCompat(null);
  }

  return engine;
}

function createSystemPrompt(settings, memories) {
  const name = String(
    settings?.userName || 'Evellin'
  ).slice(0, 40);

  const style = settings?.expressions === false
    ? 'Não use carinhas ou emojis.'
    : 'Use ;-; ou :3 ocasionalmente, quando combinar.';

  const tone = settings?.tone === 'objetiva'
    ? 'Seja direta e econômica nas palavras.'
    : 'Seja gentil, paciente e carinhosa.';

  const savedMemories = (Array.isArray(memories) ? memories : [])
    .map(item => typeof item === 'string' ? item : item?.text)
    .filter(Boolean)
    .slice(0, 10)
    .map(item => String(item).slice(0, 250));

  return [
    `Você é a LILY, assistente virtual criada para ${name}.`,
    'Responda sempre em português do Brasil, salvo pedido contrário.',
    'Ajude com estudos, explicações, organização e conversas.',
    'Seja honesta: você está funcionando sem internet.',
    'Não invente notícias, pesquisas, fontes ou informações atuais.',
    'Não diga que consultou a internet durante o modo offline.',
    style,
    tone,
    savedMemories.length
      ? 'Memórias cadastradas:\n' + savedMemories.join('\n')
      : ''
  ].filter(Boolean).join('\n\n');
}

export const OfflineLLM = {
  isSupported() {
    return Boolean(
      globalThis.isSecureContext &&
      typeof WebAssembly !== 'undefined' &&
      typeof Worker !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.getDirectory === 'function'
    );
  },

  isLoaded() {
    return Boolean(engine?.isModelLoaded());
  },

  async hasCachedModel() {
    const llm = getEngine();
    const models = await llm.modelManager.getModels();

    return models.some(model => model.url === MODEL_URL);
  },

  // Baixa o modelo na primeira utilização e carrega-o na memória.
  async load({ onProgress, signal } = {}) {
    if (this.isLoaded()) return true;

    if (loadingPromise) {
      return loadingPromise;
    }

    const llm = getEngine();

    loadingPromise = (async () => {
      try {
        await llm.loadModelFromUrl(MODEL_URL, {
          n_gpu_layers: 0,
          n_ctx: 1024,
          n_batch: 128,
          signal,

          progressCallback: ({ loaded, total }) => {
            const percent = total > 0
              ? Math.round((loaded / total) * 100)
              : 0;

            onProgress?.({
              loaded,
              total,
              percent
            });
          }
        });

        return true;

      } catch (error) {
        try {
          await llm.exit();
        } catch {
          // Libera o que for possível.
        }

        if (engine === llm) {
          engine = null;
        }

        throw error;
      }
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  },

  // Responde usando exclusivamente o modelo instalado no aparelho.
  async *stream({
    messages = [],
    settings = {},
    memories = [],
    signal
  } = {}) {
    if (!this.isLoaded()) {
      throw new Error('O modelo offline ainda não foi carregado.');
    }

    if (signal?.aborted) {
      const error = new Error('Operação cancelada.');
      error.name = 'AbortError';
      throw error;
    }

    const history = messages
      .filter(message =>
        ['user', 'assistant'].includes(message.role)
      )
      .slice(-4)
      .map(message => ({
        role: message.role,
        content: String(message.content || '').slice(0, 700)
      }));

    const output = await engine.createChatCompletion({
      abortSignal: signal,
      
        messages: [
        {
          role: 'system',
          content: createSystemPrompt(settings, memories)
        },
        ...history
      ],
      max_tokens: 180,
      temperature: 0.7,
      top_p: 0.9,
      stream: true
    });

    for await (const chunk of output) {
      if (signal?.aborted) {
        const error = new Error('Operação cancelada.');
        error.name = 'AbortError';
        throw error;
      }

      const text = chunk.choices?.[0]?.delta?.content;

      if (typeof text === 'string' && text) {
        yield text;
      }
    }
  },

  // Descarrega o modelo da memória RAM, preservando o modelo armazenado.
  async unload() {
    if (loadingPromise) {
      await loadingPromise.catch(() => {});
    }

    if (engine) {
      await engine.exit();
      engine = null;
    }
  }
};
