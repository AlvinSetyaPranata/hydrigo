import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { fetchLedgerChain, getLedgerBaseUrl, type LedgerBlock, type LedgerVerification } from '@/lib/api';

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
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  async function loadChain(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchLedgerChain();
      const nextBlocks = [...result.blocks].reverse();

      setBlocks(nextBlocks);
      setVerification(result.verification);
      setSelectedBlockIndex((current) => current ?? nextBlocks[0]?.block_index ?? null);
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
  }

  useEffect(() => {
    loadChain().catch(() => undefined);
  }, []);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.block_index === selectedBlockIndex) ?? blocks[0] ?? null,
    [blocks, selectedBlockIndex],
  );

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadChain(true).catch(() => undefined)} />}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Hydrigo Chain</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Jejak ledger yang dibaca langsung dari backend
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Tab ini tidak lagi memakai block dummy. Jika Django ledger aktif, mobile menampilkan block hash-chain asli beserta status verifikasinya.
        </ThemedText>

        <View style={styles.nodeGrid}>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Jumlah block</ThemedText>
            <ThemedText style={styles.nodeValue}>{blocks.length}</ThemedText>
          </View>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Validasi chain</ThemedText>
            <ThemedText style={styles.nodeValue}>{verification?.valid ? 'Valid' : 'Perlu cek'}</ThemedText>
          </View>
          <View style={styles.nodeCard}>
            <ThemedText style={styles.nodeLabel}>Ledger API</ThemedText>
            <ThemedText style={styles.nodeValue}>{getLedgerBaseUrl() ? 'Resolved' : 'Unset'}</ThemedText>
          </View>
        </View>
      </View>

      {selectedBlock ? (
        <View style={styles.detailCard}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Detail transaksi
            </ThemedText>
            <ThemedText style={styles.sectionHint}>Block #{selectedBlock.block_index}</ThemedText>
          </View>

          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Device</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedBlock.device_id}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Bed</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedBlock.lettuce_bed_id}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Transaction</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedBlock.transaction_id}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Hash block</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedBlock.block_hash}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Payload hash</ThemedText>
            <ThemedText style={styles.detailValue}>{selectedBlock.payload_hash}</ThemedText>
          </View>
          <View style={styles.detailRow}>
            <ThemedText style={styles.detailLabel}>Waktu</ThemedText>
            <ThemedText style={styles.detailValue}>{formatTimestamp(selectedBlock.created_at)}</ThemedText>
          </View>
        </View>
      ) : null}

      <View style={styles.chainCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Block terbaru
          </ThemedText>
          <ThemedText style={styles.sectionHint}>
            {verification?.valid ? 'Chain tervalidasi' : verification?.reason || 'Belum ada data'}
          </ThemedText>
        </View>

        {blocks.length === 0 ? (
          <View style={styles.emptyCard}>
            <ThemedText style={styles.emptyTitle}>Ledger belum tersedia</ThemedText>
            <ThemedText style={styles.emptyBody}>
              Jalankan Django backend atau isi `EXPO_PUBLIC_LEDGER_API_BASE_URL` agar tab blockchain bisa mengambil data nyata.
            </ThemedText>
          </View>
        ) : (
          blocks.map((block, index) => (
            <Pressable
              key={block.block_index}
              style={[
                styles.blockRow,
                index < blocks.length - 1 ? styles.blockBorder : null,
                selectedBlockIndex === block.block_index ? styles.blockRowActive : null,
              ]}
              onPress={() => setSelectedBlockIndex(block.block_index)}>
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
                  Bed {block.lettuce_bed_id} • Tx {block.transaction_id}
                </ThemedText>
                <View style={[styles.statusPill, verification?.valid ? styles.statusConfirmed : styles.statusPending]}>
                  <ThemedText style={styles.statusPillText}>{verification?.valid ? 'Confirmed' : 'Check chain'}</ThemedText>
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
  detailCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 14,
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
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#5f6c85',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  detailValue: {
    color: '#172033',
    fontWeight: '700',
  },
  chainCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 8,
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
  blockRowActive: {
    backgroundColor: '#f6f9fe',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 16,
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
