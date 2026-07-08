FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3016
ENV PORT=3016
ENV REDIS_HOST=redis
ENV POSTGRES_HOST=postgres
ENV ADMIN_KEY=superace_admin_key_2026
CMD ["node", "dist/index.js"]