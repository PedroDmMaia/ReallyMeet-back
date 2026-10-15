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

## Scripts

| Script | Função |
|--------|--------|
| `npm run start:dev` | API em watch |
| `npm run build` | Compila TypeScript |
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
