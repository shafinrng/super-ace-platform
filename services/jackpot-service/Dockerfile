FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3011
ENV PORT=3011
ENV REDIS_HOST=redis
CMD ["node", "dist/index.js"]