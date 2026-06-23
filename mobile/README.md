# Hydrigo Mobile

Expo Router mobile client for the Hydrigo dashboard and control flow.

## What It Connects To

- Dashboard and ledger API: Django hydroponics backend, exposed at `/api/hydroponics`
- Realtime status updates: MQTT broker via `/mqtt`

## Environment

Use `.env.example` as the starting point.

For Android emulator, Expo can often detect the host automatically.

For a physical Android device, set:

```env
EXPO_PUBLIC_API_BASE_URL=http://109.110.188.181:9000/api/hydroponics
EXPO_PUBLIC_LEDGER_API_BASE_URL=http://109.110.188.181:9000/api/hydroponics
EXPO_PUBLIC_MQTT_BROKER_URL=ws://109.110.188.181:9000/mqtt
EXPO_PUBLIC_MQTT_USERNAME=
EXPO_PUBLIC_MQTT_PASSWORD=
EXPO_PUBLIC_MQTT_CLIENT_ID=hydrigo-mobile
```

Do not use `localhost` on a physical phone. `localhost` there points to the phone itself, not your machine.

The current default VPS target for this project is `109.110.188.181:9000`.

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

- `Dashboard`: reads hydroponics readings from `/api/v1/readings` relative to `EXPO_PUBLIC_API_BASE_URL`
- `Dashboard`: also subscribes to realtime sensor and status topics over MQTT
- `Kontrol`: keeps MQTT publishing, but Django hydroponics backend does not provide `/controls/*` HTTP endpoints
- `Blockchain`: reads hydroponics ledger data from `/api/v1/blockchain/chain` relative to `EXPO_PUBLIC_LEDGER_API_BASE_URL`
