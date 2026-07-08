FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3013
ENV PORT=3013
ENV REDIS_HOST=redis
ENV POSTGRES_HOST=postgres
CMD ["node", "dist/index.js"]