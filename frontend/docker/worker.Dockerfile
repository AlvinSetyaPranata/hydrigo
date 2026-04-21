FROM node:22-alpine
WORKDIR /app

COPY worker/package.json ./
RUN npm install

COPY worker/src ./src

CMD ["npm", "start"]
