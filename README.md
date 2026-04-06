# 🦜 Papagai

**O papagaio que entrega suas mensagens**

Papagai é um gateway de mensagens multi-dispositivo para WhatsApp. 
Ele repete suas mensagens como um bom papagaio.

## Por que Papagai?

- 🦜 **Repete tudo** - Como um papagaio de verdade
- 📱 **Multi-dispositivo** - Conecte quantos quiser
- 🔗 **Webhooks** - Receba tudo em tempo real
- 🎨 **Mídia** - Imagens, áudios, stickers
- ⚡ **Botões interativos** - Confirmação de códigos

## Como usar

### Com Docker (recomendado)

Sobe a stack completa (PostgreSQL, Redis, app com hot-reload). Sem `.env` necessário — segredos de dev já vêm embutidos. Sem conflitos de porta — serviços comunicam pela rede interna do Compose.

```bash
docker compose -f docker-compose.dev.yml up
```

**Acesso do host (opcional)** — para conectar via `psql`, `redis-cli` ou navegador, adicione o override de portas (`5432`, `6380`, `3000`):

```bash
docker compose -f docker-compose.dev.yml -f docker-compose.ports.yml up
```

### Sem Docker

Precisa de PostgreSQL e Redis rodando localmente.

```bash
npm install
npm run start:dev
```

## Testes

```bash
npm test
```

### Testes end-to-end (e2e)

Os testes em `test/*.e2e-spec.ts` sobem o `AppModule` completo e **conectam ao PostgreSQL** (mesma stack que o TypeORM usa). Sem um Postgres acessível nas variáveis padrão (`DB_HOST`, `DB_PORT`, etc.), `npm run test:e2e` tende a falhar com erro de conexão ao banco.

**Opção rápida:** subir só o banco com Docker Compose e rodar os e2e na máquina host (ajuste `DB_HOST` se necessário). Se o teu Docker for mais antigo, o equivalente é `docker-compose` (com hífen) em vez de `docker compose`.

```bash
docker compose up -d db
# aguarde o healthcheck; em seguida:
npm run test:e2e
```

Para a stack de produção em `docker-compose.yml`, defina **`APP_KEY`** e **`JWT_SECRET`** no ambiente ou num ficheiro `.env` na raiz do projeto — o Compose **não** aceita valores placeholder silenciosos; sem eles, `docker compose up` falha de propósito. Veja `.env.example`.