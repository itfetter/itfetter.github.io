FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json ./
RUN npm ci
WORKDIR /app
COPY scripts/build.mjs scripts/editor-assets.mjs ./scripts/
COPY index.html ./
COPY articles/index.html ./articles/index.html
COPY archive/index.html ./archive/index.html
COPY about/index.html ./about/index.html
COPY admin/index.html ./admin/index.html
COPY assets/ ./assets/
COPY _layouts/post.html ./_layouts/post.html
RUN node scripts/build.mjs

FROM node:24.19.0-bookworm-slim AS dependencies
WORKDIR /app/worker
COPY worker/package.json worker/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:24.19.0-bookworm-slim AS runtime
ARG REVISION=unknown
LABEL org.opencontainers.image.source="https://github.com/itfetter/itfetter.github.io" \
      org.opencontainers.image.title="itfetter-blog" \
      org.opencontainers.image.revision=$REVISION
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data UPLOADS_DIR=/uploads
WORKDIR /app
COPY --from=dependencies /app/worker/node_modules ./worker/node_modules
COPY worker/package.json worker/*.js worker/*.mjs ./worker/
COPY worker/migrations/ ./worker/migrations/
COPY server/*.mjs ./server/
COPY --from=build /app/dist ./dist
RUN mkdir /data /uploads && chown node:node /data /uploads
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["node","-e","fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node","server/main.mjs"]
