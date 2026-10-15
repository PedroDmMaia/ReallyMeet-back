# Contrato da API Really Meet (NestJS)

Base URL local: `http://127.0.0.1:3000`  
Swagger: `http://127.0.0.1:3000/docs`

Autenticação: `Authorization: Bearer <accessToken>` nas rotas protegidas.

## Health

### `GET /health`

```json
{ "status": "ok" }
```

## Auth

### `POST /auth/register`

Body:

```json
{
  "email": "pedro@example.com",
  "password": "senha-segura",
  "displayName": "Pedro"
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
