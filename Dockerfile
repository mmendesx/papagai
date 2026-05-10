FROM node:22-alpine AS builder
WORKDIR /app
ARG DATABASE_URL=postgresql://papagai:papagai@localhost:5432/papagai
ENV DATABASE_URL=${DATABASE_URL}
COPY package*.json ./
RUN npm ci
COPY client/.npmrc client/package*.json client/
RUN cd client && npm ci
COPY . .
RUN npx prisma generate
RUN npm run build:all

FROM node:22-alpine
WORKDIR /app
ARG DATABASE_URL=postgresql://papagai:papagai@localhost:5432/papagai
ENV DATABASE_URL=${DATABASE_URL}
RUN addgroup -S papagai && adduser -S papagai -G papagai
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
RUN npx prisma generate
RUN apk add --no-cache curl
USER papagai
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
