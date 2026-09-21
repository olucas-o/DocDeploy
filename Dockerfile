# syntax=docker/dockerfile:1
FROM node:24-alpine AS dependencies

WORKDIR /app
COPY api/package.json api/package-lock.json ./
RUN npm ci

FROM dependencies AS build

COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build

FROM node:24-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY api/package.json api/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
