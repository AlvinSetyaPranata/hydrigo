import '@nomicfoundation/hardhat-toolbox'
import dotenv from 'dotenv'

dotenv.config()

export default {
  solidity: '0.8.28',
  networks: {
    docker: {
      url: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
      accounts: [
        process.env.BLOCKCHAIN_PRIVATE_KEY ||
          '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      ],
    },
  },
}
