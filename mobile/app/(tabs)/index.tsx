import { Link } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const sensorCards = [
  { label: 'Suhu Air', value: '21.6 C', note: 'Akar stabil dan oksigen larut aman.', tone: 'good' },
  { label: 'pH Larutan', value: '6.1', note: 'Tepat untuk serapan nutrisi selada.', tone: 'good' },
  { label: 'EC Nutrisi', value: '1.4 mS/cm', note: 'Cukup untuk fase vegetatif aktif.', tone: 'good' },
  { label: 'Kelembapan', value: '78%', note: 'Sedikit tinggi, exhaust dipacu otomatis.', tone: 'warn' },
];

const growthSteps = [
  { title: 'Semai', age: 'Hari 1-7', detail: 'Kabut halus aktif dua kali sehari agar media tidak kering.' },
  { title: 'Vegetatif', age: 'Hari 8-24', detail: 'Pertumbuhan daun dipacu dengan nutrisi stabil dan sirkulasi NFT penuh.' },
  { title: 'Menjelang Panen', age: 'Hari 25-32', detail: 'Ukuran kepala dipadatkan sambil menjaga rasa tetap renyah dan ringan.' },
];

const alerts = [
  'Tangki cadangan nutrisi tinggal 28%.',
  'Kelembapan greenhouse di atas target selama 18 menit.',
  'Pemeriksaan nozzle kabut dijadwalkan sore ini.',
];

