# Changelog

Todas as mudanças relevantes deste plugin são documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o
versionamento segue [SemVer](https://semver.org/lang/pt-BR/).

## [Unreleased]

### Interno

- Adiciona ESLint + Prettier, Vitest com testes da lógica pura, `format:check` e
  Dependabot. O CI passa a rodar lint, format e test, além de typecheck e build.

## [0.3.51] - 2026-10-14

### Adicionado

- Busca por referência no histórico.
- Filtro e agrupamento por culto/setlist.

### Alterado

- Na visão **Por culto**, os itens fixados são agrupados dentro de cada culto,
  com o nome do culto centralizado acima do rótulo "Fixados".
- Referência do item centralizada e nome em amarelo quando fixado.
- Botão de fixar/desafixar com hover invertido (fundo preto, texto verde).

### Corrigido

- Legibilidade do texto do botão "Desafixar" no hover.

## [0.3.50] - 2026-10-13

### Adicionado

- Versão inicial: captura das referências bíblicas apresentadas (evento `live`),
  histórico com horário/saída/camada/culto, fixar/excluir/limpar e reabrir uma
  passagem no ar (`live.apply` + `live.setState`).
- Persistência em `spresenter.storage`.
