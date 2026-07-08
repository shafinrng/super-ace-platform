FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3006
ENV PORT=3006
ENV DATABASE_URL=postgresql://superace:superace123@postgres:5432/superace_db
CMD ["node", "dist/index.js"]