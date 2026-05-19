import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fetchDashboard, getApiBaseUrl, type DashboardData } from '@/lib/api';
import { attachBrokerListeners, mqttTopics, subscribeTopic } from '@/lib/mqttClient';

const emptySnapshot = {
  ph: '--',
  waterTemp: '--',
  humidity: '--',
  waterLevel: '--',
};

export default function DashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [brokerState, setBrokerState] = useState('Menghubungkan');
  const [sensorSnapshot, setSensorSnapshot] = useState(emptySnapshot);

  async function loadDashboard(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const nextDashboard = await fetchDashboard();
      setDashboard(nextDashboard);
      setSensorSnapshot(nextDashboard.sensorSnapshot ?? emptySnapshot);
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat dashboard.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadDashboard().catch(() => undefined);
  }, []);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadDashboard().catch(() => undefined);
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cleanup = () => undefined;

    try {
      cleanup = attachBrokerListeners({
        onConnect: () => setBrokerState('Terhubung'),
        onReconnect: () => setBrokerState('Menghubungkan ulang'),
        onClose: () => setBrokerState('Offline'),
        onError: () => setBrokerState('Gangguan koneksi'),
      });

      const unsubscribeSensor = subscribeTopic(mqttTopics.sensor, (message) => {
        try {
          const payload = JSON.parse(message) as Partial<typeof emptySnapshot>;
          setSensorSnapshot((current) => ({
            ph: payload.ph ?? current.ph,
            waterTemp: payload.waterTemp ?? current.waterTemp,
            humidity: payload.humidity ?? current.humidity,
            waterLevel: payload.waterLevel ?? current.waterLevel,
          }));
        } catch {
          setBrokerState('Data tidak valid');
        }
      });

      const unsubscribeStatus = subscribeTopic(mqttTopics.status, (message) => {
        try {
          const payload = JSON.parse(message) as {
            nutrientMode?: string;
            controls?: DashboardData['manualControls'];
          };

          if (payload.nutrientMode) {
            setDashboard((current) => (current ? { ...current, nutrientMode: payload.nutrientMode ?? current.nutrientMode } : current));
          }

          if (Array.isArray(payload.controls)) {
            setDashboard((current) => (current ? { ...current, manualControls: payload.controls ?? current.manualControls } : current));
          }
        } catch {
          setBrokerState('Data tidak valid');
        }
      });

      return () => {
        unsubscribeSensor();
        unsubscribeStatus();
        cleanup();
      };
    } catch (mqttError) {
      setBrokerState('Tidak tersedia');
      setError((mqttError as Error).message);
    }

    return cleanup;
  }, []);

  const heroStats = [
    dashboard?.heroStats?.[0] ?? { value: '-', label: 'rak selada aktif' },
    { value: dashboard ? 'Terhubung' : 'Menunggu', label: 'status backend api' },
    { value: brokerState, label: 'status broker mqtt' },
  ];

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color="#8ed16d" />
          <ThemedText type="subtitle" style={styles.stateTitle}>
            Memuat dashboard Hydrigo
          </ThemedText>
          <ThemedText style={styles.stateBody}>Menghubungkan aplikasi mobile ke {getApiBaseUrl() ?? 'API Hydrigo'}.</ThemedText>
        </View>
      </View>
    );
  }

  if (!dashboard) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.stateCard}>
          <ThemedText type="subtitle" style={styles.stateTitle}>
            Backend belum merespons
          </ThemedText>
          <ThemedText style={styles.stateBody}>{error || 'Periksa API dashboard Hydrigo.'}</ThemedText>
          <Pressable style={styles.retryButton} onPress={() => loadDashboard().catch(() => undefined)}>
            <ThemedText style={styles.retryText}>Coba lagi</ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true).catch(() => undefined)} />}>
      <View style={styles.heroShell}>
        <View style={styles.orbLarge} />
        <View style={styles.orbSmall} />

        <View style={styles.heroTopRow}>
          <View style={styles.eyebrowPill}>
            <ThemedText style={styles.eyebrow}>Hydrigo Mobile</ThemedText>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>API terhubung</ThemedText>
          </View>
        </View>

        <ThemedText type="title" style={styles.heroTitle}>
          Pantau kondisi budidaya selada dari satu tampilan.
        </ThemedText>
        <ThemedText style={styles.heroBody}>
          Data yang tampil di mobile mengikuti backend yang sama dengan dashboard web, jadi kondisi lapangan tetap sinkron.
        </ThemedText>

        <View style={styles.heroStats}>
          {heroStats.map((item, index) => (
            <View key={`${item.label}-${index}`} style={styles.heroStat}>
              <ThemedText style={styles.heroStatValue}>{item.value}</ThemedText>
              <ThemedText style={styles.heroStatLabel}>{item.label}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.snapshotCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Ringkasan sensor
          </ThemedText>
          <ThemedText style={styles.sectionCaption}>Data terbaru dari sistem</ThemedText>
        </View>

        <View style={styles.snapshotGrid}>
          <View style={styles.snapshotItem}>
            <ThemedText style={styles.snapshotLabel}>Kelembapan</ThemedText>
            <ThemedText style={styles.snapshotValue}>{sensorSnapshot.humidity}</ThemedText>
          </View>
          <View style={styles.snapshotItem}>
            <ThemedText style={styles.snapshotLabel}>pH larutan</ThemedText>
            <ThemedText style={styles.snapshotValue}>{sensorSnapshot.ph}</ThemedText>
          </View>
          <View style={styles.snapshotItem}>
            <ThemedText style={styles.snapshotLabel}>Suhu air</ThemedText>
            <ThemedText style={styles.snapshotValue}>{sensorSnapshot.waterTemp}</ThemedText>
          </View>
          <View style={styles.snapshotItem}>
            <ThemedText style={styles.snapshotLabel}>Level ketinggian air</ThemedText>
            <ThemedText style={styles.snapshotValue}>{sensorSnapshot.waterLevel}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {dashboard.summaryCards.map((card, index) => (
          <View key={`${card.label}-${index}`} style={styles.summaryCard}>
            <ThemedText style={styles.summaryLabel}>{card.label}</ThemedText>
            <ThemedText style={styles.summaryValue}>{card.value}</ThemedText>
            <ThemedText style={styles.summaryNote}>{card.note}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Rak selada
          </ThemedText>
          <ThemedText style={styles.sectionCaption}>{dashboard.lettuceBeds.length} varietas</ThemedText>
        </View>

        {dashboard.lettuceBeds.map((plant, index) => (
          <View key={`${plant.name}-${plant.zone}-${index}`} style={styles.plantCard}>
            <View style={styles.plantHead}>
              <View style={styles.plantCopy}>
                <ThemedText style={styles.plantTitle}>{plant.name}</ThemedText>
                <ThemedText style={styles.plantMeta}>
                  {plant.zone} • {plant.phase}
                </ThemedText>
              </View>
              <View style={[styles.statusPill, plant.status === 'Perlu cek' ? styles.statusWarn : styles.statusGood]}>
                <ThemedText style={styles.statusText}>{plant.status}</ThemedText>
              </View>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <ThemedText style={styles.metricLabel}>Kelembapan</ThemedText>
                <ThemedText style={styles.metricValue}>{plant.humidity}</ThemedText>
              </View>
              <View style={styles.metricItem}>
                <ThemedText style={styles.metricLabel}>Suhu</ThemedText>
                <ThemedText style={styles.metricValue}>{plant.temp}</ThemedText>
              </View>
              <View style={styles.metricItem}>
                <ThemedText style={styles.metricLabel}>EC</ThemedText>
                <ThemedText style={styles.metricValue}>{plant.ec}</ThemedText>
              </View>
            </View>

            <View style={styles.healthRow}>
              <ThemedText style={styles.healthLabel}>Skor kesehatan</ThemedText>
              <View style={styles.healthTrack}>
                <View style={[styles.healthFill, { width: `${plant.health}%` }]} />
              </View>
              <ThemedText style={styles.healthValue}>{plant.health}%</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.dualPanel}>
        <View style={[styles.panel, styles.flexPanel]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Agenda hari ini
            </ThemedText>
            <ThemedText style={styles.sectionCaption}>Disusun dari backend</ThemedText>
          </View>
          {dashboard.schedule.map((item, index) => (
            <View key={`${item.task}-${item.due}-${index}`} style={styles.listRow}>
              <View style={styles.listCopy}>
                <ThemedText style={styles.listTitle}>{item.task}</ThemedText>
                <ThemedText style={styles.listMeta}>{item.owner}</ThemedText>
              </View>
              <ThemedText style={styles.listBadge}>{item.due}</ThemedText>
            </View>
          ))}
        </View>

        <View style={[styles.panel, styles.flexPanel]}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Aktivitas terbaru
            </ThemedText>
            <ThemedText style={styles.sectionCaption}>Kegiatan sistem dan operator</ThemedText>
          </View>
          {dashboard.activities.map((item) => (
            <View key={`${item.time}-${item.title}`} style={styles.activityRow}>
              <ThemedText style={styles.activityTime}>{item.time}</ThemedText>
              <View style={styles.activityCopy}>
                <ThemedText style={styles.listTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.listMeta}>{item.detail}</ThemedText>
              </View>
            </View>
          ))}
        </View>
      </View>

      {error ? (
        <View style={styles.inlineError}>
          <ThemedText style={styles.inlineErrorText}>{error}</ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ecf2e6',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  stateScreen: {
    flex: 1,
    backgroundColor: '#ecf2e6',
    padding: 20,
    justifyContent: 'center',
  },
  stateCard: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#102e18',
    gap: 12,
    alignItems: 'flex-start',
  },
  stateTitle: {
    color: '#f4ffe8',
  },
  stateBody: {
    color: '#d7e8d3',
  },
  retryButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#b8f06a',
  },
  retryText: {
    color: '#0f2816',
    fontWeight: '800',
  },
  heroShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#102e18',
    gap: 16,
  },
  orbLarge: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(167, 235, 120, 0.18)',
    top: -70,
    right: -50,
  },
  orbSmall: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    bottom: -36,
    left: -24,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrowPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  eyebrow: {
    color: '#d8f2cb',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '700',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#b8f06a',
  },
  liveText: {
    color: '#eef9e7',
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    color: '#ffffff',
    lineHeight: 38,
    maxWidth: 320,
  },
  heroBody: {
    color: '#d7e8d3',
    fontSize: 15,
    lineHeight: 24,
    maxWidth: 340,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    minWidth: 96,
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#d7e8d3',
    fontSize: 12,
    marginTop: 4,
  },
  snapshotCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#f7fbf3',
    gap: 14,
  },
  snapshotGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  snapshotItem: {
    flex: 1,
    minWidth: 92,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#e9f4df',
  },
  snapshotLabel: {
    color: '#5e725e',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  snapshotValue: {
    color: '#17301a',
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: '#17301a',
  },
  sectionCaption: {
    color: '#617161',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  summaryGrid: {
    gap: 12,
  },
  summaryCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#ffffff',
  },
  summaryLabel: {
    color: '#617161',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  summaryValue: {
    color: '#17301a',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: 10,
  },
  summaryNote: {
    color: '#5a685a',
    marginTop: 8,
  },
  panel: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  plantCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#f3f8ee',
    gap: 14,
  },
  plantHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  plantCopy: {
    flex: 1,
    gap: 4,
  },
  plantTitle: {
    color: '#17301a',
    fontSize: 18,
    fontWeight: '800',
  },
  plantMeta: {
    color: '#607060',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusWarn: {
    backgroundColor: '#f4dcc4',
  },
  statusGood: {
    backgroundColor: '#ddefd1',
  },
  statusText: {
    color: '#17301a',
    fontWeight: '800',
    fontSize: 12,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricItem: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#ffffff',
  },
  metricLabel: {
    color: '#607060',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  metricValue: {
    color: '#17301a',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthLabel: {
    color: '#607060',
    width: 88,
    fontSize: 12,
  },
  healthTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#d7e6cf',
    overflow: 'hidden',
  },
  healthFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#4ea95b',
  },
  healthValue: {
    color: '#17301a',
    fontWeight: '900',
    width: 44,
    textAlign: 'right',
  },
  dualPanel: {
    gap: 18,
  },
  flexPanel: {
    flex: 1,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f6faf3',
  },
  listCopy: {
    flex: 1,
  },
  listTitle: {
    color: '#17301a',
    fontWeight: '800',
  },
  listMeta: {
    color: '#607060',
    marginTop: 4,
  },
  listBadge: {
    color: '#17301a',
    fontWeight: '800',
  },
  activityRow: {
    flexDirection: 'row',
    gap: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f6faf3',
  },
  activityTime: {
    width: 48,
    color: '#2f7d32',
    fontWeight: '900',
  },
  activityCopy: {
    flex: 1,
  },
  inlineError: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f7e5d8',
  },
  inlineErrorText: {
    color: '#6d3520',
  },
});
