FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3009
ENV PORT=3009
ENV REDIS_HOST=redis
ENV WALLET_URL=http://wallet-service:3003
ENV RNG_URL=http://rng-service:3010
ENV GAME_URL=http://game-engine:3002
ENV SESSION_URL=http://session-service:3008
CMD ["node", "dist/index.js"]