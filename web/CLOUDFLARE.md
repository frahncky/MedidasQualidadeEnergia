# Configuração no Cloudflare

Este projeto esta configurado para Cloudflare com `Root directory` apontando para `web`.

Use:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: web
Build output directory: dist
Node version: 22
```

Se o log ainda mostrar Node 20, adicione uma variavel de ambiente no Cloudflare:

```text
NODE_VERSION=22.16.0
```

Em Workers & Pages, abra o projeto, va em Settings > Build > Variables and Secrets
ou Environment variables, e crie essa variavel para Production.

O `wrangler.toml` fica nesta pasta porque o Cloudflare executa o build dentro de `web`.
O Vite gera `dist/`, e o Wrangler publica exatamente esse diretório como assets estáticos.

Não adicione `public/_redirects` nem `not_found_handling = "single-page-application"`.
O app usa navegação por estado (abas), sem roteamento de URL. O Cloudflare serve
`index.html` automaticamente para `/`. A opção SPA causava loop infinito na
validação do Wrangler 4.105.0+ (erro 100324).
