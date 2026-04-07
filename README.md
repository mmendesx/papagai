# 🦜 Papagai

**O papagaio que entrega suas mensagens.**

Papagai é um gateway WhatsApp multi-dispositivo self-hosted que expõe uma API REST para gerenciar sessões, enviar todos os tipos de mensagem e receber eventos via webhooks. Inclui um painel web e uma página de documentação de API integrada, tudo servido de uma única origem.

---

## Funcionalidades

- **Gerenciamento de sessões multi-instância** — crie, conecte via QR Code, desconecte e exclua instâncias WhatsApp de forma independente
- **Envio de mensagens** — texto, imagens, áudio, notas de voz, vídeo, documentos, stickers, localização, reações e mensagens com botões interativos
- **Recebimento de mensagens** — todos os tipos capturados, mídia baixada automaticamente e servida como arquivos estáticos
- **Webhooks por instância** — URL configurável, cabeçalhos personalizados, filtro de eventos (message, qr, connected, disconnected, …), ativar/desativar
- **Autenticação JWT** — cadastro e login; todas as rotas de instância são protegidas
- **Painel web** — SPA Angular para gerenciar instâncias, monitorar status, escanear QR Codes e configurar webhooks
- **Documentação de API integrada** — página de referência interativa em `/docs`, sem ferramentas externas
- **Reconexão automática** — sessões reconectam automaticamente após queda de conexão

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Backend | NestJS 11, TypeScript 5.7, Node 22 |
| Banco de dados | PostgreSQL 16 + TypeORM |
| Cache / estado de sessão | Redis 7 |
| WhatsApp | `@whiskeysockets/baileys` (fork whaileys) |
| Frontend | Angular 19, Taiga UI, Tailwind CSS |
| Container | Docker, Docker Compose |

---

## Pré-requisitos

- **Docker + Docker Compose** — para o caminho recomendado de desenvolvimento
- **Node 22 + npm** — para executar o backend ou frontend fora do Docker
- **Git**

---

## Primeiros Passos

### Docker com hot reload (recomendado)

A stack de desenvolvimento sobe PostgreSQL, Redis, o backend NestJS **e** o servidor Angular, todos com hot reload. Os segredos de dev já vêm embutidos — nenhum arquivo `.env` é necessário.

```bash
git clone https://github.com/mmendesx/papagai.git
cd papagai
make dev
```

Ou sem o Make:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Após iniciar:

- **App (Angular com HMR)** → `http://localhost:4200`
- **API diretamente** → `http://localhost:3000`
- Cadastre o primeiro usuário → `http://localhost:4200/register`

Como funciona:

- O código-fonte é montado nos containers via bind mount.
- Alterações em `src/` disparam reinicialização do NestJS (`nest start --watch`) no container `papagai-app`.
- Alterações em `client/src/` disparam HMR do Angular (`ng serve`) no container `papagai-client`.
- O dev server do Angular faz proxy de `/api` para o container `app` via `client/proxy.conf.docker.json` — sem CORS.

> **Desenvolvimento local sem Docker**: se preferir rodar o backend ou o frontend diretamente no host, suba apenas a infra com `make infra` (PostgreSQL + Redis) e execute `npm run start:dev` e/ou `npm run start --prefix client` localmente. O arquivo `client/proxy.conf.json` aponta para `http://localhost:3000` para esse cenário.

---

## Variáveis de Ambiente

Os valores padrão de dev estão pré-definidos em `docker-compose.dev.yml` e em `.env.example`. Em produção, **`APP_KEY` e `JWT_SECRET` devem ser definidos** — o compose de produção falha intencionalmente sem eles.

| Variável | Padrão (dev) | Descrição |
|----------|--------------|-----------|
| `PORT` | `3000` | Porta do servidor HTTP |
| `NODE_ENV` | `development` | Ambiente de execução |
| `APP_KEY` | `dev-app-key` | Segredo da aplicação — **altere em produção** |
| `JWT_SECRET` | `dev-jwt-secret` | Segredo de assinatura JWT — **altere em produção** |
| `DB_HOST` | `localhost` | Host do PostgreSQL |
| `DB_PORT` | `5432` | Porta do PostgreSQL |
| `DB_USER` | `papagai` | Usuário do PostgreSQL |
| `DB_PASS` | `papagai` | Senha do PostgreSQL |
| `DB_NAME` | `papagai` | Nome do banco de dados |
| `REDIS_URL` | `redis://localhost:6380` (local) / `redis://redis:6379` (Docker) | String de conexão do Redis |
| `MEDIA_DIR` | `./media` | Diretório para mídia recebida |
| `INSTANCES_DIR` | `./instances` | Diretório para dados de sessão do Baileys |
| `MAX_INSTANCES` | `10` | Máximo de instâncias WhatsApp simultâneas |
| `LOG_LEVEL` | `info` | Verbosidade dos logs (`debug`, `info`, `warn`, `error`) |

---

## Referência de API

A referência interativa completa está disponível no app em **`/docs`** após o servidor estar rodando.

| Grupo | Endpoints |
|-------|-----------|
| Autenticação | `POST /api/auth/login` · `POST /api/auth/register` |
| Instâncias | `GET /api/instances` · `POST /api/instances/create` · `DELETE /api/instances/:name` |
| Status & QR | `GET /api/instances/:name/status` · `GET /api/instances/:name/qr` |
| Mensagens | `POST /api/instances/:name/send/*` (text, image, audio, video, document, sticker, location, reaction, buttons) |
| Webhooks | `PATCH /api/instances/:name/webhook` |
| Contatos & Conversas | `GET /api/instances/:name/contact/:number` · `GET /api/instances/:name/chats` |

Todas as rotas de instância exigem o cabeçalho `Authorization: Bearer <token>` obtido no endpoint de login.

---

## Testes

**Testes unitários:**

```bash
npm test
```

**Testes end-to-end** (requerem uma instância PostgreSQL em execução):

```bash
docker compose up -d db
# aguarde o healthcheck e então:
npm run test:e2e
```

**Com cobertura:**

```bash
npm run test:cov
```

---

## Produção

A stack de produção exige `APP_KEY` e `JWT_SECRET` definidos no ambiente ou em um arquivo `.env` na raiz do projeto — o compose rejeitará a inicialização sem eles.

```bash
cp .env.example .env
# Defina APP_KEY e JWT_SECRET com valores aleatórios fortes

make prod/build
# equivalente: docker compose up -d --build
```

O `Dockerfile` multi-estágio compila o backend NestJS e o SPA Angular, servindo ambos de um único container Node 22-alpine na porta 3000.
