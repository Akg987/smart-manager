FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --prefix apps/api

FROM deps AS build
WORKDIR /app
COPY . .
ARG NEST_API_URL=http://api:4000
ENV NEST_API_URL=${NEST_API_URL}
RUN npm run build
RUN ./node_modules/.bin/tsc -p apps/api/tsconfig.json --noEmit false --outDir apps/api/dist --rootDir .

FROM node:24-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --omit=dev --prefix apps/api

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json next.config.ts ./
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--hostname", "0.0.0.0", "-p", "3000"]

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 4000
CMD ["node", "apps/api/dist/apps/api/src/main.js"]

FROM build AS migrate
CMD ["npx", "drizzle-kit", "migrate"]
