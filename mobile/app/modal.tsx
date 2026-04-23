import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

export default function ModalScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.topCard}>
        <View style={styles.topAccent} />
        <ThemedText style={styles.kicker}>Quick guide</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Panduan singkat budidaya selada
        </ThemedText>
        <ThemedText style={styles.body}>
          Sistem ini dikunci untuk selada hidroponik. Target harian yang aman: pH 5.8-6.5, suhu air
          18-24 C, kelembapan 60-75%, dan EC 1.2-1.8 mS/cm.
        </ThemedText>
      </View>

      <View style={styles.tipCard}>
        <ThemedText style={styles.tipTitle}>Tanda daun pucat</ThemedText>
        <ThemedText style={styles.tipText}>
          Cek level nutrisi, durasi lampu, dan debit sirkulasi. Selada cepat menunjukkan gejala bila
          larutan turun terlalu lama.
        </ThemedText>
      </View>

      <View style={styles.tipCard}>
        <ThemedText style={styles.tipTitle}>Tanda akar menguning</ThemedText>
        <ThemedText style={styles.tipText}>
          Turunkan suhu air, tambah aerasi, dan periksa apakah aliran NFT terlalu lambat atau tangki
          terlalu hangat.
        </ThemedText>
      </View>

      <Link href="/" dismissTo style={styles.link}>
        <ThemedText style={styles.linkText}>Kembali ke dashboard</ThemedText>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ecf2e6',
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  topCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#102e18',
    gap: 10,
  },
  topAccent: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(184,240,106,0.16)',
    top: -40,
    right: -16,
  },
  kicker: {
    color: '#b9e7b0',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
  },
  title: {
    lineHeight: 38,
    color: '#f4ffe8',
  },
  body: {
    color: '#d7e8d3',
    fontSize: 15,
    lineHeight: 24,
  },
  tipCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 8,
  },
  tipTitle: {
    color: '#17301a',
    fontSize: 18,
    fontWeight: '800',
  },
  tipText: {
    color: '#526652',
    lineHeight: 22,
  },
  link: {
    backgroundColor: '#c9fb78',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  linkText: {
    color: '#17301a',
    textAlign: 'center',
    fontWeight: '900',
  },
});
