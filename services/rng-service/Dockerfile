FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3004
CMD ["node", "dist/index.js"]
