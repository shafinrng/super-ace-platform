FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci && npm install -g typescript ts-node
COPY . .
RUN npx tsc
EXPOSE 3015
ENV PORT=3015
ENV POSTGRES_HOST=postgres
ENV SERVICE_KEY=superace_audit_key_2026
ENV REGULATOR_KEY=superace_regulator_key_2026
CMD ["node", "dist/index.js"]