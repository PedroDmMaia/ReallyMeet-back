# Really Meet — Backend

API NestJS com autenticação e-mail/senha (JWT access + refresh), salas públicas e emissão de tokens LiveKit. MySQL via Prisma.

## Subir em desenvolvimento

1. MySQL local:

```powershell
docker compose up -d
```

2. API:

```powershell
Copy-Item .env.example .env
# Ajuste LIVEKIT_* e secrets JWT
npm install
npx prisma migrate deploy
npm run start:dev
```

Endpoints principais e exemplos: [docs/api.md](docs/api.md).  
Swagger interativo: `http://127.0.0.1:3000/docs`.

## Deploy na Hostinger (Node.js)

O painel só permite escolher **um script npm por campo**. Use:

| Campo no painel | Escolha |
|-----------------|--------|
| Comando de construção | **`build:hostinger`** |
| Gerenciador de pacotes | `npm` |
| Diretório de saída | `dist` |
| Arquivo de entrada | **`main.js`** (relativo à pasta `dist`, **não** `dist/main.js`) |

Script de execução (se houver campo separado): **`start:prod`**.

Com saída em `dist`, a Hostinger procura o entry **dentro** de `dist/`. Se você usar `dist/main.js`, ela falha com *Entry file not found*.

O build **não** conecta no MySQL, mas copia o schema para `dist/database/prisma` (Hostinger publica só `dist/` — **não** sobrescreve `dist/prisma/*.js` do Nest).

Na subida, defina no painel:

```env
RUN_MIGRATIONS_ON_BOOT=1
```

Isso roda `prisma migrate deploy` antes do Nest (sem `npx`, usando o CLI em `node_modules`). Localmente omita essa variável.

Se a migration falhar, veja no log as linhas `[really-meet] prisma stderr:` (credenciais, host MySQL, SSL). Emergência: aplique `prisma/migrations/.../migration.sql` no phpMyAdmin e use `SKIP_PRISMA_MIGRATE=1` ou remova `RUN_MIGRATIONS_ON_BOOT`.

### `DATABASE_URL` na Hostinger

No painel de variáveis de ambiente (não use `localhost` do Docker local). Copie do hPanel → **Bancos de dados MySQL** → host remoto, usuário, senha e nome do banco, por exemplo:

```env
DATABASE_URL="mysql://USUARIO:SENHA@mysql123.hostinger.com:3306/u123456789_reallymeet"
```

Codifique caracteres especiais da senha na URL (`@` → `%40`, `#` → `%23`, etc.). No Node na mesma conta Hostinger, o host costuma ser o **MySQL hostname** do hPanel (às vezes `127.0.0.1` também funciona).

Se o log mostrar `localhost:3306`, a variável não está no painel (ou um `.env` antigo sobrescreve) — defina `DATABASE_URL` só no painel e redeploy.

Demais variáveis: JWT, LiveKit, `CORS_ORIGINS` (URL do front), **SMTP** para OTP (`MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`). Em dev, sem SMTP: `MAIL_DEV_RETURN_CODE=1` mostra o código na API/tela e no log; **não** use isso em produção com SMTP desligado.

**Hostinger:** crie um e-mail no hPanel (ex. `noreply@seudominio.com`), use `smtp.hostinger.com`, porta **465**, `MAIL_SECURE=true`, usuário = endereço completo, senha = da caixa de e-mail.

## Scripts

| Script | Função |
|--------|--------|
| `npm run start:dev` | API em watch |
| `npm run build` | Compila TypeScript (local) |
| `npm run build:hostinger` | Generate Prisma + build (Hostinger, sem DB) |
| `npm run start:hostinger` | Migrations + API (`node server.js`) |
| `npm run prisma:generate` | Gera Prisma Client |
| `npm run prisma:migrate` | Migration interativa (dev) |
| `npm run prisma:deploy` | Aplica migrations (CI/prod) |

## Variáveis (`.env`)

Veja `.env.example`. Em produção, troque:

- `DATABASE_URL`
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`
- `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET`
- `CORS_ORIGINS`

## Modelo

- **User** — conta com e-mail + senha (bcrypt)
- **RefreshToken** — hash SHA-256 do refresh, com expiração e revogação
- **Room** — `slug` (nome LiveKit), título, pública/privada, status `OPEN`/`CLOSED`

## Segurança (MVP)

- Secret LiveKit **somente** no backend
- Rate limit global + mais restrito em `/auth/login`
- Refresh tokens hasheados no banco
- Validação de DTOs com `class-validator`
