import express from 'express'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import pg from 'pg'

const app = express()
app.use(express.json())
const { Pool } = pg

const port = Number(process.env.PORT || 3001)
const redisUrl = process.env.REDIS_URL || 'redis://redis:6379'
const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://hydrigo:hydrigo@postgres:5432/hydrigo'
const redis = new Redis(redisUrl, { maxRetriesPerRequest: null })
const ingestQueue = new Queue('iot-ingest', { connection: redis })
const pool = new Pool({ connectionString: databaseUrl })

async function getDashboardFixture() {
  const result = await pool.query(
    `
      select payload
      from dashboard_fixtures
      where slug = $1
      limit 1
    `,
    ['main'],
  )

  if (result.rowCount === 0) {
    throw new Error('dashboard fixture not found in postgresql')
  }

  return result.rows[0].payload
}

async function saveDashboardFixture(payload) {
  await pool.query(
    `
      update dashboard_fixtures
      set payload = $2::jsonb,
          updated_at = now()
      where slug = $1
    `,
    ['main', JSON.stringify(payload)],
  )
}

app.get('/health', async (_req, res) => {
  try {
    await redis.ping()
    await pool.query('select 1')
    res.json({ ok: true, service: 'api', database: 'connected' })
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message })
  }
})

app.get('/dashboard', async (_req, res) => {
  try {
    return res.json({
      ok: true,
      data: await getDashboardFixture(),
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/ingest', async (req, res) => {
  const payload = req.body

  if (!payload?.deviceId || !payload?.timestamp) {
    return res.status(400).json({
      ok: false,
      error: 'deviceId and timestamp are required',
    })
  }

  const job = await ingestQueue.add('sensor-reading', payload, {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 200,
    removeOnFail: 500,
  })

  return res.status(202).json({
    ok: true,
    queued: true,
    jobId: job.id,
  })
})

app.post('/controls/manual', async (req, res) => {
  try {
    const { controlId, status } = req.body

    if (!controlId || typeof status !== 'boolean') {
      return res.status(400).json({
        ok: false,
        error: 'controlId and boolean status are required',
      })
    }

    const dashboard = await getDashboardFixture()
    const nextControls = (dashboard.manualControls ?? []).map((item) =>
      item.id === controlId ? { ...item, status } : item,
    )

    dashboard.manualControls = nextControls
    await saveDashboardFixture(dashboard)

    return res.json({
      ok: true,
      data: nextControls,
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.post('/controls/nutrient-mode', async (req, res) => {
  try {
    const { mode } = req.body

    if (!mode) {
      return res.status(400).json({
        ok: false,
        error: 'mode is required',
      })
    }

    const dashboard = await getDashboardFixture()
    dashboard.nutrientMode = mode
    await saveDashboardFixture(dashboard)

    return res.json({
      ok: true,
      data: {
        nutrientMode: mode,
      },
    })
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message,
    })
  }
})

app.listen(port, () => {
  console.log(`HTTP ingest API listening on ${port}`)
})
