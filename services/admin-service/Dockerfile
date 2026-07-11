FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx prisma generate
RUN npx tsc
EXPOSE 3006
ENV PORT=3006
CMD ["node", "dist/index.js"]
