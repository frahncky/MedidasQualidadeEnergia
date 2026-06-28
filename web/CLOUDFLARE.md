# Configuracao no Cloudflare

Este projeto esta configurado para Cloudflare com `Root directory` apontando para `web`.

Use:

```text
Build command: npm run build
Deploy command: npx wrangler deploy
Root directory: web
Build output directory: dist
Node version: 20
```

O `wrangler.toml` fica nesta pasta porque o Cloudflare executa o build dentro de `web`.
O Vite gera `dist/`, e o Wrangler publica exatamente esse diretorio como assets estaticos.
