FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY client/package*.json client/
RUN npm ci --prefix client
COPY . .
RUN npm run build:all

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S papagai && adduser -S papagai -G papagai
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
RUN apk add --no-cache curl
USER papagai
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1
CMD ["node", "dist/main.js"]
