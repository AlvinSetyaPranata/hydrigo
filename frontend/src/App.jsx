import { useEffect, useState } from 'react'
import './App.css'
import { buildApiUrl } from './lib/api'
import { getMqttClient, publishTopic, subscribeTopic } from './lib/mqttClient'

const CONTROL_TOPIC = 'hydrigo/lettuce/control'
const SENSOR_TOPIC = 'hydrigo/lettuce/sensor'
const STATUS_TOPIC = 'hydrigo/lettuce/status'

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
        const response = await fetch(buildApiUrl('/dashboard'))
        const result = await response.json()

        if (!response.ok || !result?.data || ignore) {
          throw new Error(result?.error || 'Invalid dashboard response')
        }

        setDashboardData(result.data)
        setManualControls(result.data.manualControls ?? [])
        setNutrientMode(result.data.nutrientMode ?? '')
        setSensorSnapshot(
          result.data.sensorSnapshot ?? {
            ph: '--',
            waterTemp: '--',
            humidity: '--',
          },
        )
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

        if (Array.isArray(payload.controls)) {
          setManualControls((current) =>
            current.map((item) => {
              const incoming = payload.controls.find(
                (control) => control.id === item.id,
              )

              return incoming ? { ...item, status: incoming.status } : item
            }),
          )
        }

        if (payload.nutrientMode) {
          setNutrientMode(payload.nutrientMode)
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
      const response = await fetch(buildApiUrl('/controls/manual'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          controlId: id,
          status: nextStatus,
        }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data) {
        throw new Error(result?.error || 'Failed to update control')
      }

      setManualControls(result.data)
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
      const response = await fetch(buildApiUrl('/controls/nutrient-mode'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ mode }),
      })
      const result = await response.json()

      if (!response.ok || !result?.data?.nutrientMode) {
        throw new Error(result?.error || 'Failed to update nutrient mode')
      }

      setNutrientMode(result.data.nutrientMode)
      publishTopic(CONTROL_TOPIC, {
        type: 'nutrient_mode',
        value: mode,
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

        <article className="panel">
          <div className="panel-head">
            <div>
              <span className="section-kicker">Kontrol Manual</span>
              <h2>Kendali sistem selada</h2>
            </div>
          </div>

          <div className="mqtt-note">
            API data dari <code>{buildApiUrl('/dashboard')}</code>. Update kontrol
            ke <code>{buildApiUrl('/controls/manual')}</code> dan <code>{buildApiUrl('/controls/nutrient-mode')}</code>.
          </div>

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

          <div className="manual-mode-card">
            <div className="manual-mode-head">
              <div>
                <strong>Mode Nutrisi</strong>
                <p>Pilih formula sesuai fase pertumbuhan selada.</p>
              </div>
              <span className="manual-badge on">{nutrientMode}</span>
            </div>
            <div className="mode-options">
              {['Semai', 'Vegetatif', 'Finishing'].map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`mode-chip ${nutrientMode === mode ? 'selected' : ''}`}
                  onClick={() => updateNutrientMode(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </article>

        <article className="panel panel-large">
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

        <article className="panel">
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
              <div key={`${item.time}-${item.title}`} className="activity-item">
                <span>{item.time}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  )
}

export default App
