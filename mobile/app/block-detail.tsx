import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getParam(value: string | string[] | undefined, fallback = '-') {
  if (Array.isArray(value)) {
    return value[0] ?? fallback;
  }

  return value ?? fallback;
}

function formatMetric(value: string, suffix = '') {
  if (!value || value === '-') {
    return '-';
  }

  const numeric = Number(value);

  if (Number.isNaN(numeric)) {
    return value;
  }

  return `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(numeric)}${suffix}`;
}

export default function BlockDetailScreen() {
  const params = useLocalSearchParams();

  const blockIndex = getParam(params.blockIndex);
  const deviceId = getParam(params.deviceId);
  const lettuceBedId = getParam(params.lettuceBedId);
  const transactionId = getParam(params.transactionId);
  const readingId = getParam(params.readingId);
  const blockHash = getParam(params.blockHash);
  const previousHash = getParam(params.previousHash);
  const payloadHash = getParam(params.payloadHash);
  const createdAt = getParam(params.createdAt);
  const ph = getParam(params.ph);
  const tdsPpm = getParam(params.tdsPpm);
  const waterTemp = getParam(params.waterTemp);
  const airTemp = getParam(params.airTemp);
  const humidity = getParam(params.humidity);
  const waterLevel = getParam(params.waterLevel);
  const chainStatus = getParam(params.chainStatus);
  const chainNote = getParam(params.chainNote, '');

  return (
    <>
      <Stack.Screen options={{ title: `Block #${blockIndex}` }} />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ThemedText style={styles.kicker}>Block Detail</ThemedText>
          <ThemedText type="title" style={styles.title}>
            Data lengkap untuk block #{blockIndex}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Tinjau identitas perangkat, hash pencatatan, dan keterhubungan block dalam chain.
          </ThemedText>
        </View>

        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <ThemedText style={styles.statusLabel}>Status chain</ThemedText>
            <View style={[styles.statusPill, chainStatus === 'Tervalidasi' ? styles.statusOk : styles.statusWarn]}>
              <ThemedText style={styles.statusText}>{chainStatus}</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.statusNote}>
            {chainNote || 'Block ini mengikuti status verifikasi chain dari backend ledger.'}
          </ThemedText>
        </View>

        <View style={styles.detailCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Informasi utama
          </ThemedText>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Perangkat</ThemedText>
            <ThemedText style={styles.detailValue}>{deviceId}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Bed</ThemedText>
            <ThemedText style={styles.detailValue}>{lettuceBedId}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Transaksi</ThemedText>
            <ThemedText style={styles.detailValue}>{transactionId}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Reading ID</ThemedText>
            <ThemedText style={styles.detailValue}>{readingId}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Waktu</ThemedText>
            <ThemedText style={styles.detailValue}>{formatTimestamp(createdAt)}</ThemedText>
          </View>
        </View>

        <View style={styles.detailCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Hash chain
          </ThemedText>

          <View style={styles.hashGroup}>
            <ThemedText style={styles.hashLabel}>Block hash</ThemedText>
            <ThemedText style={styles.hashValue}>{blockHash}</ThemedText>
          </View>

          <View style={styles.hashGroup}>
            <ThemedText style={styles.hashLabel}>Previous hash</ThemedText>
            <ThemedText style={styles.hashValue}>{previousHash}</ThemedText>
          </View>

          <View style={styles.hashGroup}>
            <ThemedText style={styles.hashLabel}>Payload hash</ThemedText>
            <ThemedText style={styles.hashValue}>{payloadHash}</ThemedText>
          </View>
        </View>

        <View style={styles.detailCard}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Data sensor hydroponic
          </ThemedText>

          <View style={styles.metricGrid}>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>pH air</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(ph)}</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>Kadar nutrisi (TDS)</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(tdsPpm, ' ppm')}</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>Suhu air</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(waterTemp, '°C')}</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>Suhu udara</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(airTemp, '°C')}</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>Kelembapan</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(humidity, '%')}</ThemedText>
            </View>
            <View style={styles.metricItem}>
              <ThemedText style={styles.metricLabel}>Level ketinggian air</ThemedText>
              <ThemedText style={styles.metricValue}>{formatMetric(waterLevel, '%')}</ThemedText>
            </View>
          </View>
        </View>
      </ScrollView>
    </>
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
  hero: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#0f1724',
    gap: 10,
  },
  kicker: {
    color: '#8bb0ff',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: '#f5f7fb',
    lineHeight: 38,
  },
  subtitle: {
    color: '#bfd1ee',
    lineHeight: 24,
    fontSize: 15,
  },
  statusCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  statusLabel: {
    color: '#172033',
    fontSize: 16,
    fontWeight: '700',
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusOk: {
    backgroundColor: '#dff6e7',
  },
  statusWarn: {
    backgroundColor: '#ffe5d4',
  },
  statusText: {
    color: '#172033',
    fontSize: 12,
    fontWeight: '800',
  },
  statusNote: {
    color: '#5f6c85',
    lineHeight: 22,
  },
  detailCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 16,
  },
  sectionTitle: {
    color: '#172033',
  },
  detailRow: {
    gap: 6,
  },
  detailLabel: {
    color: '#5f6c85',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#172033',
    lineHeight: 24,
    fontWeight: '600',
  },
  hashGroup: {
    gap: 8,
  },
  hashLabel: {
    color: '#5f6c85',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  hashValue: {
    color: '#172033',
    lineHeight: 24,
    fontSize: 14,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricItem: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f3f7fb',
    gap: 8,
  },
  metricLabel: {
    color: '#5f6c85',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: '#172033',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
  },
});
