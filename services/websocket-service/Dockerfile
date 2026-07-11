FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3005
ENV PORT=3005
ENV REDIS_URL=redis://redis:6379
CMD ["node", "dist/index.js"]