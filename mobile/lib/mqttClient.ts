import mqtt, { type MqttClient } from 'mqtt';

import { getApiBaseUrl } from '@/lib/api';

const CONTROL_TOPIC = 'hydrigo/lettuce/control';
const SENSOR_TOPIC = 'hydrigo/lettuce/sensor';
const STATUS_TOPIC = 'hydrigo/lettuce/status';

let client: MqttClient | null = null;

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getHostFromUrl(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function getDefaultBrokerUrl() {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl) {
    return null;
  }

  const host = getHostFromUrl(apiBaseUrl);

  if (!host) {
    return null;
  }

  return `ws://${host}/mqtt`;
}

export function getBrokerUrl() {
  const configured = process.env.EXPO_PUBLIC_MQTT_BROKER_URL;

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  return getDefaultBrokerUrl();
}

export function getMqttClient() {
  if (client) {
    return client;
  }

  const brokerUrl = getBrokerUrl();

  if (!brokerUrl) {
    throw new Error('MQTT broker URL belum tersedia. Set EXPO_PUBLIC_MQTT_BROKER_URL untuk device fisik.');
  }

  const username = process.env.EXPO_PUBLIC_MQTT_USERNAME;
  const password = process.env.EXPO_PUBLIC_MQTT_PASSWORD;
  const clientId =
    process.env.EXPO_PUBLIC_MQTT_CLIENT_ID || `hydrigo-mobile-${Math.random().toString(16).slice(2, 10)}`;

  client = mqtt.connect(brokerUrl, {
    clientId,
    username,
    password,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 5000,
  });

  return client;
}

export function subscribeTopic(topic: string, onMessage: (message: string) => void) {
  const mqttClient = getMqttClient();

  const handler = (receivedTopic: string, payload: Buffer) => {
    if (receivedTopic !== topic) {
      return;
    }

    onMessage(payload.toString());
  };

  mqttClient.subscribe(topic);
  mqttClient.on('message', handler);

  return () => {
    mqttClient.off('message', handler);
    mqttClient.unsubscribe(topic);
  };
}

export function publishTopic(topic: string, payload: unknown) {
  const mqttClient = getMqttClient();
  mqttClient.publish(topic, JSON.stringify(payload));
}

export function attachBrokerListeners(listeners: {
  onConnect?: () => void;
  onReconnect?: () => void;
  onClose?: () => void;
  onError?: () => void;
}) {
  const mqttClient = getMqttClient();

  if (listeners.onConnect) {
    mqttClient.on('connect', listeners.onConnect);
  }
  if (listeners.onReconnect) {
    mqttClient.on('reconnect', listeners.onReconnect);
  }
  if (listeners.onClose) {
    mqttClient.on('close', listeners.onClose);
  }
  if (listeners.onError) {
    mqttClient.on('error', listeners.onError);
  }

  return () => {
    if (listeners.onConnect) {
      mqttClient.off('connect', listeners.onConnect);
    }
    if (listeners.onReconnect) {
      mqttClient.off('reconnect', listeners.onReconnect);
    }
    if (listeners.onClose) {
      mqttClient.off('close', listeners.onClose);
    }
    if (listeners.onError) {
      mqttClient.off('error', listeners.onError);
    }
  };
}

export const mqttTopics = {
  control: CONTROL_TOPIC,
  sensor: SENSOR_TOPIC,
  status: STATUS_TOPIC,
};
