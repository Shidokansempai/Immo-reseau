FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=3000 DATABASE_FILE=/data/conciergerie.db
VOLUME /data
EXPOSE 3000
CMD ["node", "--no-warnings", "src/server.js"]
