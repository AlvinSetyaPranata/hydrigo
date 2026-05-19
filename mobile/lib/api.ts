import Constants from 'expo-constants';

const VPS_BASE_URL = 'http://109.110.188.181';
const HYDROPONICS_API_PREFIX = '/api/hydroponics';

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
  waterLevel: string;
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
  updatedAt?: string;
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
  ph?: number;
  tds_ppm?: number;
  temperature_c?: number;
  air_temperature_c?: number | null;
  humidity_pct?: number;
  water_level_pct?: number;
};

export type LedgerVerification = {
  valid: boolean;
  reason?: string;
};

type Reading = {
  id: number;
  transaction_id: string;
  device_id: string;
  lettuce_bed_id: string;
  air_temperature_c: number | null;
  temperature_c: number;
  humidity_pct: number;
  ph: number;
  tds_ppm: number;
  water_distance_cm: number | null;
  water_level_pct: number;
  light_lux: number;
  pump_prediction: number | null;
  pump_status: boolean | null;
  recorded_at: string;
  received_at: string;
  signature: string | null;
  block_index: number;
  block_hash: string;
  previous_hash: string;
  payload_hash: string;
};

type ReadingListResponse = {
  data?: Reading[];
  limit?: number;
  page?: number;
  total?: number;
  total_pages?: number;
  error?: string;
};

type ManualControlListResponse = {
  data?: ManualControl[];
  error?: string;
};

type ControlModeResponse = {
  data?: {
    mode?: string;
    selectedMode?: string;
    controlMode?: number;
  };
  mode?: string;
  selectedMode?: string;
  controlMode?: number;
  error?: string;
};

type ChainResponse = {
  data?: LedgerBlock[];
  verification?: LedgerVerification;
  limit?: number;
  page?: number;
  total?: number;
  total_pages?: number;
  error?: string;
};

export type PaginatedLedgerResult = {
  blocks: LedgerBlock[];
  verification: LedgerVerification;
  page: number;
  total: number;
  totalPages: number;
  limit: number;
};

