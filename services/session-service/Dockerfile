FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3008
ENV PORT=3008
ENV REDIS_HOST=redis
ENV REDIS_URL=redis://redis:6379
CMD ["node", "dist/index.js"]