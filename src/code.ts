// Thread de lógica do plugin "Histórico da Bíblia".
//
// Roda em processo isolado (sem DOM) e fala com o app pelo global `spresenter`.
// A UI (iframe) só conversa com este arquivo por postMessage.
//
// O app NÃO emite evento nem expõe API para a busca da Bíblia, então só é
// possível registrar o que foi APRESENTADO. A cada evento `live` relemos as
// camadas da saída, extraímos a referência bíblica e guardamos no histórico.

import type { DebugSnapshot, HistoryItem, HostToUi, UiToHost } from './shared/messages';
import type { Presentation } from './shared/types';
import { extractReference, newId, trimHistory } from './shared/history';

const HISTORY_KEY = 'history:v1';
const DEBUG_KEY = 'debug:last';

/** Histórico em memória (mais recente primeiro). Carregado sob demanda. */
let history: HistoryItem[] = [];
let historyLoaded = false;

/** Assinatura do último conteúdo por `output:layer`, para detectar novidade. */
const lastSignature = new Map<string, string>();

/** Última apresentação crua lida (modo DEBUG). */
let lastRaw: DebugSnapshot | null = null;

/** Serializa os eventos `live` para não haver corrida entre leituras. */
let queue: Promise<void> = Promise.resolve();

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function post(msg: HostToUi): void {
  spresenter.ui.postMessage(msg);
}

async function ensureLoaded(): Promise<void> {
  if (historyLoaded) return;
  try {
    const stored = await spresenter.storage.get<HistoryItem[]>(HISTORY_KEY);
    history = Array.isArray(stored) ? stored : [];
  } catch (e) {
    history = [];
    // eslint-disable-next-line no-console
    console.error('[historico-biblia] falha ao carregar o histórico:', errorMessage(e));
  }
  historyLoaded = true;
}

async function persist(): Promise<void> {
  try {
    await spresenter.storage.set(HISTORY_KEY, history);
  } catch (e) {
    post({ type: 'error', message: `Falha ao salvar o histórico: ${errorMessage(e)}` });
  }
}

function pushHistory(): void {
  post({ type: 'history', items: history });
}

/** Nome do culto/setlist ativo, ou null quando não há evento ativo. */
async function getActiveEventName(): Promise<string | null> {
  try {
    const active = await spresenter.events.getActive();
    if (!active) return null;
    const name = active.name ?? active.title;
    return typeof name === 'string' && name.trim() ? name.trim() : null;
  } catch {
    // O app pode estar sem janela/evento ativo — não é erro para o plugin.
    return null;
  }
}

function signatureOf(output: string, layer: number, presentation: Presentation): string {
  return `${output}:${layer}:${JSON.stringify(presentation)}`;
}

/** Lê as camadas da saída, atualiza o DEBUG e registra referências novas. */
async function handleLive(output: string): Promise<void> {
  let layers: (Presentation | null)[];
  try {
    layers = await spresenter.live.read(output);
  } catch (e) {
    const message = errorMessage(e);
    // eslint-disable-next-line no-console
    console.error('[historico-biblia] falha ao ler o live:', message);
    post({ type: 'error', message: `Não foi possível ler a saída ${output}: ${message}` });
    return;
  }

  // Modo DEBUG: guarda a última leitura crua (em memória + storage).
  lastRaw = { output, at: new Date().toISOString(), layers };
  try {
    await spresenter.storage.set(DEBUG_KEY, lastRaw);
  } catch {
    // DEBUG é best-effort.
  }
  post({ type: 'debug', payload: lastRaw });

  await ensureLoaded();

  let changed = false;
  for (let layer = 0; layer < layers.length; layer++) {
    const presentation = layers[layer];
    if (!presentation) continue;

    const key = `${output}:${layer}`;
    const signature = signatureOf(output, layer, presentation);
    if (lastSignature.get(key) === signature) continue; // conteúdo já visto
    lastSignature.set(key, signature);

    // Só registramos conteúdo bíblico.
    const reference = extractReference(presentation);
    if (!reference) continue;

    const now = Date.now();
    const mostRecent = history[0];

    if (mostRecent && mostRecent.reference === reference) {
      // Mesma referência mais recente: só atualiza o carimbo de tempo.
      mostRecent.timestamp = now;
    } else {
      const eventName = await getActiveEventName();
      history.unshift({
        id: newId(),
        reference,
        timestamp: now,
        output,
        layer,
        eventName,
        pinned: false,
        presentation,
      });
    }

    history = trimHistory(history);
    changed = true;
  }

  if (changed) {
    await persist();
    pushHistory();
  }
}

