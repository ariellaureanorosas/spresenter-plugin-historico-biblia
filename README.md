# Histórico da Bíblia — plugin Spresenter

[![CI](https://github.com/ariellaureanorosas/spresenter-plugin-historico-biblia/actions/workflows/ci.yml/badge.svg)](https://github.com/ariellaureanorosas/spresenter-plugin-historico-biblia/actions/workflows/ci.yml)

Painel com o histórico das referências bíblicas que **foram colocadas no ar**
(apresentadas) durante o culto, para o operador voltar rápido a uma passagem sem
pesquisar de novo.

## O que ele faz

- **Captura** cada versículo apresentado (evento `live`) e guarda a referência,
  o horário, a saída/camada, o culto/evento ativo e a apresentação original.
- **Lista** do mais recente ao mais antigo, com **busca** por referência e
  **filtro/agrupamento por culto**.
- **Fixar / desafixar** — itens fixados ficam no topo e nunca são cortados.
- **Excluir** um item ou **limpar o histórico** (mantendo os fixados, com
  confirmação).
- **Reabrir no ar** com um clique: reaplica a apresentação salva na saída/camada
  de origem (`live.apply` + `live.setState({ show: true })`).
- **Persistência** em `spresenter.storage` (chave `history:v1`, limite de 300
  itens).

## Importante: só o que foi apresentado

O Spresenter **não expõe API nem evento para a busca da Bíblia**. Por isso o
plugin **não** registra referências apenas pesquisadas — apenas as que foram
efetivamente para o ar. Não há como contornar isso.

## Como funciona

Dois threads, como todo plugin Spresenter:

```
UI (iframe)  ⇄ postMessage ⇄  code.ts (processo isolado)  ⇄  Spresenter
```

- `src/code.ts` — thread de lógica (sem DOM). Assina `spresenter.on('live')`,
  relê as camadas com `spresenter.live.read(output)`, extrai a referência e
  persiste.
- `src/ui/` — painel React (Tailwind) em iframe sandboxed. Só fala com
  `code.ts` por `postMessage`/`onMessage`.

O evento `live` é apenas notificação (no máximo `{ output }`): o conteúdo é
sempre relido com `live.read`.

O processo de lógica é iniciado **quando o painel é aberto** (o manifest não usa
`"background": true`). Portanto, a captura acontece enquanto o plugin estiver em
execução — deixe o painel **Histórico da Bíblia** aberto durante o culto.

### Extração da referência

O versículo chega numa `Presentation` com `asset.type === 'bible'` e os campos
em `props`:

```jsonc
{
  "asset": { "type": "bible", "title": "Bíblia", ... },
  "props": { "book": "Gênesis", "chapter": 1, "verse": 11, "verseEnd": 11, "text": "…", "version": "ACF" }
}
```

`extractReference()` monta `"Gênesis 1:11"`, `"Gênesis 1:11-12"` (intervalo) ou
`"Gênesis 1"` (capítulo sem versículo). Conteúdo que não seja `type: 'bible'` é
ignorado.

## Permissões

Declaradas em `manifest.json` (o mínimo necessário):

- `live:read` — assinar o evento `live` e reler as camadas.
- `live:write` — reabrir a apresentação no ar.
- `events:read` — ler o culto/setlist ativo. (Nome antigo, aceito e normalizado
  pelos apps novos para `setlists:read`.)

## Desenvolvimento

```bash
npm install
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm run test         # Vitest (lógica pura em src/shared)
npm run format       # Prettier
npm run dev          # recompila code + ui a cada mudança (hot reload)
```

No Spresenter: **Settings → Plugins → Load folder (dev)** e aponte para esta
pasta. Salvar um arquivo recarrega o plugin.

## Build e empacotamento

```bash
npm run build        # gera dist/code.js + dist/ui/
npm run package      # build + release/com.sonext.historico-biblia-<versão>.zip
```

Instale o `.zip` via **Settings → Plugins → Install (.zip/folder)**.

## Estrutura

| Caminho                                    | Papel                                                        |
| ------------------------------------------ | ------------------------------------------------------------ |
| `manifest.json`                            | Metadados, permissões e o painel.                            |
| `src/code.ts`                              | Thread de lógica: captura, histórico, mensagens, reabrir.    |
| `src/ui/`                                  | Painel React + Tailwind (pt-BR).                             |
| `src/shared/`                              | Tipos do SDK, contrato de mensagens e utilidades puras.      |
| `src/spresenter.d.ts`                      | Declara o global `spresenter` para o TypeScript.             |
| `sdk/`                                     | SDK do Spresenter vendorizado (`spresenter-plugin-sdk.tgz`). |
| `scripts/package.mjs`                      | Gera o `.zip` de release em `release/`.                      |
| `vite.*.config.ts`                         | Builds separados da lógica (`code`) e da UI (`ui`).          |
| `tailwind.config.js` / `postcss.config.js` | Estilos da UI.                                               |
| `eslint.config.js` / `.prettierrc`         | Lint (ESLint) e formatação (Prettier).                       |
| `vitest.config.ts`                         | Testes (Vitest) da lógica pura.                              |
| `.github/workflows/ci.yml`                 | CI: lint, format, typecheck, test e build.                   |

## Modo DEBUG

O painel tem um botão **Mostrar DEBUG** que exibe a última apresentação crua
lida (também gravada em `storage['debug:last']`), útil para investigar o formato
de novos tipos de conteúdo.

## Licença

Distribuído sob a licença **MIT**. Veja [`LICENSE`](LICENSE).
