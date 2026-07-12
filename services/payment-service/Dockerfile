FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx prisma generate
RUN npx tsc
EXPOSE 3004
ENV PORT=3004
CMD ["node", "dist/index.js"]
