import { useEffect, useMemo, useState } from 'react';
import { onMessage, postMessage } from '@spresenter/plugin-sdk/ui';
import {
  Alert,
  Button,
  Header,
  Hint,
  Panel,
  Root,
  Row,
  Select,
  Segmented,
  TextInput,
} from '@spresenter/plugin-sdk/ui-kit/react';
import type { DebugSnapshot, HistoryItem, HostToUi } from '../shared/messages';

type Grouping = 'recent' | 'event';

const NONE_EVENT = '__none__';

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function App() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [query, setQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [grouping, setGrouping] = useState<Grouping>('recent');
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [debug, setDebug] = useState<DebugSnapshot | null>(null);

  useEffect(() => {
    const off = onMessage((raw) => {
      const msg = raw as HostToUi;
      switch (msg?.type) {
        case 'history':
          setItems(msg.items);
          break;
        case 'debug':
          setDebug(msg.payload);
          break;
        case 'reopened':
          setStatus(
            msg.ok
              ? { kind: 'ok', text: 'Referência reaberta no ar.' }
              : { kind: 'error', text: `Não foi possível reabrir: ${msg.error ?? 'erro'}` },
          );
          break;
        case 'error':
          setStatus({ kind: 'error', text: msg.message });
          break;
        default:
          break;
      }
    });
    postMessage({ type: 'init' });
    // O processo de lógica pode subir depois do iframe; reenviamos (idempotente).
    const retries = [
      setTimeout(() => postMessage({ type: 'init' }), 700),
      setTimeout(() => postMessage({ type: 'init' }), 1800),
    ];
    return () => {
      off();
      retries.forEach(clearTimeout);
    };
  }, []);

  // Fecha o aviso sozinho depois de alguns segundos.
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(t);
  }, [status]);

  const eventOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    for (const item of items) {
      if (item.eventName) names.add(item.eventName);
      else hasNone = true;
    }
    const opts = [{ value: '', label: 'Todos os cultos' }];
    for (const name of Array.from(names).sort((a, b) => a.localeCompare(b, 'pt-BR'))) {
      opts.push({ value: name, label: name });
    }
    if (hasNone) opts.push({ value: NONE_EVENT, label: 'Sem culto' });
    return opts;
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return items.filter((item) => {
      if (q && !normalize(item.reference).includes(q)) return false;
      if (eventFilter === NONE_EVENT && item.eventName) return false;
      if (eventFilter && eventFilter !== NONE_EVENT && item.eventName !== eventFilter) return false;
      return true;
    });
  }, [items, query, eventFilter]);

  const pinned = filtered.filter((item) => item.pinned);
  const rest = filtered.filter((item) => !item.pinned);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryItem[]>();
    for (const item of filtered) {
      const key = item.eventName ?? 'Sem culto';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const reopen = (id: string) => postMessage({ type: 'reopen', id });
  const togglePin = (item: HistoryItem) =>
    postMessage({ type: 'pin', id: item.id, pinned: !item.pinned });
  const remove = (id: string) => postMessage({ type: 'delete', id });
  const doClear = () => {
    postMessage({ type: 'clear' });
    setConfirmingClear(false);
  };

  const renderItem = (item: HistoryItem) => (
    <li
      key={item.id}
      className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/5 p-3"
    >
      <button
        type="button"
        onClick={() => reopen(item.id)}
        className="min-w-0 text-center"
        title="Reabrir no ar"
      >
        <div
          className={`break-words text-lg font-semibold ${item.pinned ? 'text-amber-400' : 'text-white'}`}
        >
          {item.reference}
        </div>
        <div className="truncate text-xs text-white/50">
          {formatTime(item.timestamp)}
          {item.eventName ? ` · ${item.eventName}` : ' · Sem culto'}
          {` · saída ${item.output} · camada ${item.layer}`}
        </div>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" className="col-span-2 w-full" onClick={() => reopen(item.id)}>
          Abrir no ar
        </Button>
        <Button
          variant={item.pinned ? 'success' : 'secondary'}
          className="w-full"
          onClick={() => togglePin(item)}
        >
          {item.pinned ? 'Desafixar' : 'Fixar'}
        </Button>
        <Button variant="danger" className="w-full" onClick={() => remove(item.id)}>
          Excluir
        </Button>
      </div>
    </li>
  );

  return (
    <Root className="flex h-screen min-h-0 flex-col gap-3">
      <Header
        title="Histórico da Bíblia"
        subtitle="Referências que foram ao ar. Clique para reabrir uma passagem."
      />

      <Row className="items-center gap-2">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar referência (ex.: João 3)"
          className="min-w-0 flex-1"
        />
        <Select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="min-w-0 flex-1"
        >
          {eventOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <Segmented
          value={grouping}
          onChange={setGrouping}
          className="w-full"
          options={[
            { value: 'recent', label: 'Recentes' },
            { value: 'event', label: 'Por culto' },
          ]}
        />
      </Row>

      {status && <Alert variant={status.kind === 'ok' ? 'success' : 'error'}>{status.text}</Alert>}

      {confirmingClear ? (
        <Alert variant="warning">
          Limpar o histórico? Os itens fixados serão mantidos.
          <Row className="mt-2 gap-2">
            <Button variant="danger" onClick={doClear}>
              Sim, limpar
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingClear(false)}>
              Cancelar
            </Button>
          </Row>
        </Alert>
      ) : null}

      <div className="flex flex-1 min-h-0 flex-col gap-3 overflow-y-auto">
        {grouping === 'recent' && pinned.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
              Fixados
            </div>
            <ul className="flex flex-col gap-2">{pinned.map(renderItem)}</ul>
          </div>
        )}

        {grouping === 'recent' && pinned.length > 0 && rest.length > 0 && (
          <div className="border-t border-white/15" />
        )}

        {rest.length === 0 && pinned.length === 0 ? (
          <Hint>
            Nenhuma referência no histórico ainda. Coloque um versículo no ar pelo painel Bíblia.
          </Hint>
        ) : grouping === 'recent' ? (
          <ul className="flex flex-col gap-2">{rest.map(renderItem)}</ul>
        ) : (
          groups.map(([name, list]) => {
            const groupPinned = list.filter((item) => item.pinned);
            const groupRest = list.filter((item) => !item.pinned);
            return (
              <div key={name} className="flex flex-col gap-2">
                <div className="text-center text-xs font-semibold uppercase tracking-wide text-white/40">
                  {name}
                </div>
                {groupPinned.length > 0 && (
                  <>
                    <div className="text-center text-xs font-semibold uppercase tracking-wide text-amber-400">
                      Fixados
                    </div>
                    <ul className="flex flex-col gap-2">{groupPinned.map(renderItem)}</ul>
                  </>
                )}
                {groupPinned.length > 0 && groupRest.length > 0 && (
                  <div className="border-t border-white/15" />
                )}
                <ul className="flex flex-col gap-2">{groupRest.map(renderItem)}</ul>
              </div>
            );
          })
        )}
      </div>

      <Row className="items-center justify-between gap-2 border-t border-white/10 pt-2">
        <Hint>
          {filtered.length} de {items.length} {items.length === 1 ? 'item' : 'itens'}
        </Hint>
        <Row className="gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowDebug((v) => !v)}>
            {showDebug ? 'Ocultar DEBUG' : 'Mostrar DEBUG'}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={items.length === 0}
            onClick={() => setConfirmingClear(true)}
          >
            Limpar histórico
          </Button>
        </Row>
      </Row>

      {showDebug && (
        <Panel label="DEBUG — última apresentação crua">
          <Row className="mb-2 gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => postMessage({ type: 'debug-read' })}
            >
              Recarregar
            </Button>
          </Row>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-[11px] text-white/60">
            {debug ? JSON.stringify(debug, null, 2) : 'Nenhuma captura ainda.'}
          </pre>
        </Panel>
      )}
    </Root>
  );
}
