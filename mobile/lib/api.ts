import Constants from 'expo-constants';

type SummaryCard = {
  label: string;
  value: string;
  note: string;
};

type HeroStat = {
  value: string;
  label: string;
};

type SensorSnapshot = {
  ph: string;
  waterTemp: string;
  humidity: string;
};

type LettuceBed = {
  name: string;
  zone: string;
  phase: string;
  humidity: string;
  temp: string;
  ec: string;
  status: string;
  health: number;
};

type Activity = {
  time: string;
  title: string;
  detail: string;
};

type ScheduleItem = {
  task: string;
  due: string;
  owner: string;
};

type ChartBar = {
  label: string;
  value: number;
};

export type ManualControl = {
  id: string;
  name: string;
  description: string;
  status: boolean;
};

export type DashboardData = {
  summaryCards: SummaryCard[];
  heroStats: HeroStat[];
  sensorSnapshot: SensorSnapshot;
  lettuceBeds: LettuceBed[];
  activities: Activity[];
  schedule: ScheduleItem[];
  chartBars: ChartBar[];
  manualControls: ManualControl[];
  nutrientMode: string;
};

export type LedgerBlock = {
  block_index: number;
  reading_id: number;
  transaction_id: string;
  device_id: string;
  lettuce_bed_id: string;
  payload_hash: string;
  previous_hash: string;
  block_hash: string;
  created_at: string;
};

export type LedgerVerification = {
  valid: boolean;
  reason?: string;
};

type DashboardResponse = {
  ok: boolean;
  data?: DashboardData;
  error?: string;
};

type ManualControlResponse = {
  ok: boolean;
  data?: ManualControl[];
  error?: string;
};

type NutrientModeResponse = {
  ok: boolean;
  data?: {
    nutrientMode: string;
  };
  error?: string;
};

type ChainResponse = {
  data?: LedgerBlock[];
  verification?: LedgerVerification;
  error?: string;
};

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return null;
  }

  return hostUri.split(':')[0] || null;
}

function makeLocalUrl(port: number) {
  const host = getExpoHost();

  if (!host) {
    return null;
  }

  return `http://${host}:${port}`;
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  return makeLocalUrl(3001);
}

export function getLedgerBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_LEDGER_API_BASE_URL;

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  return makeLocalUrl(8000);
}

function buildUrl(baseUrl: string | null, path: string) {
  if (!baseUrl) {
    throw new Error(
      'API base URL belum tersedia. Set EXPO_PUBLIC_API_BASE_URL atau jalankan Expo dari host yang bisa dideteksi.',
    );
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJson<T>(response: Response) {
  const data = (await response.json()) as T;
  return data;
}

export async function fetchDashboard() {
  const response = await fetch(buildUrl(getApiBaseUrl(), '/dashboard'));
  const result = await parseJson<DashboardResponse>(response);

  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Gagal memuat dashboard Hydrigo.');
  }

  return result.data;
}

export async function updateManualControl(controlId: string, status: boolean) {
  const response = await fetch(buildUrl(getApiBaseUrl(), '/controls/manual'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ controlId, status }),
  });
  const result = await parseJson<ManualControlResponse>(response);

  if (!response.ok || !result.data) {
    throw new Error(result.error || 'Gagal memperbarui kontrol manual.');
  }

  return result.data;
}

export async function updateNutrientMode(mode: string) {
  const response = await fetch(buildUrl(getApiBaseUrl(), '/controls/nutrient-mode'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ mode }),
  });
  const result = await parseJson<NutrientModeResponse>(response);

  if (!response.ok || !result.data?.nutrientMode) {
    throw new Error(result.error || 'Gagal memperbarui mode nutrisi.');
  }

  return result.data.nutrientMode;
}

export async function fetchLedgerChain() {
  const response = await fetch(buildUrl(getLedgerBaseUrl(), '/api/v1/blockchain/chain'));
  const result = await parseJson<ChainResponse>(response);

  if (!response.ok || !result.data || !result.verification) {
    throw new Error(result.error || 'Gagal memuat ledger blockchain.');
  }

  return {
    blocks: result.data,
    verification: result.verification,
  };
}
