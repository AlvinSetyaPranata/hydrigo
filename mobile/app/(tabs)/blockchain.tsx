import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fetchLedgerChain, getLedgerBaseUrl, type LedgerBlock, type LedgerVerification } from '@/lib/api';

const PAGE_SIZE = 10;

function shortHash(value: string) {
  if (value.length <= 16) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

function formatTimestamp(value: string) {
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

export default function BlockchainScreen() {
  const [blocks, setBlocks] = useState<LedgerBlock[]>([]);
  const [verification, setVerification] = useState<LedgerVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalBlocks, setTotalBlocks] = useState(0);

  const loadChain = useCallback(async (nextPage: number, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchLedgerChain(nextPage, PAGE_SIZE);
      const nextBlocks = [...result.blocks].reverse();

      setBlocks(nextBlocks);
      setVerification(result.verification);
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalBlocks(result.total);
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat ledger blockchain.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadChain(page).catch(() => undefined);
  }, [loadChain, page]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      loadChain(page).catch(() => undefined);
    }, 10000);

    return () => clearInterval(intervalId);
  }, [loadChain, page]);

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color="#8ed16d" />
          <ThemedText type="subtitle" style={styles.stateTitle}>
            Memuat ledger blockchain
          </ThemedText>
          <ThemedText style={styles.stateBody}>Mengambil chain dari {getLedgerBaseUrl() ?? 'backend ledger Hydrigo'}.</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadChain(page, true).catch(() => undefined)} />}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Blockchain Ledger</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Integritas data dalam satu rantai pencatatan.
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Tampilkan urutan block, hash payload, dan status verifikasi untuk meninjau konsistensi data yang dikirim dari perangkat ke backend.
        </ThemedText>

        <View style={styles.nodeGrid}>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Jumlah block</ThemedText>
            <ThemedText style={styles.nodeValue}>{totalBlocks}</ThemedText>
          </View>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Validasi chain</ThemedText>
            <ThemedText style={styles.nodeValue}>{verification?.valid ? 'Valid' : 'Perlu cek'}</ThemedText>
          </View>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Ledger API</ThemedText>
            <ThemedText style={styles.nodeValue}>{getLedgerBaseUrl() ? 'Terhubung' : 'Belum diatur'}</ThemedText>
          </View>
        </View>
      </View>

      <View style={styles.chainCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Block terbaru
          </ThemedText>
          <ThemedText style={styles.sectionHint}>
            {verification?.valid ? 'Data chain valid' : verification?.reason || 'Belum ada data'}
          </ThemedText>
        </View>

        <View style={styles.paginationBar}>
          <Pressable
            style={[styles.pageButton, page <= 1 ? styles.pageButtonDisabled : null]}
            onPress={() => loadChain(page - 1).catch(() => undefined)}
            disabled={page <= 1}>
            <ThemedText style={styles.pageButtonText}>Sebelumnya</ThemedText>
          </Pressable>
          <ThemedText style={styles.pageInfo}>Halaman {page} / {totalPages}</ThemedText>
          <Pressable
            style={[styles.pageButton, page >= totalPages ? styles.pageButtonDisabled : null]}
            onPress={() => loadChain(page + 1).catch(() => undefined)}
            disabled={page >= totalPages}>
            <ThemedText style={styles.pageButtonText}>Berikutnya</ThemedText>
          </Pressable>
        </View>

        {blocks.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyTitle}>Data ledger belum tersedia</ThemedText>
            <ThemedText style={styles.emptyBody}>
              Pastikan backend ledger aktif dan `EXPO_PUBLIC_LEDGER_API_BASE_URL` sudah mengarah ke server yang benar.
            </ThemedText>
          </View>
        ) : (
          blocks.map((block, index) => (
            <Pressable
              key={block.block_index}
              style={[styles.blockRow, index < blocks.length - 1 ? styles.blockBorder : null]}
              onPress={() =>
                router.push({
                  pathname: '/block-detail',
                  params: {
                    blockIndex: String(block.block_index),
                    readingId: String(block.reading_id),
                    transactionId: block.transaction_id,
                    deviceId: block.device_id,
                    lettuceBedId: block.lettuce_bed_id,
                    payloadHash: block.payload_hash,
                    previousHash: block.previous_hash,
                    blockHash: block.block_hash,
                    createdAt: block.created_at,
                    ph: block.ph != null ? String(block.ph) : '',
                    tdsPpm: block.tds_ppm != null ? String(block.tds_ppm) : '',
                    waterTemp: block.temperature_c != null ? String(block.temperature_c) : '',
                    airTemp: block.air_temperature_c != null ? String(block.air_temperature_c) : '',
                    humidity: block.humidity_pct != null ? String(block.humidity_pct) : '',
                    waterLevel: block.water_level_pct != null ? String(block.water_level_pct) : '',
                    chainStatus: verification?.valid ? 'Tervalidasi' : 'Perlu pemeriksaan',
                    chainNote: verification?.valid ? 'Hash dan urutan block sesuai hasil verifikasi backend.' : verification?.reason || '',
                  },
                })
              }>
              <View style={styles.blockIdWrap}>
                <ThemedText style={styles.blockId}>#{block.block_index}</ThemedText>
              </View>
              <View style={styles.blockContent}>
                <View style={styles.blockTop}>
                  <ThemedText style={styles.blockTitle}>{block.device_id}</ThemedText>
                  <ThemedText style={styles.blockTime}>{formatTimestamp(block.created_at)}</ThemedText>
                </View>
                <ThemedText style={styles.blockHash}>{shortHash(block.block_hash)}</ThemedText>
                <ThemedText style={styles.blockDetail}>
                  Bed {block.lettuce_bed_id} • Transaksi {block.transaction_id}
                </ThemedText>
                <View style={[styles.statusPill, verification?.valid ? styles.statusConfirmed : styles.statusPending]}>
                  <ThemedText style={styles.statusPillText}>{verification?.valid ? 'Tervalidasi' : 'Perlu pemeriksaan'}</ThemedText>
                </View>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {error ? (
        <View style={styles.errorCard}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
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
    backgroundColor: '#0f1724',
    gap: 12,
  },
  stateTitle: {
    color: '#f3f7ff',
  },
  stateBody: {
    color: '#bfd1ee',
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#0f1724',
    gap: 12,
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(104, 151, 255, 0.18)',
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
    maxWidth: 320,
  },
  subtitle: {
    color: '#bfd1ee',
    lineHeight: 24,
    fontSize: 15,
    maxWidth: 340,
  },
  nodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  nodeCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  nodeLabel: {
    color: '#bfd1ee',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  nodeValue: {
    color: '#ffffff',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '900',
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    color: '#172033',
  },
  sectionHint: {
    color: '#5f6c85',
    fontSize: 12,
    fontWeight: '700',
  },
  chainCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  pageButton: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#0f1724',
  },
  pageButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
  pageButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  pageInfo: {
    color: '#5f6c85',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: '#eff4fb',
    gap: 8,
  },
  emptyTitle: {
    color: '#172033',
    fontSize: 18,
    fontWeight: '800',
  },
  emptyBody: {
    color: '#5f6c85',
  },
  blockRow: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 14,
  },
  blockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#edf1f6',
  },
  blockIdWrap: {
    width: 54,
    alignItems: 'center',
  },
  blockId: {
    color: '#4c6cb8',
    fontWeight: '900',
  },
  blockContent: {
    flex: 1,
    gap: 6,
  },
  blockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  blockTitle: {
    color: '#172033',
    fontWeight: '800',
  },
  blockTime: {
    color: '#5f6c85',
    fontSize: 12,
  },
  blockHash: {
    color: '#3150a2',
    fontWeight: '700',
  },
  blockDetail: {
    color: '#5f6c85',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusConfirmed: {
    backgroundColor: '#dce9ff',
  },
  statusPending: {
    backgroundColor: '#f4dfc4',
  },
  statusPillText: {
    color: '#172033',
    fontSize: 12,
    fontWeight: '800',
  },
  errorCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#f7e5d8',
  },
  errorText: {
    color: '#6d3520',
  },
});
