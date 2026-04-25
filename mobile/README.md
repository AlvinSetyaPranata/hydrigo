# Hydrigo Mobile

Expo Router mobile client for the Hydrigo dashboard and control flow.

## What It Connects To

- Dashboard and control API: `frontend/api/src/index.js` on port `3001`
- Optional blockchain ledger API: Django backend on port `8000`

## Environment

Use `.env.example` as the starting point.

For Android emulator, Expo can often detect the host automatically.

For a physical Android device, set:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_LAPTOP_LAN_IP:3001
EXPO_PUBLIC_LEDGER_API_BASE_URL=http://YOUR_LAPTOP_LAN_IP:8000
EXPO_PUBLIC_MQTT_BROKER_URL=ws://YOUR_LAPTOP_LAN_IP/mqtt
EXPO_PUBLIC_MQTT_USERNAME=
EXPO_PUBLIC_MQTT_PASSWORD=
EXPO_PUBLIC_MQTT_CLIENT_ID=hydrigo-mobile
```

Do not use `localhost` on a physical phone. `localhost` there points to the phone itself, not your machine.

## Run

```bash
npm install
npx expo start
```

## Lint

```bash
npm run lint
```

## Tabs

- `Dashboard`: reads Hydrigo dashboard data from `/dashboard`
- `Dashboard`: also subscribes to realtime sensor and status topics over MQTT
- `Kontrol`: updates `/controls/manual` and `/controls/nutrient-mode`, then publishes to MQTT control topic
- `Blockchain`: reads Django ledger data from `/api/v1/blockchain/chain`
