// Utilidades puras do histórico. Sem dependência do `spresenter` — dá para
// testar isoladamente.

import type { HistoryItem } from './messages';
import type { Presentation } from './types';

/** Limite de itens do histórico. Fixados nunca são cortados. */
export const HISTORY_LIMIT = 300;

let idCounter = 0;

/**
 * Gerador de id próprio.
 *
 * Não assumimos `crypto.randomUUID` no processo isolado do plugin: ele pode não
 * existir no contexto `vm`. Este gerador combina tempo, um contador de processo
 * e aleatoriedade, o que basta para ids únicos dentro do histórico.
 */
export function newId(): string {
  idCounter = (idCounter + 1) % 1_000_000;
  const time = Date.now().toString(36);
  const counter = idCounter.toString(36).padStart(4, '0');
  const rand = Math.random().toString(36).slice(2, 10);
  return `${time}-${counter}-${rand}`;
}

/** Converte número ou string numérica em inteiro; qualquer outro valor → null. */
function toInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return parseInt(value.trim(), 10);
  }
  return null;
}

/**
 * Extrai a referência bíblica de uma `Presentation`.
 *
 * Formato real observado (asset.type === 'bible'):
 *
 *   asset: { type: 'bible', guid: 'short', title: 'Bíblia', data: {} }
 *   props: { book: 'Gênesis', chapter: 1, verse: 11, verseEnd: 11, text, version, … }
 *
 * A referência sai direto de `book` / `chapter` / `verse` / `verseEnd` — mais
 * confiável que inferir do texto renderizado. Conteúdo não bíblico → null.
 *
 * Resultados: "Gênesis 1:11", "Gênesis 1:11-12" (intervalo) ou "Gênesis 1"
 * (capítulo sem versículo).
 */
export function extractReference(presentation: Presentation): string | null {
  const asset = presentation.asset;
  if (!asset || asset.type !== 'bible') return null;

  const props = presentation.props as Record<string, unknown> | undefined;
  if (!props) return null;

  const bookRaw = props.book;
  const book = typeof bookRaw === 'string' ? bookRaw.trim() : '';
  if (!book) return null;

  const chapter = toInt(props.chapter);
  if (chapter === null) return null;

  const verse = toInt(props.verse);
  if (verse === null) return `${book} ${chapter}`;

  const verseEnd = toInt(props.verseEnd);
  if (verseEnd !== null && verseEnd > verse) {
    return `${book} ${chapter}:${verse}-${verseEnd}`;
  }
  return `${book} ${chapter}:${verse}`;
}

/**
 * Aplica o limite de itens preservando os fixados.
 *
 * `items` deve estar na ordem mais recente → mais antiga. Mantém todos os
 * fixados e completa as vagas restantes (até `limit`) com os não fixados mais
 * recentes. Se houver mais fixados que o limite, o total ultrapassa o limite —
 * o requisito é que fixados nunca sejam cortados.
 */
export function trimHistory(items: HistoryItem[], limit: number = HISTORY_LIMIT): HistoryItem[] {
  if (items.length <= limit) return items;

  const keep = new Set<string>();
  let pinnedCount = 0;
  for (const item of items) {
    if (item.pinned) {
      keep.add(item.id);
      pinnedCount++;
    }
  }

  let slots = Math.max(0, limit - pinnedCount);
  for (const item of items) {
    if (slots <= 0) break;
    if (item.pinned) continue;
    keep.add(item.id);
    slots--;
  }

  return items.filter((item) => keep.has(item.id));
}
