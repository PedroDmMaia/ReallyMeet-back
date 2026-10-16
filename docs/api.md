# Contrato da API Really Meet (NestJS)

Base URL local: `http://127.0.0.1:3000`  
Swagger: `http://127.0.0.1:3000/docs`

Autenticação: `Authorization: Bearer <accessToken>` nas rotas protegidas.

## Health

### `GET /health`

```json
{ "status": "ok" }
```

## Desktop

### `GET /desktop/latest`

Versão mais recente do app desktop, lida das GitHub Releases `desktop-vX.Y.Z` (cache de 5 min). Usada pelo updater do app instalado.

```json
{
  "version": "0.1.1",
  "downloadUrl": "https://github.com/.../ReallyMeet-0.1.1.msi",
  "sha256": "…",
  "notes": "Correções no login",
  "minimumVersion": null,
  "publishedAt": "2026-10-16T02:00:00Z"
}
```

Sem release publicada: `{ "version": null }`.

## Auth

### `POST /auth/check-email`

Valida disponibilidade do e-mail e envia código de 6 dígitos (cadastro). Use no blur do campo e-mail.

Body: `{ "email": "pedro@example.com" }`

Resposta (disponível): `{ "ok": true, "codeSent": true, "expiresInMinutes": 15 }`  
Resposta (já cadastrado): `{ "ok": false, "reason": "email_taken" }`

### `POST /auth/send-registration-code`

Reenvia o código de cadastro (mesmo contrato de sucesso que `check-email`).

### `POST /auth/register`

Body:

```json
{
  "email": "pedro@example.com",
  "password": "senha-segura",
  "displayName": "Pedro",
  "verificationCode": "123456"
}
```

Resposta:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "user": { "id": "...", "email": "...", "displayName": "Pedro" }
}
```

### `POST /auth/login`

Body: `{ "email", "password" }` — mesma forma de resposta do register.

Rate limit mais restrito (anti brute-force).

### `POST /auth/refresh`

Body: `{ "refreshToken": "..." }` — devolve novo par access/refresh (rotação).

Duração padrão (`.env`): access JWT **15 min** (`JWT_ACCESS_EXPIRES_IN`), refresh **7 dias** (`JWT_REFRESH_EXPIRES_IN`). O cliente web guarda ambos no `localStorage`, renova o access via `/auth/refresh` quando expira e só pede login de novo se o refresh passou de 7 dias ou foi revogado (logout).

### `POST /auth/logout`

Body: `{ "refreshToken": "..." }` — revoga o refresh no banco.

### `POST /auth/forgot-password`

Body: `{ "email": "pedro@example.com" }` — envia código de 6 dígitos se o e-mail existir (resposta genérica sempre).

### `POST /auth/reset-password`

Body: `{ "email", "code": "123456", "newPassword" }` — redefine a senha e revoga refresh tokens ativos.

### `GET /auth/me`

Bearer obrigatório. Retorna perfil (`id`, `email`, `displayName`, `createdAt`).

## Salas

### `GET /rooms`

Bearer. Lista salas **públicas** e `OPEN`, ordenadas por `lastActivityAt` desc.

### `POST /rooms`

Bearer. Body:

```json
{ "title": "Game night", "isPublic": true }
```

Cria sala com `slug` sanitizado (usado como `roomName` no LiveKit).

### `GET /rooms/:slug`

Bearer. Detalhe da sala.

### `POST /rooms/:slug/token`

Bearer. Emite JWT LiveKit se a sala estiver `OPEN` e o usuário puder entrar (pública ou dono).

Resposta (compatível com o contrato antigo do token service):

```json
{
  "success": true,
  "token": "<jwt-livekit>",
  "serverUrl": "wss://....livekit.cloud",
  "roomName": "game-night",
  "participantName": "Pedro"
}
```

- `identity` LiveKit = `user.id`
- `name` LiveKit = `user.displayName`
- TTL do token LiveKit ≈ 1h

## Webhook LiveKit

### `POST /livekit/webhook`

Recebe eventos assinados do LiveKit Cloud (`room_started`, `room_finished`, `participant_joined`, `participant_left`) e atualiza `status` / `participantCount` / `lastActivityAt` no MySQL.

Em produção, configure a URL pública no painel LiveKit apontando para este endpoint.

## Fluxo típico (cliente)

1. `POST /auth/register` ou `/auth/login`
2. `GET /rooms` → escolher ou `POST /rooms`
3. `POST /rooms/:slug/token`
4. Conectar no LiveKit Client com `serverUrl` + `token`
