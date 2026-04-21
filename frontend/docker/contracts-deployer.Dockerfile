FROM node:22-alpine
WORKDIR /app

COPY contracts/package.json contracts/hardhat.config.js ./
RUN npm install

COPY contracts/contracts ./contracts
COPY contracts/scripts ./scripts

CMD ["sh", "-lc", "npm run compile && until npm run deploy; do echo 'Retrying contract deployment'; sleep 3; done"]