/** Enfileira a leitura para evitar corrida entre eventos `live` seguidos. */
function scheduleLive(output: string): void {
  queue = queue
    .then(() => handleLive(output))
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[historico-biblia] erro no processamento do live:', errorMessage(e));
    });
}

// ── Eventos do app ───────────────────────────────────────────

// Notificação: o payload traz, no máximo, `{ output }`. Relemos o conteúdo.
// Blindado: uma API ausente no app não pode derrubar o arquivo antes de
// instalarmos o `onmessage` da UI (senão a ponte fica morta e nada funciona).
try {
  spresenter.on('live', (payload) => {
    scheduleLive(payload?.output ?? '0');
  });
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('[historico-biblia] não foi possível assinar o evento live:', errorMessage(e));
}

// ── Mensagens da UI ──────────────────────────────────────────

async function handleReopen(id: string): Promise<void> {
  await ensureLoaded();
  const item = history.find((entry) => entry.id === id);
  if (!item) {
    post({ type: 'reopened', id, ok: false, error: 'Item não encontrado.' });
    return;
  }

  try {
    // Evita que o nosso próprio `apply` vire um novo registro no histórico.
    lastSignature.set(
      `${item.output}:${item.layer}`,
      signatureOf(item.output, item.layer, item.presentation),
    );
    await spresenter.live.apply(item.output, item.layer, item.presentation);
    await spresenter.live.setState(item.output, item.layer, { show: true });
    post({ type: 'reopened', id, ok: true });
  } catch (e) {
    post({ type: 'reopened', id, ok: false, error: errorMessage(e) });
  }
}

/**
 * Algumas versões do host entregam a mensagem já "embrulhada" no envelope
 * `{ __spresenter: true, data }`; outras entregam o `data` puro. Desembrulhamos
 * quando necessário para não descartar mensagens em silêncio.
 */
function unwrapUiMessage(raw: unknown): unknown {
  if (raw && typeof raw === 'object' && '__spresenter' in (raw as Record<string, unknown>)) {
    return (raw as { data?: unknown }).data;
  }
  return raw;
}

spresenter.ui.onmessage = async (raw: unknown) => {
  const msg = unwrapUiMessage(raw) as UiToHost;
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {
    // eslint-disable-next-line no-console
    console.warn('[historico-biblia] mensagem ignorada:', raw);
    return;
  }
  // eslint-disable-next-line no-console
  console.log('[historico-biblia] recebido da UI:', msg.type);

  switch (msg.type) {
    case 'init':
    case 'list': {
      await ensureLoaded();
      pushHistory();
      post({ type: 'debug', payload: lastRaw });
      break;
    }

    case 'debug-read': {
      let payload = lastRaw;
      if (!payload) {
        try {
          payload = (await spresenter.storage.get<DebugSnapshot>(DEBUG_KEY)) ?? null;
        } catch {
          payload = null;
        }
      }
      post({ type: 'debug', payload });
      break;
    }

    case 'pin': {
      await ensureLoaded();
      const item = history.find((entry) => entry.id === msg.id);
      if (item) {
        item.pinned = msg.pinned;
        await persist();
        pushHistory();
      }
      break;
    }

    case 'delete': {
      await ensureLoaded();
      const next = history.filter((entry) => entry.id !== msg.id);
      if (next.length !== history.length) {
        history = next;
        await persist();
        pushHistory();
      }
      break;
    }

    case 'clear': {
      await ensureLoaded();
      // Mantém apenas os fixados.
      const kept = history.filter((entry) => entry.pinned);
      history = kept;
      await persist();
      pushHistory();
      break;
    }

    case 'reopen': {
      await handleReopen(msg.id);
      break;
    }

    default:
      break;
  }
};

try {
  const label = spresenter.manifest?.name ?? spresenter.manifest?.id ?? 'plugin';
  // eslint-disable-next-line no-console
  console.log('Histórico da Bíblia carregado:', label);
} catch {
  // eslint-disable-next-line no-console
  console.log('Histórico da Bíblia carregado.');
}
