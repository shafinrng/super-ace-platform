FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3001
ENV PORT=3001
ENV DATABASE_URL=postgresql://superace:superace123@postgres:5432/superace_db
ENV REDIS_URL=redis://redis:6379
CMD ["node", "dist/index.js"]