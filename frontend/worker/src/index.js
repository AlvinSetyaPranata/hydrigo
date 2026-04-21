import { Worker } from 'bullmq'
import Redis from 'ioredis'
import { ethers } from 'ethers'
import pg from 'pg'
import { sensorRegistryAbi } from './contractAbi.js'

const { Pool } = pg

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://chain:8545'
const privateKey =
  process.env.BLOCKCHAIN_PRIVATE_KEY ||
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const contractAddress = process.env.CONTRACT_ADDRESS
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://hydrigo:hydrigo@postgres:5432/hydrigo'

if (!contractAddress) {
  throw new Error('CONTRACT_ADDRESS is required')
}

const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
const provider = new ethers.JsonRpcProvider(rpcUrl)
const signer = new ethers.Wallet(privateKey, provider)
const contract = new ethers.Contract(contractAddress, sensorRegistryAbi, signer)
const pool = new Pool({ connectionString: databaseUrl })

function toScaledInt(value, decimals = 100) {
  return Math.round(Number(value || 0) * decimals)
}

function toUnixSeconds(value) {
  if (typeof value === 'number') {
    return value
  }

  return Math.floor(new Date(value).getTime() / 1000)
}

async function persistResult(payload, tx) {
  const query = `
    insert into sensor_readings (
      device_id,
      recorded_at,
      ph,
      ec,
      water_temp,
      humidity,
      tx_hash,
      block_number,
      contract_address,
      chain_status,
      raw_payload
    )
    values ($1, to_timestamp($2), $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
  `

  await pool.query(query, [
    payload.deviceId,
    toUnixSeconds(payload.timestamp),
    Number(payload.ph ?? 0),
    Number(payload.ec ?? 0),
    Number(payload.waterTemp ?? 0),
    Number(payload.humidity ?? 0),
    tx.hash,
    tx.blockNumber,
    contractAddress,
    'confirmed',
    JSON.stringify(payload),
  ])
}

new Worker(
  'iot-ingest',
  async (job) => {
    const payload = job.data
    const txResponse = await contract.recordReading(
      payload.deviceId,
      toUnixSeconds(payload.timestamp),
      toScaledInt(payload.ph),
      toScaledInt(payload.ec),
      toScaledInt(payload.waterTemp),
      toScaledInt(payload.humidity),
    )

    const receipt = await txResponse.wait()
    await persistResult(payload, receipt)

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    }
  },
  { connection },
)

console.log('Blockchain worker is consuming iot-ingest queue')
