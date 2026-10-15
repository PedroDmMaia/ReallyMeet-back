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
| Arquivo de entrada | `dist/main.js` |

Script de execução (se houver campo separado): **`start:prod`**.

O `postinstall` roda `prisma generate` após o `npm install` da Hostinger. O `build:hostinger` compila o Nest e aplica migrations no MySQL de produção.

Configure no painel as variáveis do `.env.example` (`DATABASE_URL`, JWT, LiveKit, `CORS_ORIGINS` com a URL do seu front).

## Scripts

| Script | Função |
|--------|--------|
| `npm run start:dev` | API em watch |
| `npm run build` | Compila TypeScript (local) |
| `npm run build:hostinger` | Generate Prisma + build + migrate deploy (Hostinger) |
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