export default function HomeScreen() {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroShell}>
        <View style={styles.orbLarge} />
        <View style={styles.orbSmall} />

        <View style={styles.heroTopRow}>
          <View style={styles.eyebrowPill}>
            <ThemedText style={styles.eyebrow}>Hydrigo</ThemedText>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveText}>Live greenhouse</ThemedText>
          </View>
        </View>

        <View style={styles.heroStats}>
          <View style={[styles.heroStat, styles.heroStatPrimary]}>
            <ThemedText style={styles.heroStatValue}>324</ThemedText>
            <ThemedText style={styles.heroStatLabel}>Lubang tanam aktif</ThemedText>
          </View>
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>94%</ThemedText>
            <ThemedText style={styles.heroStatLabel}>Kesehatan batch</ThemedText>
          </View>
          <View style={styles.heroStat}>
            <ThemedText style={styles.heroStatValue}>09:40</ThemedText>
            <ThemedText style={styles.heroStatLabel}>Dosing berikutnya</ThemedText>
          </View>
        </View>

        <View style={styles.heroFooter}>
          <Link href="/modal" style={styles.heroButton}>
            <ThemedText style={styles.heroButtonText}>Panduan cepat</ThemedText>
          </Link>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <ThemedText type="subtitle" style={styles.sectionTitle}>
          Sensor inti
        </ThemedText>
        <ThemedText style={styles.sectionCaption}>4 indikator utama yang paling mempengaruhi mutu selada.</ThemedText>
      </View>

      <View style={styles.grid}>
        {sensorCards.map((card) => (
          <View
            key={card.label}
            style={[styles.sensorCard, card.tone === 'warn' ? styles.sensorWarn : styles.sensorGood]}>
            <View style={styles.sensorHead}>
              <ThemedText style={styles.sensorLabel}>{card.label}</ThemedText>
              <View style={[styles.sensorChip, card.tone === 'warn' ? styles.sensorChipWarn : styles.sensorChipGood]}>
                <ThemedText style={styles.sensorChipText}>{card.tone === 'warn' ? 'Perlu cek' : 'Optimal'}</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.sensorValue}>{card.value}</ThemedText>
            <View style={styles.sensorTrack}>
              <View style={[styles.sensorTrackFill, card.tone === 'warn' ? styles.sensorTrackWarn : styles.sensorTrackGood]} />
            </View>
            <ThemedText style={styles.sensorNote}>{card.note}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.timelineCard}>
        <View style={styles.panelTop}>
          <ThemedText type="subtitle" style={styles.panelTitle}>
            Siklus tumbuh
          </ThemedText>
          <ThemedText style={styles.panelHint}>32 hari</ThemedText>
        </View>
        {growthSteps.map((step, index) => (
          <View key={step.title} style={styles.timelineItem}>
            <View style={styles.timelineRail}>
              <View style={styles.timelineMarker}>
                <ThemedText style={styles.timelineMarkerText}>{index + 1}</ThemedText>
              </View>
              {index < growthSteps.length - 1 ? <View style={styles.timelineLine} /> : null}
            </View>
            <View style={styles.timelineContent}>
              <ThemedText style={styles.timelineTitle}>{step.title}</ThemedText>
              <ThemedText style={styles.timelineAge}>{step.age}</ThemedText>
              <ThemedText style={styles.timelineDetail}>{step.detail}</ThemedText>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.alertCard}>
        <View style={styles.panelTop}>
          <ThemedText type="subtitle" style={styles.panelTitle}>
            Peringatan aktif
          </ThemedText>
          <ThemedText style={styles.panelHint}>3 item</ThemedText>
        </View>
        {alerts.map((item, index) => (
          <View key={item} style={[styles.alertRow, index < alerts.length - 1 ? styles.alertRowBorder : null]}>
            <View style={styles.alertBadge}>
              <ThemedText style={styles.alertBadgeText}>{index + 1}</ThemedText>
            </View>
            <ThemedText style={styles.alertText}>{item}</ThemedText>
          </View>
        ))}
      </View>
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
  heroShell: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#102e18',
    gap: 16,
    shadowColor: '#0f2816',
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
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
  heroStatPrimary: {
    backgroundColor: 'rgba(184,240,106,0.18)',
    borderColor: 'rgba(184,240,106,0.35)',
  },
  heroStatValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  heroStatLabel: {
    color: '#d7e8d3',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  heroFooter: {
    marginTop: 2,
  },
  heroButton: {
    justifyContent: 'center',
    backgroundColor: '#c9fb78',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  heroButtonText: {
    color: '#17301a',
    fontWeight: '900',
    textAlign: 'center',
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    color: '#163019',
  },
  sectionCaption: {
    color: '#607260',
    lineHeight: 21,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sensorCard: {
    width: '47%',
    minWidth: 150,
    borderRadius: 24,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    shadowColor: '#48604a',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  sensorGood: {
    backgroundColor: '#fcfff8',
    borderColor: '#deebd6',
  },
  sensorWarn: {
    backgroundColor: '#fffaf1',
    borderColor: '#efd9af',
  },
  sensorHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
  },
  sensorLabel: {
    flex: 1,
    fontSize: 12,
    color: '#5e6d5e',
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  sensorChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sensorChipGood: {
    backgroundColor: '#e5f5db',
  },
  sensorChipWarn: {
    backgroundColor: '#fde8c1',
  },
  sensorChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#335234',
  },
  sensorValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    color: '#17301a',
  },
  sensorTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#edf2e9',
    overflow: 'hidden',
  },
  sensorTrackFill: {
    height: '100%',
    borderRadius: 999,
  },
  sensorTrackGood: {
    width: '78%',
    backgroundColor: '#72be64',
  },
  sensorTrackWarn: {
    width: '64%',
    backgroundColor: '#f0b454',
  },
  sensorNote: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4e5e4f',
  },
  timelineCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 10,
  },
  panelTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  panelTitle: {
    color: '#17301a',
  },
  panelHint: {
    color: '#6c7f6d',
    fontWeight: '700',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'stretch',
  },
  timelineRail: {
    alignItems: 'center',
    width: 32,
  },
  timelineMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2d7c38',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineMarkerText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#dbe8d5',
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17301a',
  },
  timelineAge: {
    marginTop: 2,
    color: '#2f7d32',
    fontWeight: '800',
  },
  timelineDetail: {
    marginTop: 4,
    color: '#546756',
    lineHeight: 22,
  },
  alertCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 8,
  },
  alertRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  alertRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e7eee2',
  },
  alertBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fee8bc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBadgeText: {
    color: '#7a5612',
    fontWeight: '900',
    fontSize: 12,
  },
  alertText: {
    flex: 1,
    color: '#4f624f',
    lineHeight: 22,
  },
});
