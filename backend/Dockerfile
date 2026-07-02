# Production backend image — multi-stage: compile TS, then run the built JS with prod deps only.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Production dependencies only (no typescript / vitest / eslint in the runtime image).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Attachment storage (ATTACHMENT_STORAGE_PATH defaults to ./uploads → /app/uploads). Create it up
# front and hand /app to the unprivileged node user; mount a volume here in prod so uploads survive
# redeploys.
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 3000
# Runtime env (LIVEKIT_API_KEY/SECRET/URL/HOST, PORT, CORS_ORIGIN, ATTACHMENT_STORAGE_PATH, …) is
# injected by compose / GitLab CI-CD variables. server.ts fails fast if LiveKit is unreachable, so
# rely on the orchestrator's restart policy rather than an in-image wait loop.
CMD ["node", "dist/server.js"]
