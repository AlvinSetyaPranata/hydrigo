import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const controls = [
  {
    title: 'Pompa nutrisi',
    description: 'Mencampur larutan A/B secara terukur untuk menjaga EC selada tetap konsisten.',
    status: true,
    mode: 'Sensor EC',
  },
  {
    title: 'Sirkulasi air NFT',
    description: 'Menjaga aliran akar tetap tipis, dingin, dan kaya oksigen.',
    status: true,
    mode: '24 jam',
  },
  {
    title: 'Lampu tanam',
    description: 'Menyala saat intensitas cahaya pagi belum memenuhi target pertumbuhan daun.',
    status: false,
    mode: '06:00 - 18:00',
  },
  {
    title: 'Kipas exhaust',
    description: 'Mengurangi kelembapan tinggi agar risiko busuk pinggir daun turun.',
    status: true,
    mode: 'Trigger 75%',
  },
];

const schedules = [
  { time: '06:00', task: 'Lampu tanam aktif dan aliran utama diperiksa.' },
  { time: '09:40', task: 'Dosing nutrisi 90 detik mengikuti hasil sensor EC.' },
  { time: '13:00', task: 'Pendinginan otomatis jika suhu ruang di atas 28 C.' },
  { time: '18:10', task: 'Flush aliran balik dan simpan log operasional.' },
];

const sopItems = [
  'Pindah tanam hanya saat bibit sudah punya 2-3 daun sejati dan akar putih bersih.',
  'Kenaikan EC dibuat bertahap karena selada mudah stres bila nutrisi melonjak tiba-tiba.',
  'Air tangki dijaga tetap dingin untuk menjaga tekstur daun tetap renyah dan tidak pahit.',
];

export default function ControlScreen() {
  const [deviceControls, setDeviceControls] = useState(controls);

  const toggleControl = (title: string) => {
    setDeviceControls((current) =>
      current.map((item) => (item.title === title ? { ...item, status: !item.status } : item))
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Automation Center</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Kontrol perangkat yang bersih, cepat, dan spesifik untuk selada
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Tidak ada preset tanaman lain. Threshold, jadwal, dan prioritas perangkat dibentuk hanya
          untuk lettuce growth cycle.
        </ThemedText>

        <View style={styles.modeRow}>
          <View style={styles.modeCard}>
            <ThemedText style={styles.modeLabel}>Mode sistem</ThemedText>
            <ThemedText style={styles.modeValue}>AUTO TERKUNCI</ThemedText>
          </View>
          <View style={styles.modeBadge}>
            <ThemedText style={styles.modeBadgeText}>Selada only</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.controlSection}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Perangkat aktif
          </ThemedText>
          <ThemedText style={styles.sectionHint}>4 node utama greenhouse</ThemedText>
        </View>

        {deviceControls.map((item) => (
          <View key={item.title} style={styles.controlCard}>
            <View style={styles.controlTop}>
              <View style={styles.controlCopy}>
                <ThemedText style={styles.controlTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.controlDesc}>{item.description}</ThemedText>
              </View>
              <View style={styles.switchWrap}>
                <ThemedText style={styles.switchState}>{item.status ? 'ON' : 'OFF'}</ThemedText>
                <Switch
                  value={item.status}
                  onValueChange={() => toggleControl(item.title)}
                  trackColor={{ false: '#cad5c9', true: '#8ed16d' }}
                  thumbColor={item.status ? '#ffffff' : '#f4f4f4'}
                />
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.modePill}>
                <ThemedText style={styles.modePillText}>{item.mode}</ThemedText>
              </View>
              <View style={[styles.stateDot, item.status ? styles.stateOn : styles.stateOff]} />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.scheduleCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Jadwal otomatis
          </ThemedText>
          <ThemedText style={styles.sectionHint}>Hari ini</ThemedText>
        </View>
        {schedules.map((item) => (
          <View key={item.time} style={styles.scheduleRow}>
            <View style={styles.timeBlock}>
              <ThemedText style={styles.scheduleTime}>{item.time}</ThemedText>
            </View>
            <ThemedText style={styles.scheduleTask}>{item.task}</ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.sopCard}>
        <ThemedText type="subtitle" style={styles.sopTitle}>
          SOP selada
        </ThemedText>
        {sopItems.map((item) => (
          <View key={item} style={styles.sopRow}>
            <View style={styles.sopIndex} />
            <ThemedText style={styles.sopText}>{item}</ThemedText>
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
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#fdfefb',
    gap: 12,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#d8f0b2',
  },
  kicker: {
    color: '#2f7d32',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: '#17301a',
    lineHeight: 38,
    maxWidth: 300,
  },
  subtitle: {
    color: '#546756',
    lineHeight: 24,
    fontSize: 15,
    maxWidth: 340,
  },
  modeRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  modeCard: {
    flex: 1,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#eff7e8',
  },
  modeLabel: {
    color: '#648165',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  modeValue: {
    color: '#17301a',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  modeBadge: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#17301a',
  },
  modeBadgeText: {
    color: '#f6ffed',
    fontWeight: '800',
    fontSize: 12,
  },
  controlSection: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#102e18',
    gap: 14,
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
  sectionHint: {
    color: '#718571',
    fontSize: 12,
    fontWeight: '700',
  },
  controlCard: {
    borderRadius: 22,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  controlTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  switchWrap: {
    alignItems: 'center',
    gap: 6,
  },
  switchState: {
    color: '#f6ffed',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  controlCopy: {
    flex: 1,
    gap: 4,
  },
  controlTitle: {
    color: '#f6ffed',
    fontSize: 18,
    fontWeight: '900',
  },
  controlDesc: {
    color: '#ccdfcf',
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(201,251,120,0.18)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillText: {
    color: '#d9f3b4',
    fontSize: 12,
    fontWeight: '800',
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stateOn: {
    backgroundColor: '#9ee66d',
  },
  stateOff: {
    backgroundColor: '#d5dacf',
  },
  scheduleCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 12,
  },
  scheduleRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  timeBlock: {
    width: 72,
    borderRadius: 16,
    paddingVertical: 12,
    backgroundColor: '#eff7e8',
    alignItems: 'center',
  },
  scheduleTime: {
    color: '#2f7d32',
    fontWeight: '900',
  },
  scheduleTask: {
    flex: 1,
    color: '#526652',
    lineHeight: 22,
  },
  sopCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#d8f0b2',
    gap: 12,
  },
  sopTitle: {
    color: '#17301a',
  },
  sopRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  sopIndex: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    backgroundColor: '#2f7d32',
  },
  sopText: {
    flex: 1,
    color: '#2d4b30',
    lineHeight: 22,
  },
});
