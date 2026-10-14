// Declara o global `spresenter` para o TypeScript em todo o projeto.
//
// O entry `@spresenter/plugin-sdk/code` é SOMENTE tipos (o `exports` do pacote
// não define condição de runtime para ele). Por isso a importação fica aqui, num
// arquivo de declaração: o Vite/esbuild não processa `.d.ts`, então o bundle
// nunca tenta resolver um módulo que não existe em runtime.
import '@spresenter/plugin-sdk/code';
