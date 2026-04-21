FROM node:22-alpine
WORKDIR /app

COPY api/package.json ./
RUN npm install

COPY api/src ./src

EXPOSE 3001
CMD ["npm", "start"]
