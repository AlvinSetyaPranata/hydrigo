import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import {
  fetchDashboard,
  getApiBaseUrl,
  updateManualControl,
  updateNutrientMode,
  type ManualControl,
} from '@/lib/api';
import { attachBrokerListeners, getBrokerUrl, mqttTopics, publishTopic, subscribeTopic } from '@/lib/mqttClient';

const nutrientModes = ['Semai', 'Vegetatif', 'Finishing'];

export default function ControlScreen() {
  const [manualControls, setManualControls] = useState<ManualControl[]>([]);
  const [nutrientMode, setNutrientModeState] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingControlId, setSavingControlId] = useState('');
  const [savingMode, setSavingMode] = useState('');
  const [error, setError] = useState('');
  const [brokerState, setBrokerState] = useState('Menghubungkan');

  async function loadControls(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const dashboard = await fetchDashboard();
      setManualControls(dashboard.manualControls ?? []);
      setNutrientModeState(dashboard.nutrientMode ?? '');
      setError('');
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Gagal memuat data kontrol.');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadControls().catch(() => undefined);
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

      const unsubscribeStatus = subscribeTopic(mqttTopics.status, (message) => {
        try {
          const payload = JSON.parse(message) as {
            nutrientMode?: string;
            controls?: ManualControl[];
          };

          if (payload.nutrientMode) {
            setNutrientModeState(payload.nutrientMode);
          }

          if (Array.isArray(payload.controls)) {
            setManualControls(payload.controls);
          }
        } catch {
          setBrokerState('Data tidak valid');
        }
      });

      return () => {
        unsubscribeStatus();
        cleanup();
      };
    } catch (mqttError) {
      setBrokerState('Tidak tersedia');
      setError((mqttError as Error).message);
    }

    return cleanup;
  }, []);

  async function handleToggleControl(control: ManualControl) {
    const nextStatus = !control.status;
    setSavingControlId(control.id);

    try {
      const nextControls = await updateManualControl(control.id, nextStatus);
      setManualControls(nextControls);
      publishTopic(mqttTopics.control, {
        type: 'manual_control',
        target: control.id,
        value: nextStatus,
      });
      setError('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal mengubah status kontrol.');
    } finally {
      setSavingControlId('');
    }
  }

  async function handleUpdateMode(mode: string) {
    setSavingMode(mode);

    try {
      const nextMode = await updateNutrientMode(mode);
      setNutrientModeState(nextMode);
      publishTopic(mqttTopics.control, {
        type: 'nutrient_mode',
        value: mode,
      });
      setError('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal mengubah mode nutrisi.');
    } finally {
      setSavingMode('');
    }
  }

  if (loading) {
    return (
      <View style={styles.stateScreen}>
        <View style={styles.stateCard}>
          <ActivityIndicator size="large" color="#2f7d32" />
          <ThemedText type="subtitle" style={styles.stateTitle}>
            Memuat kontrol greenhouse
          </ThemedText>
          <ThemedText style={styles.stateBody}>Mengambil konfigurasi perangkat dari {getApiBaseUrl() ?? 'API Hydrigo'}.</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadControls(true).catch(() => undefined)} />}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Pusat Kontrol</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Atur perangkat dan mode nutrisi dari aplikasi
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Setiap perubahan dikirim ke backend, lalu disiarkan lagi melalui MQTT agar status di seluruh sistem tetap sinkron.
        </ThemedText>

        <View style={styles.modeRow}>
          <View style={styles.modeCard}>
          <ThemedText style={styles.modeLabel}>Mode nutrisi aktif</ThemedText>
          <ThemedText style={styles.modeValue}>{nutrientMode || '-'}</ThemedText>
        </View>
        <View style={styles.modeBadge}>
            <ThemedText style={styles.modeBadgeText}>{brokerState}</ThemedText>
        </View>
      </View>
      </View>

      <View style={styles.controlSection}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Kontrol manual
          </ThemedText>
          <ThemedText style={styles.sectionHint}>Tersinkron dengan backend</ThemedText>
        </View>

        {manualControls.map((item) => {
          const isSaving = savingControlId === item.id;

          return (
            <View key={item.id} style={styles.controlCard}>
              <View style={styles.controlTop}>
                <View style={styles.controlCopy}>
                  <ThemedText style={styles.controlTitle}>{item.name}</ThemedText>
                  <ThemedText style={styles.controlDesc}>{item.description}</ThemedText>
                </View>
                <View style={styles.switchWrap}>
                  <ThemedText style={styles.switchState}>{isSaving ? '...' : item.status ? 'ON' : 'OFF'}</ThemedText>
                  <Switch
                    value={item.status}
                    onValueChange={() => handleToggleControl(item).catch(() => undefined)}
                    disabled={isSaving}
                    trackColor={{ false: '#cad5c9', true: '#8ed16d' }}
                    thumbColor={item.status ? '#ffffff' : '#f4f4f4'}
                  />
                </View>
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.modePill, item.status ? styles.modePillOn : styles.modePillOff]}>
                  <ThemedText style={styles.modePillText}>{item.status ? 'Aktif' : 'Nonaktif'}</ThemedText>
                </View>
                <View style={[styles.stateDot, item.status ? styles.stateOn : styles.stateOff]} />
              </View>
              <Pressable
                style={[styles.actionButton, item.status ? styles.actionButtonStop : styles.actionButtonStart, isSaving ? styles.actionButtonDisabled : null]}
                onPress={() => handleToggleControl(item).catch(() => undefined)}
                disabled={isSaving}>
                <ThemedText style={styles.actionButtonText}>
                  {isSaving ? 'Memproses...' : item.status ? 'Matikan Pompa' : 'Nyalakan Pompa'}
                </ThemedText>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.scheduleCard}>
        <View style={styles.sectionHeader}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Mode nutrisi
          </ThemedText>
          <ThemedText style={styles.sectionHint}>Pilih sesuai tahap tanam</ThemedText>
        </View>

        <View style={styles.modeGrid}>
          {nutrientModes.map((mode) => {
            const selected = nutrientMode === mode;
            const isSaving = savingMode === mode;

            return (
              <Pressable
                key={mode}
                style={[styles.modeOption, selected ? styles.modeOptionSelected : null]}
                onPress={() => handleUpdateMode(mode).catch(() => undefined)}
                disabled={Boolean(savingMode)}>
                <ThemedText style={[styles.modeOptionText, selected ? styles.modeOptionTextSelected : null]}>
                  {isSaving ? 'Menyimpan...' : mode}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.sopCard}>
        <ThemedText type="subtitle" style={styles.sopTitle}>
          Catatan integrasi
        </ThemedText>
        <View style={styles.sopRow}>
          <View style={styles.sopIndex} />
          <ThemedText style={styles.sopText}>Dashboard web dan aplikasi mobile memakai backend yang sama.</ThemedText>
        </View>
        <View style={styles.sopRow}>
          <View style={styles.sopIndex} />
          <ThemedText style={styles.sopText}>Pada perangkat Android fisik, isi `EXPO_PUBLIC_API_BASE_URL` jika host Expo tidak terdeteksi otomatis.</ThemedText>
        </View>
        <View style={styles.sopRow}>
          <View style={styles.sopIndex} />
          <ThemedText style={styles.sopText}>Broker MQTT aktif: {getBrokerUrl() ?? 'belum diatur'}</ThemedText>
        </View>
        <View style={styles.sopRow}>
          <View style={styles.sopIndex} />
          <ThemedText style={styles.sopText}>Base URL aktif: {getApiBaseUrl() ?? 'belum diatur'}</ThemedText>
        </View>
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
    backgroundColor: '#fdfefb',
    gap: 12,
  },
  stateTitle: {
    color: '#17301a',
  },
  stateBody: {
    color: '#546756',
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
    maxWidth: 320,
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
    color: '#f3faec',
  },
  sectionHint: {
    color: '#b9d5b8',
    fontSize: 12,
    fontWeight: '800',
  },
  controlCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#f6fbf2',
    gap: 14,
  },
  controlTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  actionButtonStart: {
    backgroundColor: '#2f7d32',
  },
  actionButtonStop: {
    backgroundColor: '#a63f18',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  controlCopy: {
    flex: 1,
  },
  controlTitle: {
    color: '#17301a',
    fontSize: 18,
    fontWeight: '800',
  },
  controlDesc: {
    color: '#5a6c5b',
    marginTop: 4,
  },
  switchWrap: {
    alignItems: 'center',
    gap: 6,
  },
  switchState: {
    color: '#17301a',
    fontSize: 12,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modePillOn: {
    backgroundColor: '#d7efc9',
  },
  modePillOff: {
    backgroundColor: '#e7ebe3',
  },
  modePillText: {
    color: '#17301a',
    fontWeight: '800',
    fontSize: 12,
  },
  stateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stateOn: {
    backgroundColor: '#2f7d32',
  },
  stateOff: {
    backgroundColor: '#acb6aa',
  },
  scheduleCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 14,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modeOption: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#eef4e8',
  },
  modeOptionSelected: {
    backgroundColor: '#17301a',
  },
  modeOptionText: {
    color: '#17301a',
    fontWeight: '800',
  },
  modeOptionTextSelected: {
    color: '#f5fff0',
  },
  sopCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#ffffff',
    gap: 14,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#8ed16d',
    marginTop: 8,
  },
  sopText: {
    flex: 1,
    color: '#546756',
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
