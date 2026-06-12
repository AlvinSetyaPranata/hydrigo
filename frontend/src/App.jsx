import { useEffect, useState } from 'react'
import './App.css'
import { buildApiUrl } from './lib/api'
import { getMqttClient, publishTopic, subscribeTopic } from './lib/mqttClient'

const CONTROL_TOPIC = 'hydrigo/lettuce/control'
const SENSOR_TOPIC = 'hydrigo/lettuce/sensor'
const STATUS_TOPIC = 'hydrigo/lettuce/status'
const MODE_LABELS = {
  manual: 'Manual',
  automatic: 'Otomatis',
}
const MANUAL_CONTROL_META = {
  'nutrient-pump': {
    name: 'Pompa Nutrisi',
    description: 'Kontrol manual pompa nutrisi tanpa inferensi model.',
  },
  'water-pump': {
    name: 'Pompa Air',
    description: 'Kontrol manual pompa air / penambah air.',
  },
}

function mapControlModeToLabel(mode, fallbackLabel = '') {
  return MODE_LABELS[mode] ?? fallbackLabel
}

function buildManualControlsFromState(state = {}) {
  return [
    {
      id: 'nutrient-pump',
      ...MANUAL_CONTROL_META['nutrient-pump'],
      status: Boolean(state.pompaNutrisi),
    },
    {
      id: 'water-pump',
      ...MANUAL_CONTROL_META['water-pump'],
      status: Boolean(state.pompaAir),
    },
  ]
}

function inferManualControlState(controls = []) {
  return {
    pompaNutrisi: Boolean(
      controls.find((item) => item.id === 'nutrient-pump')?.status,
    ),
    pompaAir: Boolean(
      controls.find((item) => item.id === 'water-pump')?.status,
    ),
  }
}

function inferDashboardData(readings) {
  const latest = readings[0]

  if (!latest) {
    return {
      summaryCards: [],
      heroStats: [
        { value: '0', label: 'reading tersimpan' },
        { value: '0', label: 'bed terpantau' },
        { value: '-', label: 'mode kontrol' },
      ],
      sensorSnapshot: {
        ph: '--',
        waterTemp: '--',
        humidity: '--',
      },
      lettuceBeds: [],
      activities: [],
      schedule: [],
      chartBars: [],
      nutrientMode: 'Belum tersedia',
    }
  }

  const latestByBed = new Map()
  for (const reading of readings) {
    if (!latestByBed.has(reading.lettuce_bed_id)) {
      latestByBed.set(reading.lettuce_bed_id, reading)
    }
  }

  const bedReadings = [...latestByBed.values()]
  const avgPh =
    bedReadings.reduce((sum, item) => sum + item.ph, 0) / bedReadings.length
  const avgWater =
    bedReadings.reduce((sum, item) => sum + item.water_level_pct, 0) /
    bedReadings.length
  const pumpOnCount = bedReadings.filter((item) => item.pump_status === true).length

  const inferredMode =
    latest.tds_ppm < 600 ? 'Semai' : latest.tds_ppm < 900 ? 'Vegetatif' : 'Finishing'

  return {
    summaryCards: [
      {
        label: 'Reading terakhir',
        value: new Date(latest.recorded_at).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
        note: `Device ${latest.device_id} • transaksi ${latest.transaction_id}`,
      },
      {
        label: 'Rata-rata pH',
        value: new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(avgPh),
        note: 'Dihitung dari reading terbaru tiap bed.',
      },
      {
        label: 'Level air rata-rata',
        value: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(avgWater)}%`,
        note: `${pumpOnCount} pompa aktif dari ${bedReadings.length} bed terpantau.`,
      },
    ],
    heroStats: [
      { value: String(readings.length), label: 'reading tersimpan' },
      { value: String(bedReadings.length), label: 'bed terpantau' },
      { value: inferredMode, label: 'mode data' },
    ],
    sensorSnapshot: {
      ph: new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(latest.ph),
      waterTemp: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(latest.temperature_c)}°C`,
      humidity: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(latest.humidity_pct)}%`,
    },
    lettuceBeds: bedReadings.map((reading) => ({
      name: reading.device_id,
      zone: reading.lettuce_bed_id,
      phase: reading.device_phase || 'Monitoring aktif',
      humidity: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(reading.humidity_pct)}%`,
      temp: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(reading.temperature_c)}°C`,
      ec: `${new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(reading.tds_ppm)} ppm`,
      status:
        reading.humidity_pct < 45 ||
        reading.humidity_pct > 85 ||
        reading.ph < 5.5 ||
        reading.ph > 7 ||
        reading.temperature_c < 18 ||
        reading.temperature_c > 30 ||
        reading.water_level_pct < 30
          ? 'Perlu cek'
          : 'Stabil',
      health: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            100 -
              Math.abs(reading.ph - 6.2) * 12 -
              Math.max(0, Math.abs(reading.temperature_c - 24) - 2) * 4 -
              Math.max(0, Math.abs(reading.humidity_pct - 70) - 10) * 0.8 -
              Math.max(0, 40 - reading.water_level_pct) * 0.7,
          ),
        ),
      ),
    })),
    activities: readings.slice(0, 5).map((reading) => ({
      time: new Date(reading.recorded_at).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      title: `Reading ${reading.device_id}`,
      detail: `pH ${reading.ph} • air ${reading.temperature_c}°C • hash #${reading.block_index}`,
    })),
    schedule: bedReadings.slice(0, 3).map((reading, index) => ({
      task: `Cek bed ${reading.lettuce_bed_id}`,
      due: new Date(reading.recorded_at).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
      owner: index === 0 ? 'Data terbaru' : 'Hydrigo backend',
    })),
    chartBars: bedReadings.slice(0, 6).map((reading) => ({
      label: reading.lettuce_bed_id,
      value: Math.round(reading.water_level_pct),
    })),
    nutrientMode: inferredMode,
  }
}

