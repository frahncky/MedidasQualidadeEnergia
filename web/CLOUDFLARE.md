# Configuracao no Cloudflare

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
O Vite gera `dist/`, e o Wrangler publica exatamente esse diretorio como assets estaticos.

Nao adicione `public/_redirects` para SPA neste modo. O fallback ja e feito por:

```toml
[assets]
not_found_handling = "single-page-application"
```
