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
USER papagai
EXPOSE 3000
CMD ["node", "dist/main.js"]
