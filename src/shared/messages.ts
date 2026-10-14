// Contrato de mensagens entre a UI (iframe) e o thread de lógica (code.ts).
// Ambos os lados importam ESTES tipos, então um campo trocado quebra a
// compilação em vez de virar um bug silencioso em runtime.

import type { Presentation } from './types';

/** Um item do histórico de referências apresentadas. */
export interface HistoryItem {
  id: string;
  /** Referência extraída, ex.: "João 3:16" ou "Salmos 23:1-6". */
  reference: string;
  /** Epoch em milissegundos. */
  timestamp: number;
  /** Índice da saída (virtual output) como string, ex.: "0". */
  output: string;
  /** Índice da camada. */
  layer: number;
  /** Nome do culto/evento ativo quando foi apresentado (ou null). */
  eventName: string | null;
  /** Fixado nunca é cortado pelo limite do histórico. */
  pinned: boolean;
  /** A `Presentation` original, completa, para reabrir o trecho. */
  presentation: Presentation;
}

/** Snapshot cru usado no modo DEBUG. */
export interface DebugSnapshot {
  output: string;
  at: string;
  layers: unknown;
}

/** Mensagens da UI para o thread de lógica. */
export type UiToHost =
  | { type: 'init' }
  | { type: 'list' }
  | { type: 'debug-read' }
  | { type: 'pin'; id: string; pinned: boolean }
  | { type: 'delete'; id: string }
  | { type: 'clear' }
  | { type: 'reopen'; id: string };

/** Mensagens do thread de lógica para a UI. */
export type HostToUi =
  | { type: 'history'; items: HistoryItem[] }
  | { type: 'debug'; payload: DebugSnapshot | null }
  | { type: 'reopened'; id: string; ok: boolean; error?: string }
  | { type: 'error'; message: string };
