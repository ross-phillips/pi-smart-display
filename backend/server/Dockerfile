# server/Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY lib ./lib
EXPOSE 8787
CMD ["node", "server.js"]
