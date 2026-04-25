import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

type BlockItem = {
  id: string;
  title: string;
  hash: string;
  detail: string;
  timestamp: string;
  status: 'Confirmed' | 'Pending';
};

const initialBlocks: BlockItem[] = [
  {
    id: '#2048',
    title: 'Sensor snapshot',
    hash: '0x8fa2...be19',
    detail: 'Menyimpan suhu air, pH, EC, dan kelembapan blok tanam.',
    timestamp: '08:15',
    status: 'Confirmed',
  },
  {
    id: '#2049',
    title: 'Actuator event',
    hash: '0x3cc7...90ad',
    detail: 'Perubahan status pompa nutrisi dan kipas exhaust tercatat permanen.',
    timestamp: '09:40',
    status: 'Confirmed',
  },
  {
    id: '#2050',
    title: 'Harvest audit',
    hash: '0xf51a...3d44',
    detail: 'Jejak mutu batch selada dikunci untuk verifikasi distribusi.',
    timestamp: '11:02',
    status: 'Pending',
  },
];

const ledgerItems = [
  'Data sensor dikirim tiap 15 menit ke ledger privat.',
  'Setiap perubahan perangkat menghasilkan hash audit baru.',
  'Riwayat panen dapat diverifikasi tanpa mengubah catatan lama.',
];

