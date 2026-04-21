import mqtt from 'mqtt'

function getDefaultBrokerUrl() {
  if (typeof window === 'undefined') {
    return 'ws://localhost/mqtt'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/mqtt`
}

const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL || getDefaultBrokerUrl()
const username = import.meta.env.VITE_MQTT_USERNAME
const password = import.meta.env.VITE_MQTT_PASSWORD
const clientId =
  import.meta.env.VITE_MQTT_CLIENT_ID ||
  `hydrigo-frontend-${Math.random().toString(16).slice(2, 10)}`

let client

export function getMqttClient() {
  if (client) {
    return client
  }

  client = mqtt.connect(brokerUrl, {
    clientId,
    username,
    password,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
  })

  return client
}

export function subscribeTopic(topic, onMessage) {
  const mqttClient = getMqttClient()

  const handler = (receivedTopic, payload) => {
    if (receivedTopic !== topic) {
      return
    }

    onMessage(payload.toString())
  }

  mqttClient.subscribe(topic)
  mqttClient.on('message', handler)

  return () => {
    mqttClient.off('message', handler)
    mqttClient.unsubscribe(topic)
  }
}

export function publishTopic(topic, payload) {
  const mqttClient = getMqttClient()

  mqttClient.publish(topic, JSON.stringify(payload))
}
