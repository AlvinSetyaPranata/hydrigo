import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import {
  fetchDashboard,
  getApiBaseUrl,
  updateManualControl,
  updateNutrientMode,
  type ManualControl,
} from '@/lib/api';
import { attachBrokerListeners, mqttTopics, publishTopic, subscribeTopic } from '@/lib/mqttClient';

const controlViews = [
  { id: 'manual', label: 'Manual' },
  { id: 'automatic', label: 'Otomatis' },
] as const;

export default function ControlScreen() {
  const { user } = useAuth();
  const [manualControls, setManualControls] = useState<ManualControl[]>([]);
  const [devicePhase, setDevicePhase] = useState('Menunggu data perangkat');
  const [activeView, setActiveView] = useState<(typeof controlViews)[number]['id']>('automatic');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingControlId, setSavingControlId] = useState('');
  const [savingMode, setSavingMode] = useState(false);
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
      setDevicePhase(dashboard.devicePhase ?? 'Menunggu data perangkat');
      setActiveView(dashboard.nutrientMode === 'Manual' ? 'manual' : 'automatic');
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
    const intervalId = setInterval(() => {
      loadControls(true).catch(() => undefined);
    }, 3000);

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

      const unsubscribeStatus = subscribeTopic(mqttTopics.status, (message) => {
        try {
          const payload = JSON.parse(message) as {
            nutrientMode?: string;
            controls?: ManualControl[];
            mode?: string;
            controlMode?: number;
          };

          if (Array.isArray(payload.controls)) {
            setManualControls(payload.controls);
          }

          if (payload.controlMode === 1 || payload.mode === 'manual' || payload.nutrientMode === 'Manual') {
            setActiveView('manual');
          } else if (payload.controlMode === 0 || payload.mode === 'automatic' || payload.nutrientMode === 'Otomatis') {
            setActiveView('automatic');
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
      if (nextStatus) {
        setTimeout(() => {
          loadControls(true).catch(() => undefined);
        }, 3500);
      }
      setError('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal mengubah status kontrol.');
    } finally {
      setSavingControlId('');
    }
  }

  async function handleSelectMode(nextMode: (typeof controlViews)[number]['id']) {
    if (savingMode || activeView === nextMode) {
      return;
    }

    setSavingMode(true);

    try {
      const label = await updateNutrientMode(nextMode);
      setActiveView(label === 'Manual' ? 'manual' : 'automatic');
      publishTopic(mqttTopics.control, {
        type: 'control_mode',
        value: nextMode,
      });
      setError('');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Gagal mengubah mode kontrol.');
    } finally {
      setSavingMode(false);
    }
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  if (user.role !== 'admin') {
    return <Redirect href="/(tabs)" />;
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

        <View style={styles.modeRow}>
          <View style={styles.modeCard}>
            <ThemedText style={styles.modeLabel}>Mode yang sedang dipakai</ThemedText>
            <ThemedText style={styles.modeValue}>{activeView === 'manual' ? 'Manual' : 'Otomatis'}</ThemedText>
          </View>
          <View style={styles.modeBadge}>
            <ThemedText style={styles.modeBadgeText}>{brokerState}</ThemedText>
          </View>
        </View>

        <View style={styles.phaseBanner}>
          <ThemedText style={styles.phaseLabel}>Fase perangkat IoT</ThemedText>
          <ThemedText style={styles.phaseValue}>{devicePhase}</ThemedText>
        </View>
      </View>

      <View style={styles.viewTabs}>
        {controlViews.map((item) => {
          const selected = activeView === item.id;

          return (
            <Pressable
              key={item.id}
              style={[styles.viewTab, selected ? styles.viewTabActive : null]}
              onPress={() => handleSelectMode(item.id).catch(() => undefined)}
              disabled={savingMode}>
              <ThemedText style={[styles.viewTabText, selected ? styles.viewTabTextActive : null]}>
                {savingMode && selected ? 'Memproses...' : item.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {activeView === 'manual' ? (
        <View style={styles.controlSection}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Kontrol manual
            </ThemedText>
            <ThemedText style={styles.sectionHint}>Tersinkron dengan backend</ThemedText>
          </View>

          <ThemedText style={styles.panelLead}>
            KNN nonaktif, pompa nutrisi dan pompa air dikontrol manual dari aplikasi.
          </ThemedText>

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
      ) : (
        <View style={styles.scheduleCard}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.automaticTitle}>
              Mode otomatis
            </ThemedText>
            <ThemedText style={styles.automaticHint}>{activeView === 'automatic' ? 'Aktif' : 'Nonaktif'}</ThemedText>
          </View>

          <ThemedText style={styles.automaticLead}>
            Sistem dikontrol otomatis oleh KNN. Tombol manual pompa dinonaktifkan selama mode otomatis aktif.
          </ThemedText>

          <View style={styles.autoInfoCard}>
            <ThemedText style={styles.autoInfoTitle}>Mode aktif: Otomatis</ThemedText>
            <ThemedText style={styles.autoInfoText}>
              ESP32 menjalankan pompa nutrisi berdasarkan hasil model KNN dan kontrol manual tidak mengganggu pompa.
            </ThemedText>
          </View>
        </View>
      )}

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
    flexWrap: 'wrap',
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
    alignSelf: 'flex-start',
  },
  modeBadgeText: {
    color: '#f6ffed',
    fontWeight: '800',
    fontSize: 12,
  },
  phaseBanner: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#eef7e6',
    gap: 4,
    width: '100%',
  },
  phaseLabel: {
    color: '#648165',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  phaseValue: {
    color: '#17301a',
    fontSize: 18,
    fontWeight: '800',
  },
  viewTabs: {
    flexDirection: 'row',
    backgroundColor: '#dfead7',
    borderRadius: 18,
    padding: 6,
    gap: 8,
  },
  viewTab: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  viewTabActive: {
    backgroundColor: '#17301a',
  },
  viewTabText: {
    color: '#49604d',
    fontWeight: '800',
    fontSize: 14,
  },
  viewTabTextActive: {
    color: '#f6ffed',
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
  panelLead: {
    color: '#d3e7d2',
    lineHeight: 22,
    fontSize: 14,
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
  automaticTitle: {
    color: '#17301a',
  },
  automaticHint: {
    color: '#5a6c5b',
    fontSize: 12,
    fontWeight: '800',
  },
  automaticLead: {
    color: '#546756',
    lineHeight: 22,
    fontSize: 14,
  },
  autoInfoCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#eef4e8',
    gap: 6,
  },
  autoInfoTitle: {
    color: '#17301a',
    fontWeight: '800',
  },
  autoInfoText: {
    color: '#546756',
    lineHeight: 20,
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
