FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3000
ENV PORT=3000
ENV NEXT_PUBLIC_API_URL=http://localhost:3001
CMD ["node", "dist/index.js"]