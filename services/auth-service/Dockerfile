FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx prisma generate
RUN npx tsc
EXPOSE 3001
ENV PORT=3001
CMD ["node", "dist/index.js"]
