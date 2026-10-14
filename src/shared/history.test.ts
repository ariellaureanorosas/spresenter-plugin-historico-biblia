import { describe, expect, it } from 'vitest';

import { extractReference, HISTORY_LIMIT, newId, trimHistory } from './history';
import type { HistoryItem } from './messages';
import type { Presentation } from './types';

function bible(props: Record<string, unknown>, type = 'bible'): Presentation {
  return { asset: { type }, props } as unknown as Presentation;
}

function makeItem(id: string, pinned = false): HistoryItem {
  return {
    id,
    reference: `Ref ${id}`,
    timestamp: 0,
    output: '0',
    layer: 0,
    eventName: null,
    pinned,
    presentation: bible({ book: 'Gênesis', chapter: 1, verse: 1 }),
  };
}

describe('extractReference', () => {
  it('monta a referência com livro, capítulo e versículo', () => {
    expect(extractReference(bible({ book: 'Gênesis', chapter: 1, verse: 11 }))).toBe(
      'Gênesis 1:11',
    );
  });

  it('usa intervalo quando verseEnd é maior que verse', () => {
    expect(extractReference(bible({ book: 'Salmos', chapter: 23, verse: 1, verseEnd: 6 }))).toBe(
      'Salmos 23:1-6',
    );
  });

  it('não vira intervalo quando verseEnd é igual a verse', () => {
    expect(extractReference(bible({ book: 'João', chapter: 3, verse: 16, verseEnd: 16 }))).toBe(
      'João 3:16',
    );
  });

  it('não vira intervalo quando verseEnd é menor que verse', () => {
    expect(extractReference(bible({ book: 'João', chapter: 3, verse: 16, verseEnd: 10 }))).toBe(
      'João 3:16',
    );
  });

  it('omite o versículo quando só há capítulo', () => {
    expect(extractReference(bible({ book: 'Gênesis', chapter: 1 }))).toBe('Gênesis 1');
  });

  it('aceita número como string', () => {
    expect(extractReference(bible({ book: 'Gênesis', chapter: '1', verse: '11' }))).toBe(
      'Gênesis 1:11',
    );
  });

  it('remove espaços ao redor do livro', () => {
    expect(extractReference(bible({ book: '  Gênesis  ', chapter: 1, verse: 11 }))).toBe(
      'Gênesis 1:11',
    );
  });

  it('ignora conteúdo que não seja bíblia', () => {
    expect(extractReference(bible({ book: 'Gênesis', chapter: 1, verse: 11 }, 'image'))).toBeNull();
  });

  it('retorna null sem asset', () => {
    expect(
      extractReference({ props: { book: 'Gênesis', chapter: 1 } } as unknown as Presentation),
    ).toBeNull();
  });

  it('retorna null sem props', () => {
    expect(extractReference({ asset: { type: 'bible' } } as unknown as Presentation)).toBeNull();
  });

  it('retorna null com livro vazio', () => {
    expect(extractReference(bible({ book: '   ', chapter: 1, verse: 11 }))).toBeNull();
  });

  it('retorna null com capítulo inválido', () => {
    expect(extractReference(bible({ book: 'Gênesis', chapter: 'abc' }))).toBeNull();
    expect(
      extractReference(bible({ book: 'Gênesis', chapter: Number.POSITIVE_INFINITY })),
    ).toBeNull();
  });
});

describe('trimHistory', () => {
  it('não altera a lista quando está dentro do limite', () => {
    const items = [makeItem('a'), makeItem('b')];
    expect(trimHistory(items, 5)).toBe(items);
  });

  it('mantém os mais recentes ao exceder o limite', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => makeItem(id));
    expect(trimHistory(items, 3).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('preserva os fixados e completa as vagas com os mais recentes', () => {
    const items = [makeItem('a', true), makeItem('b'), makeItem('c'), makeItem('d'), makeItem('e')];
    expect(trimHistory(items, 3).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('nunca corta fixados, mesmo ultrapassando o limite', () => {
    const items = [makeItem('a', true), makeItem('b', true), makeItem('c', true), makeItem('d')];
    const result = trimHistory(items, 2);
    expect(result.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(result.length).toBeGreaterThan(2);
  });

  it('usa HISTORY_LIMIT como padrão', () => {
    const items = Array.from({ length: HISTORY_LIMIT + 10 }, (_, i) => makeItem(`id-${i}`));
    expect(trimHistory(items)).toHaveLength(HISTORY_LIMIT);
  });
});

describe('newId', () => {
  it('gera ids únicos e não vazios', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10000; i++) {
      const id = newId();
      expect(id.length).toBeGreaterThan(0);
      ids.add(id);
    }
    expect(ids.size).toBe(10000);
  });
});
