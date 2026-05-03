# Mindora

Este repositório é a fonte oficial do site publicado em `mindoramap.github.io`.

## Deploy

O deploy acontece pelo GitHub Pages via Actions no arquivo `.github/workflows/deploy-pages.yml`.

### Secrets necessários

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

### Publicação

Cada push na branch `main` dispara a build e publica `dist/client` no GitHub Pages.