function getDefaultManualControls(status = false): ManualControl[] {
  return [
    {
      id: 'water-pump',
      name: 'Pompa Air',
      description: 'Kontrol manual pompa air utama untuk sirkulasi nutrisi.',
      status,
    },
  ];
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function formatNumber(value: number, digits = 1) {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatPercent(value: number, digits = 0) {
  return `${formatNumber(value, digits)}%`;
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function hoursSince(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function inferPhase(recordedAt: string) {
  const ageHours = hoursSince(recordedAt);

  if (ageHours <= 12) {
    return 'Monitoring aktif';
  }

  if (ageHours <= 48) {
    return 'Observasi';
  }

  return 'Data historis';
}

function inferStatus(reading: Reading) {
  const hasHumidityRisk = reading.humidity_pct < 45 || reading.humidity_pct > 85;
  const hasPhRisk = reading.ph < 5.5 || reading.ph > 7;
  const hasTempRisk = reading.temperature_c < 18 || reading.temperature_c > 30;
  const hasWaterRisk = reading.water_level_pct < 30;

  return hasHumidityRisk || hasPhRisk || hasTempRisk || hasWaterRisk ? 'Perlu cek' : 'Stabil';
}

function inferHealth(reading: Reading) {
  let score = 100;

  score -= Math.abs(reading.ph - 6.2) * 12;
  score -= Math.max(0, Math.abs(reading.temperature_c - 24) - 2) * 4;
  score -= Math.max(0, Math.abs(reading.humidity_pct - 70) - 10) * 0.8;
  score -= Math.max(0, 40 - reading.water_level_pct) * 0.7;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getExpoHost() {
  const hostUri = Constants.expoConfig?.hostUri;

  if (!hostUri) {
    return null;
  }

  return hostUri.split(':')[0] || null;
}

export function getApiBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  return VPS_BASE_URL;
}

export function getLedgerBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_LEDGER_API_BASE_URL;

  if (configured && configured.trim()) {
    return trimTrailingSlash(configured.trim());
  }

  return getApiBaseUrl();
}

function buildUrl(baseUrl: string | null, path: string) {
  if (!baseUrl) {
    const expoHost = getExpoHost();

    if (expoHost) {
      return `http://${expoHost}:8000${path.startsWith('/') ? path : `/${path}`}`;
    }

    throw new Error(
      'API base URL belum tersedia. Set EXPO_PUBLIC_API_BASE_URL atau jalankan Expo dari host yang bisa dideteksi.',
    );
  }

  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJson<T>(response: Response) {
  const rawBody = await response.text();
  const contentType = response.headers.get('content-type') ?? '';

  if (!rawBody.trim()) {
    throw new Error(`Respons kosong dari server (${response.status}).`);
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    const preview = rawBody.trim().slice(0, 180);
    throw new Error(
      `Server mengembalikan format non-JSON (${response.status} ${response.statusText}). Content-Type: ${contentType || 'tidak ada'}. Body: ${preview}`,
    );
  }

  try {
    return JSON.parse(rawBody) as T;
  } catch {
    const preview = rawBody.trim().slice(0, 180);
    throw new Error(`JSON server tidak valid (${response.status} ${response.statusText}). Body: ${preview}`);
  }
}

function buildDashboardData(readings: Reading[]): DashboardData {
  const latest = readings[0];

  if (!latest) {
    return {
      summaryCards: [],
      heroStats: [
        { value: '0', label: 'reading tersimpan' },
        { value: '0', label: 'bed terpantau' },
        { value: '-', label: 'status nutrisi' },
      ],
      sensorSnapshot: {
        ph: '--',
        waterTemp: '--',
        humidity: '--',
        waterLevel: '--',
      },
      lettuceBeds: [],
      activities: [],
      schedule: [],
      chartBars: [],
      manualControls: [],
      nutrientMode: 'Belum tersedia',
    };
  }

  const latestByBed = new Map<string, Reading>();

  for (const reading of readings) {
    if (!latestByBed.has(reading.lettuce_bed_id)) {
      latestByBed.set(reading.lettuce_bed_id, reading);
    }
  }

  const bedReadings = [...latestByBed.values()];
  const avgPh = bedReadings.reduce((sum, item) => sum + item.ph, 0) / bedReadings.length;
  const avgTemp = bedReadings.reduce((sum, item) => sum + item.temperature_c, 0) / bedReadings.length;
  const avgHumidity = bedReadings.reduce((sum, item) => sum + item.humidity_pct, 0) / bedReadings.length;
  const avgWater = bedReadings.reduce((sum, item) => sum + item.water_level_pct, 0) / bedReadings.length;
  const pumpOnCount = bedReadings.filter((item) => item.pump_status === true).length;

  const lettuceBeds: LettuceBed[] = bedReadings.map((reading) => {
    const health = inferHealth(reading);
    return {
      name: reading.device_id,
      zone: reading.lettuce_bed_id,
      phase: inferPhase(reading.recorded_at),
      humidity: formatPercent(reading.humidity_pct),
      temp: `${formatNumber(reading.temperature_c)}°C`,
      ec: `${formatNumber(reading.tds_ppm, 0)} ppm`,
      status: inferStatus(reading),
      health,
    };
  });

  const activities: Activity[] = readings.slice(0, 5).map((reading) => ({
    time: formatDateTime(reading.recorded_at),
    title: `Reading ${reading.device_id}`,
    detail: `pH ${formatNumber(reading.ph)} • air ${formatNumber(reading.temperature_c)}°C • hash #${reading.block_index}`,
  }));

  const schedule: ScheduleItem[] = bedReadings.slice(0, 3).map((reading, index) => ({
    task: `Cek bed ${reading.lettuce_bed_id}`,
    due: formatDateTime(reading.recorded_at),
    owner: index === 0 ? 'Data terbaru' : 'Hydrigo backend',
  }));

  const chartBars: ChartBar[] = bedReadings.slice(0, 6).map((reading) => ({
    label: reading.lettuce_bed_id,
    value: Math.round(reading.water_level_pct),
  }));

  const nutrientMode =
    latest.tds_ppm < 600 ? 'Semai' : latest.tds_ppm < 900 ? 'Vegetatif' : 'Finishing';

  return {
    summaryCards: [
      {
        label: 'Reading terakhir',
        value: formatDateTime(latest.recorded_at),
        note: `Device ${latest.device_id} • transaksi ${latest.transaction_id}`,
      },
      {
        label: 'Rata-rata pH',
        value: formatNumber(avgPh),
        note: 'Dihitung dari reading terbaru tiap bed.',
      },
      {
        label: 'Level air rata-rata',
        value: formatPercent(avgWater),
        note: `${pumpOnCount} pompa aktif dari ${bedReadings.length} bed terpantau.`,
      },
    ],
    heroStats: [
      { value: String(readings.length), label: 'reading tersimpan' },
      { value: String(bedReadings.length), label: 'bed terpantau' },
      { value: nutrientMode, label: 'status nutrisi' },
    ],
    sensorSnapshot: {
      ph: formatNumber(latest.ph),
      waterTemp: `${formatNumber(latest.temperature_c)}°C`,
      humidity: formatPercent(latest.humidity_pct),
      waterLevel: formatPercent(latest.water_level_pct),
    },
    lettuceBeds,
    activities,
    schedule,
    chartBars,
    manualControls: [],
    nutrientMode,
  };
}

export async function fetchDashboard() {
  const [response, controlsResponse] = await Promise.all([
    fetch(buildUrl(getApiBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/readings?limit=20`)),
    fetch(buildUrl(getApiBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/controls/manual`)),
  ]);
  const result = await parseJson<ReadingListResponse>(response);

  if (!response.ok) {
    throw new Error(result.error || 'Gagal memuat data hydroponics.');
  }

  let manualControls: ManualControl[] = getDefaultManualControls();

  if (controlsResponse.ok) {
    try {
      const controlsResult = await parseJson<ManualControlListResponse>(controlsResponse);
      manualControls = controlsResult.data?.length ? controlsResult.data : getDefaultManualControls();
    } catch {
      manualControls = getDefaultManualControls();
    }
  }

  return {
    ...buildDashboardData(result.data ?? []),
    manualControls,
  };
}

export async function updateManualControl(controlId: string, status: boolean) {
  try {
    const response = await fetch(buildUrl(getApiBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/controls/manual`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        controlId,
        status,
      }),
    });

    if (!response.ok) {
      return getDefaultManualControls(status);
    }

    const result = await parseJson<ManualControlListResponse>(response);

    if (!result.data?.length) {
      return getDefaultManualControls(status);
    }

    return result.data;
  } catch {
    if (controlId === 'water-pump') {
      return getDefaultManualControls(status);
    }

    throw new Error('Gagal mengubah status kontrol pompa.');
  }
}

export async function updateNutrientMode(mode: string) {
  const requestedMode = mode.toLowerCase() === 'semai' ? 'manual' : 'automatic';
  const response = await fetch(buildUrl(getApiBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/controls/mode`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: requestedMode,
    }),
  });

  if (!response.ok) {
    throw new Error('Gagal mengubah mode nutrisi.');
  }

  const result = await parseJson<ControlModeResponse>(response);
  const normalizedMode = result.data?.mode ?? result.mode;

  if (!normalizedMode) {
    throw new Error('Respons mode kontrol tidak valid.');
  }

  return requestedMode === 'manual' ? 'Semai' : mode;
}

export async function fetchLedgerChain(page = 1, limit = 10): Promise<PaginatedLedgerResult> {
  const [chainResponse, readingsResponse] = await Promise.all([
    fetch(buildUrl(getLedgerBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/blockchain/chain?page=${page}&limit=${limit}`)),
    fetch(buildUrl(getApiBaseUrl(), `${HYDROPONICS_API_PREFIX}/api/v1/readings?page=${page}&limit=${limit}`)),
  ]);
  const [chainResult, readingsResult] = await Promise.all([
    parseJson<ChainResponse>(chainResponse),
    parseJson<ReadingListResponse>(readingsResponse),
  ]);

  if (!chainResponse.ok || !chainResult.data || !chainResult.verification) {
    throw new Error(chainResult.error || 'Gagal memuat ledger blockchain.');
  }

  if (!readingsResponse.ok) {
    throw new Error(readingsResult.error || 'Gagal memuat data sensor hydroponics.');
  }

  const readingsById = new Map((readingsResult.data ?? []).map((reading) => [reading.id, reading]));
  const blocks = chainResult.data.map((block) => {
    const reading = readingsById.get(block.reading_id);

    return {
      ...block,
      ph: reading?.ph,
      tds_ppm: reading?.tds_ppm,
      temperature_c: reading?.temperature_c,
      air_temperature_c: reading?.air_temperature_c,
      humidity_pct: reading?.humidity_pct,
      water_level_pct: reading?.water_level_pct,
    };
  });

  return {
    blocks,
    verification: chainResult.verification,
    page: chainResult.page ?? page,
    total: chainResult.total ?? blocks.length,
    totalPages: chainResult.total_pages ?? 1,
    limit: chainResult.limit ?? limit,
  };
}