function getActivityHref(item) {
  const text = `${item.title} ${item.detail}`.toLowerCase()

  if (
    text.includes('nutrisi') ||
    text.includes('ec') ||
    text.includes('ph') ||
    text.includes('suhu') ||
    text.includes('air') ||
    text.includes('humidity')
  ) {
    return '#sensor-panel'
  }

  if (
    text.includes('selada') ||
    text.includes('daun') ||
    text.includes('rak') ||
    text.includes('bed')
  ) {
    return '#beds-panel'
  }

  return '#schedule-panel'
}

function App() {
  const [dashboardData, setDashboardData] = useState(null)
  const [manualControls, setManualControls] = useState([])
  const [nutrientMode, setNutrientMode] = useState('')
  const [brokerState, setBrokerState] = useState('Connecting')
  const [apiState, setApiState] = useState('Loading')
  const [apiError, setApiError] = useState('')
  const [sensorSnapshot, setSensorSnapshot] = useState({
    ph: '--',
    waterTemp: '--',
    humidity: '--',
  })

  useEffect(() => {
    let ignore = false

    async function loadDashboard() {
      try {
        const [readingsResponse, controlsResponse, modeResponse] = await Promise.all([
          fetch(buildApiUrl('/api/v1/readings?limit=20')),
          fetch(buildApiUrl('/api/v1/controls/manual')),
          fetch(buildApiUrl('/api/v1/controls/mode')),
        ])
        const readingsResult = await readingsResponse.json()

        if (!readingsResponse.ok || ignore) {
          throw new Error(readingsResult?.error || 'Invalid dashboard response')
        }

        const nextDashboardData = inferDashboardData(readingsResult.data ?? [])
        setDashboardData(nextDashboardData)
        setSensorSnapshot(
          nextDashboardData.sensorSnapshot ?? {
            ph: '--',
            waterTemp: '--',
            humidity: '--',
          },
        )

        if (controlsResponse.ok) {
          const controlsResult = await controlsResponse.json()
          setManualControls(buildManualControlsFromState(controlsResult))
        } else {
          setManualControls(buildManualControlsFromState())
        }

        if (modeResponse.ok) {
          const modeResult = await modeResponse.json()
          const mode = modeResult?.data?.mode ?? modeResult?.mode
          setNutrientMode(mapControlModeToLabel(mode, nextDashboardData.nutrientMode))
        } else {
          setNutrientMode(nextDashboardData.nutrientMode ?? '')
        }
        setApiState('Connected')
        setApiError('')
      } catch (error) {
        if (!ignore) {
          setApiState('Error')
          setApiError(error.message || 'Failed to load dashboard data')
        }
      }
    }

    loadDashboard()

    return () => {
      ignore = true
    }
  }, [])

  useEffect(() => {
    const client = getMqttClient()

    const handleConnect = () => setBrokerState('Connected')
    const handleReconnect = () => setBrokerState('Reconnecting')
    const handleClose = () => setBrokerState('Offline')
    const handleError = () => setBrokerState('Error')

    client.on('connect', handleConnect)
    client.on('reconnect', handleReconnect)
    client.on('close', handleClose)
    client.on('error', handleError)

    const unsubscribeSensor = subscribeTopic(SENSOR_TOPIC, (message) => {
      try {
        const payload = JSON.parse(message)
        setSensorSnapshot((current) => ({
          ph: payload.ph ?? current.ph,
          waterTemp: payload.waterTemp ?? current.waterTemp,
          humidity: payload.humidity ?? current.humidity,
        }))
      } catch {
        setBrokerState('Payload Error')
      }
    })

    const unsubscribeStatus = subscribeTopic(STATUS_TOPIC, (message) => {
      try {
        const payload = JSON.parse(message)

        if (payload.controls) {
          setManualControls(buildManualControlsFromState(payload.controls))
        } else if (Array.isArray(payload.controls)) {
          setManualControls(buildManualControlsFromState(inferManualControlState(payload.controls)))
        }

        if (payload.nutrientMode) {
          setNutrientMode(payload.nutrientMode)
        }

        if (payload.mode) {
          setNutrientMode(mapControlModeToLabel(payload.mode, payload.nutrientMode))
        }

        if (payload.controlMode === 1) {
          setNutrientMode('Manual')
        } else if (payload.controlMode === 0) {
          setNutrientMode('Otomatis')
        }
      } catch {
        setBrokerState('Payload Error')
      }
    })

    return () => {
      unsubscribeSensor()
      unsubscribeStatus()
      client.off('connect', handleConnect)
      client.off('reconnect', handleReconnect)
      client.off('close', handleClose)
      client.off('error', handleError)
      client.end()
    }
  }, [])

  const toggleControl = async (id) => {
    const currentControl = manualControls.find((item) => item.id === id)
    const nextStatus = !(currentControl?.status ?? false)

    try {
      const payload =
        id === 'nutrient-pump'
          ? { pompaNutrisi: nextStatus }
          : { pompaAir: nextStatus }

      const response = await fetch(buildApiUrl('/api/v1/controls/manual'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update control')
      }

      setManualControls(buildManualControlsFromState(result))
      publishTopic(CONTROL_TOPIC, {
        type: 'manual_control',
        target: id,
        value: nextStatus,
      })
    } catch (error) {
      setApiError(error.message || 'Failed to update control state')
      setApiState('Error')
    }
  }

  const updateNutrientMode = async (mode) => {
    try {
      const response = await fetch(buildApiUrl('/api/v1/controls/mode'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.error || 'Failed to update nutrient mode')
      }

      const nextMode = result?.data?.mode ?? result?.mode ?? mode
      setNutrientMode(mapControlModeToLabel(nextMode, mode))
      publishTopic(CONTROL_TOPIC, {
        type: 'nutrient_mode',
        value: nextMode,
      })
    } catch (error) {
      setApiError(error.message || 'Failed to update nutrient mode')
      setApiState('Error')
    }
  }

  if (apiState === 'Loading') {
    return (
      <main className="dashboard dashboard-state">
        <section className="state-card">
          <span className="eyebrow">Hydrigo Lettuce Monitor</span>
          <h1>Memuat data dashboard dari backend.</h1>
          <p>Frontend hanya menunggu data PostgreSQL dari endpoint API.</p>
        </section>
      </main>
    )
  }

  if (apiState === 'Error' || !dashboardData) {
    return (
      <main className="dashboard dashboard-state">
        <section className="state-card">
          <span className="eyebrow">Hydrigo Lettuce Monitor</span>
          <h1>Backend belum mengirim data dashboard.</h1>
          <p>{apiError || 'Periksa koneksi API dan data fixture PostgreSQL.'}</p>
        </section>
      </main>
    )
  }

  const heroStats = [
    dashboardData.heroStats?.[0] ?? { value: '-', label: 'rak selada aktif' },
    { value: apiState, label: 'status backend api' },
    { value: brokerState, label: 'status broker mqtt' },
  ]

  return (
    <main className="dashboard">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="eyebrow">Hydrigo Lettuce Monitor</span>
          <h1>Monitoring khusus budidaya selada hidroponik.</h1>
          <p>
            Fokus pada kondisi selada dari semai sampai panen: suhu larutan,
            kelembapan, EC, pH, dan kesiapan panen dalam satu dashboard.
          </p>

          <div className="hero-stats">
            {heroStats.map((item) => (
              <div key={item.label}>
                <strong>{item.value}</strong>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="hero-visual">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="glass-card">
            <div className="glass-header">
              <span>Kondisi Larutan Selada</span>
              <span className="live-badge">{apiState}</span>
            </div>
            <div className="climate-ring">
              <div className="ring-core">
                <strong>{sensorSnapshot.humidity}</strong>
                <span>Kelembapan ruang ideal</span>
              </div>
            </div>
            <div className="mini-metrics">
              <div>
                <span>pH Larutan</span>
                <strong>{sensorSnapshot.ph}</strong>
              </div>
              <div>
                <span>Suhu Air</span>
                <strong>{sensorSnapshot.waterTemp}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="summary-grid">
        {dashboardData.summaryCards.map((card) => (
          <article key={card.label} className="summary-card">
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p>{card.note}</p>
          </article>
        ))}
      </section>

      <section className="content-grid">
        <article className="panel panel-large">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Performa Mingguan</span>
              <h2>Skor kesehatan selada</h2>
            </div>
            <button className="ghost-button">Unduh laporan</button>
          </div>

          <div className="chart-card">
            <div className="chart-bars" aria-label="Grafik kesehatan selada mingguan">
              {dashboardData.chartBars.map((item) => (
                <div key={item.label} className="bar-group">
                  <div
                    className="bar-fill"
                    style={{ height: `${item.value}%` }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="chart-insight">
              <strong>Data dari PostgreSQL backend</strong>
              <p>
                Dashboard hanya merender data yang dikirim API backend, tanpa
                fixture fallback dari frontend.
              </p>
            </div>
          </div>
        </article>

        <article className="panel" id="sensor-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Kontrol Manual</span>
              <h2>Kendali sistem selada</h2>
            </div>
          </div>

          <div className="mqtt-note">
            API data dari <code>{buildApiUrl('/api/v1/readings?limit=20')}</code>. Update kontrol
            ke <code>{buildApiUrl('/api/v1/controls/manual')}</code> dan <code>{buildApiUrl('/api/v1/controls/mode')}</code>.
          </div>

          {nutrientMode === 'Manual' ? (
            <div className="manual-control-list">
              {manualControls.map((control) => (
                <div key={control.id} className="manual-control-card">
                  <div className="manual-control-top">
                    <div>
                      <strong>{control.name}</strong>
                      <p>{control.description}</p>
                    </div>
                    <button
                      type="button"
                      className={`toggle-switch ${control.status ? 'active' : ''}`}
                      onClick={() => toggleControl(control.id)}
                      aria-pressed={control.status}
                      aria-label={`${control.name} ${control.status ? 'aktif' : 'nonaktif'}`}
                    >
                      <span />
                    </button>
                  </div>
                  <span className={`manual-badge ${control.status ? 'on' : 'off'}`}>
                    {control.status ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="manual-mode-card">
              <div className="manual-mode-head">
                <div>
                  <strong>Mode Otomatis Aktif</strong>
                  <p>Sistem dikontrol otomatis oleh KNN.</p>
                </div>
                <span className="manual-badge off">Manual Dinonaktifkan</span>
              </div>
            </div>
          )}

          <div className="manual-mode-card">
            <div className="manual-mode-head">
              <div>
                <strong>Mode Kontrol</strong>
                <p>
                  {nutrientMode === 'Manual'
                    ? 'KNN nonaktif, pompa dikontrol manual dari aplikasi.'
                    : 'Sistem dikontrol otomatis oleh KNN.'}
                </p>
              </div>
              <span className="manual-badge on">{nutrientMode}</span>
            </div>
            <div className="mode-options">
              {['manual', 'automatic'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`mode-chip ${nutrientMode === mapControlModeToLabel(mode, mode) ? 'selected' : ''}`}
                  onClick={() => updateNutrientMode(mode)}
                >
                  {mapControlModeToLabel(mode, mode)}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="panel panel-large" id="beds-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Rak Selada</span>
              <h2>Monitoring varietas selada</h2>
            </div>
          </div>

          <div className="plant-list">
            {dashboardData.lettuceBeds.map((plant) => (
              <article key={plant.name} className="plant-card">
                <div className="plant-main">
                  <div>
                    <h3>{plant.name}</h3>
                    <p>
                      {plant.zone} • {plant.phase}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${plant.status === 'Perlu cek' ? 'warn' : 'good'}`}
                  >
                    {plant.status}
                  </span>
                </div>

                <div className="plant-metrics">
                  <div>
                    <span>Kelembapan</span>
                    <strong>{plant.humidity}</strong>
                  </div>
                  <div>
                    <span>Suhu</span>
                    <strong>{plant.temp}</strong>
                  </div>
                  <div>
                    <span>EC</span>
                    <strong>{plant.ec}</strong>
                  </div>
                </div>

                <div className="health-row">
                  <span>Skor kesehatan</span>
                  <div className="health-track">
                    <div
                      className="health-fill"
                      style={{ width: `${plant.health}%` }}
                    />
                  </div>
                  <strong>{plant.health}%</strong>
                </div>
              </article>
            ))}
          </div>
        </article>

        <article className="panel" id="schedule-panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Agenda Hari Ini</span>
              <h2>Jadwal perawatan selada</h2>
            </div>
          </div>

          <div className="schedule-list">
            {dashboardData.schedule.map((item) => (
              <div key={item.task} className="schedule-item">
                <div>
                  <strong>{item.task}</strong>
                  <p>{item.owner}</p>
                </div>
                <span>{item.due}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel panel-full">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Aktivitas</span>
              <h2>Log operasional selada</h2>
            </div>
          </div>

          <div className="activity-list">
            {dashboardData.activities.map((item) => (
              <a
                key={`${item.time}-${item.title}`}
                className="activity-item activity-link"
                href={getActivityHref(item)}
              >
                <span>{item.time}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </a>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