export default function BlockchainScreen() {
  const [network, setNetwork] = useState<'Private Chain' | 'Testnet'>('Private Chain');
  const [syncPercent, setSyncPercent] = useState(99.98);
  const [contractActive, setContractActive] = useState(true);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selectedBlockId, setSelectedBlockId] = useState(initialBlocks[0].id);

  const selectedBlock = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];

  const handleSync = () => {
    setSyncPercent((current) => Number(Math.min(100, current + 0.01).toFixed(2)));
    setBlocks((current) =>
      current.map((block, index) =>
        index === 0 ? { ...block, status: 'Confirmed', timestamp: 'Baru saja' } : block
      )
    );
  };

  const handleAddBlock = () => {
    const latestId = Number(blocks[0].id.replace('#', ''));
    const nextId = `#${latestId + 1}`;
    const nextBlock: BlockItem = {
      id: nextId,
      title: 'Control commit',
      hash: `0x${Math.random().toString(16).slice(2, 6)}...${Math.random().toString(16).slice(2, 6)}`,
      detail: 'Event baru dari perubahan node kontrol berhasil masuk ke ledger.',
      timestamp: 'Sekarang',
      status: 'Pending',
    };

    setBlocks((current) => [nextBlock, ...current]);
    setSelectedBlockId(nextId);
  };

  const handleToggleNetwork = () => {
    setNetwork((current) => (current === 'Private Chain' ? 'Testnet' : 'Private Chain'));
    setSyncPercent((current) => (current === 100 ? 99.91 : 100));
  };

  const handleToggleContract = () => {
    setContractActive((current) => !current);
  };

  const nodes = [
    { label: 'Validator greenhouse', value: 'Online' },
    { label: 'Sinkronisasi block', value: `${syncPercent.toFixed(2)}%` },
    { label: 'Smart contract', value: contractActive ? 'Active' : 'Paused' },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Hydrigo Chain</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Jejak data greenhouse di sistem blockchain
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Catat data sensor, kontrol perangkat, dan audit hasil selada dalam ledger yang tidak mudah diubah.
        </ThemedText>

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleSync}>
            <ThemedText style={styles.actionButtonPrimaryText}>Sinkronkan</ThemedText>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={handleAddBlock}>
            <ThemedText style={styles.actionButtonText}>Tambah block</ThemedText>
          </Pressable>
        </View>

        <View style={styles.nodeGrid}>
          {nodes.map((item) => (
            <View key={item.label} style={styles.nodeCard}>
              <ThemedText style={styles.nodeLabel}>{item.label}</ThemedText>
              <ThemedText style={styles.nodeValue}>{item.value}</ThemedText>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.controlPanel}>
        <View style={styles.panelItem}>
          <ThemedText style={styles.panelLabel}>Network aktif</ThemedText>
          <ThemedText style={styles.panelValue}>{network}</ThemedText>
        </View>
        <Pressable style={styles.panelButton} onPress={handleToggleNetwork}>
          <ThemedText style={styles.panelButtonText}>Ganti network</ThemedText>
        </Pressable>
        <Pressable style={styles.panelButton} onPress={handleToggleContract}>
          <ThemedText style={styles.panelButtonText}>
            {contractActive ? 'Pause contract' : 'Aktifkan contract'}
          </ThemedText>
        </Pressable>
      </View>

      <View style={styles.chainCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Block terbaru
          </ThemedText>
          <ThemedText style={styles.sectionHint}>{blocks.length} records</ThemedText>
        </View>
        {blocks.map((block, index) => (
          <Pressable
            key={block.id}
            style={[
              styles.blockRow,
              index < blocks.length - 1 ? styles.blockBorder : null,
              selectedBlockId === block.id ? styles.blockRowActive : null,
            ]}
            onPress={() => setSelectedBlockId(block.id)}>
            <View style={styles.blockIdWrap}>
              <ThemedText style={styles.blockId}>{block.id}</ThemedText>
            </View>
            <View style={styles.blockContent}>
              <View style={styles.blockTop}>
                <ThemedText style={styles.blockTitle}>{block.title}</ThemedText>
                <ThemedText style={styles.blockTime}>{block.timestamp}</ThemedText>
              </View>
              <ThemedText style={styles.blockHash}>{block.hash}</ThemedText>
              <ThemedText style={styles.blockDetail}>{block.detail}</ThemedText>
              <View style={[styles.statusPill, block.status === 'Confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                <ThemedText style={styles.statusPillText}>{block.status}</ThemedText>
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <View style={styles.detailCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.detailTitle}>
            Detail transaksi
          </ThemedText>
          <ThemedText style={styles.detailHint}>{selectedBlock.id}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Jenis</ThemedText>
          <ThemedText style={styles.detailValue}>{selectedBlock.title}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Hash</ThemedText>
          <ThemedText style={styles.detailValue}>{selectedBlock.hash}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Status</ThemedText>
          <ThemedText style={styles.detailValue}>{selectedBlock.status}</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText style={styles.detailLabel}>Keterangan</ThemedText>
          <ThemedText style={styles.detailValue}>{selectedBlock.detail}</ThemedText>
        </View>
      </View>

      <View style={styles.ledgerCard}>
        <ThemedText type="subtitle" style={styles.ledgerTitle}>
          Fungsi ledger
        </ThemedText>
        {ledgerItems.map((item) => (
          <View key={item} style={styles.ledgerRow}>
            <View style={styles.ledgerDot} />
            <ThemedText style={styles.ledgerText}>{item}</ThemedText>
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
    backgroundColor: 'rgba(71, 168, 255, 0.18)',
  },
  kicker: {
    color: '#97d4ff',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 1,
    fontSize: 12,
  },
  title: {
    color: '#f5f9ff',
    lineHeight: 38,
    maxWidth: 310,
  },
  subtitle: {
    color: '#c9d4e5',
    lineHeight: 24,
    fontSize: 15,
    maxWidth: 340,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButtonPrimary: {
    backgroundColor: '#56b6ff',
    borderColor: '#56b6ff',
  },
  actionButtonText: {
    color: '#f4f8ff',
    fontWeight: '800',
  },
  actionButtonPrimaryText: {
    color: '#0f1724',
    fontWeight: '900',
  },
  nodeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 6,
  },
  nodeCard: {
    flex: 1,
    minWidth: 96,
    borderRadius: 20,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  nodeLabel: {
    color: '#a8b8cf',
    fontSize: 12,
    lineHeight: 18,
  },
  nodeValue: {
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 6,
  },
  controlPanel: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 12,
  },
  panelItem: {
    gap: 4,
  },
  panelLabel: {
    color: '#60776a',
    fontSize: 13,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  panelValue: {
    color: '#17301a',
    fontSize: 22,
    fontWeight: '900',
  },
  panelButton: {
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 14,
    backgroundColor: '#edf4ff',
  },
  panelButtonText: {
    color: '#2356a8',
    fontWeight: '800',
    textAlign: 'center',
  },
  chainCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 10,
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
  blockRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 12,
    alignItems: 'flex-start',
    borderRadius: 18,
  },
  blockRowActive: {
    backgroundColor: '#f1f7ff',
    paddingHorizontal: 10,
  },
  blockBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5ece0',
  },
  blockIdWrap: {
    borderRadius: 14,
    backgroundColor: '#e9f2ff',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  blockId: {
    color: '#2356a8',
    fontWeight: '900',
    fontSize: 12,
  },
  blockContent: {
    flex: 1,
    gap: 4,
  },
  blockTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  blockTitle: {
    color: '#17301a',
    fontSize: 17,
    fontWeight: '800',
  },
  blockTime: {
    color: '#7087a7',
    fontSize: 12,
    fontWeight: '700',
  },
  blockHash: {
    color: '#2356a8',
    fontSize: 13,
    fontWeight: '700',
  },
  blockDetail: {
    color: '#526652',
    lineHeight: 22,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusConfirmed: {
    backgroundColor: '#dff3de',
  },
  statusPending: {
    backgroundColor: '#ffe9c7',
  },
  statusPillText: {
    color: '#37563e',
    fontSize: 12,
    fontWeight: '800',
  },
  detailCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#fdfefb',
    gap: 12,
  },
  detailTitle: {
    color: '#17301a',
  },
  detailHint: {
    color: '#2356a8',
    fontWeight: '800',
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    color: '#60776a',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  detailValue: {
    color: '#17301a',
    lineHeight: 22,
  },
  ledgerCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#dcecff',
    gap: 12,
  },
  ledgerTitle: {
    color: '#112947',
  },
  ledgerRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  ledgerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 8,
    backgroundColor: '#3478d8',
  },
  ledgerText: {
    flex: 1,
    color: '#28476f',
    lineHeight: 22,
  },
});
