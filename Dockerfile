FROM node:22-alpine AS builder
RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN pnpm run build

# Stage 2: Production (Service de l'application compilée)
FROM node:22-alpine

WORKDIR /app

# Copier uniquement les artefacts nécessaires depuis le stage 'builder'
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Exposer le port sur lequel Next.js écoute
EXPOSE 3000

# Variable d'environnement pour indiquer qu'on est en production
ENV NODE_ENV production

ARG NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
# Commande pour démarrer le serveur Next.js en production
CMD ["node", "server.js"]