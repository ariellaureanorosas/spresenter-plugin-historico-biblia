// Tipos do domínio derivados da própria API do SDK.
//
// O SDK não reexporta os tipos de domínio (`Presentation`, `ActiveSetlist`…):
// eles são internos ao `types/code.d.ts`. Em vez de usar `any`, derivamos os
// tipos a partir das assinaturas do global `spresenter`, mantendo a tipagem
// forte e sem depender de nomes que não são exportados.

/** Camadas de uma saída: uma `Presentation` (ou `null`) por camada. */
export type LiveLayers = Awaited<ReturnType<typeof spresenter.live.read>>;

/** Uma unidade de conteúdo colocada numa camada. */
export type Presentation = NonNullable<LiveLayers[number]>;

/** A setlist/culto ativo (forma dinâmica exposta pelo host). */
export type ActiveSetlist = NonNullable<Awaited<ReturnType<typeof spresenter.events.getActive>>>;
