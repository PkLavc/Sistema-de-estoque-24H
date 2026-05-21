# Sistema de Estoque 24H

Projeto adaptado para deploy em Cloudflare Workers + D1, mantendo os arquivos do front em `public/` e as rotas da API no Worker.

## Estrutura principal

```text
public/                  Front-end estatico
src/worker.mjs           API e autenticacao no Cloudflare Worker
migrations/0001_initial.sql
scripts/export-sqlite-to-d1.js
wrangler.toml
```

## Comandos

```bash
npm install
npm run dev
npm run deploy
npm run export:d1
npm run backup:sqlite
```

## O que foi preparado

- `wrangler.toml` com assets + binding D1
- `src/worker.mjs` substituindo o backend Express no Cloudflare
- `migrations/0001_initial.sql` com a estrutura do banco no D1
- `scripts/export-sqlite-to-d1.js` para exportar os dados atuais do `database.db`

## Passo a passo de deploy

1. Instale dependencias:

```bash
npm install
```

2. Faça login no Cloudflare:

```bash
npx wrangler login
```

3. Crie o banco D1:

```bash
npx wrangler d1 create sistema-estoque-24h
```

4. Copie o `database_id` retornado e substitua em `wrangler.toml`.

5. Crie o segredo da sessao:

```bash
npx wrangler secret put SESSION_SECRET
```

Use uma senha longa e aleatoria.

6. Aplique a migration:

```bash
npx wrangler d1 migrations apply sistema-estoque-24h --remote
```

7. Se quiser levar os dados do SQLite atual para o D1, gere o arquivo de importacao:

```bash
npm run export:d1
```

8. Importe os dados gerados:

```bash
npx wrangler d1 execute sistema-estoque-24h --remote --file d1-export.sql
```

9. Publice o projeto:

```bash
npm run deploy
```

## Login padrao

- Use um usuario cadastrado no banco.

## Seguranca e backup

- O banco SQLite local principal continua sendo o arquivo `database.db`.
- Os backups locais novos vao para `backups/sqlite/`.
- O servidor local cria um backup automatico ao iniciar e outro antes de excluir cabo ou equipamento.
- Voce tambem pode criar um backup manual com:

```bash
npm run backup:sqlite
```

- Para proteger as sessoes no backend local, defina `SESSION_SECRET`.
- Para proteger a senha de exclusao sem deixa-la no codigo, defina `DELETE_PASSWORD_HASH`.
- Gere o hash com:

```bash
npm run hash:secret -- SUA_SENHA_DE_EXCLUSAO
```

- Exemplo de `.env`:

```env
SESSION_SECRET=troque-por-um-segredo-longo-e-aleatorio
DELETE_PASSWORD_HASH=cole-aqui-o-hash-gerado
```

- No Cloudflare Worker, configure tambem o segredo `DELETE_PASSWORD_HASH`, alem do `SESSION_SECRET`.

## Observacao importante

O arquivo `server.js` continua no repositorio como referencia do backend antigo em Node/Express, mas o deploy para Cloudflare usa `src/worker.mjs`.
