import { Redirect, router } from 'expo-router';
import * as Linking from 'expo-linking';
import * as FileSystem from 'expo-file-system/legacy';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';
import { getDatasetExcelDownloadUrl } from '@/lib/api';

const exportOptions = [
  {
    id: 'all',
    title: 'Seluruh dataset yang tersedia',
    description: 'Mengekspor semua reading sensor beserta metadata blockchain ke satu file Excel.',
  },
] as const;

function getRoleLabel(role: 'admin' | 'viewer') {
  return role === 'admin' ? 'Admin kontrol' : 'User pemantau';
}

function getRoleDescription(role: 'admin' | 'viewer') {
  return role === 'admin'
    ? 'Bisa memantau sistem sekaligus mengubah mode dan kontrol perangkat.'
    : 'Fokus untuk melihat data budidaya tanpa akses ke tab kontrol.';
}

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [selectedExportOption, setSelectedExportOption] = useState<(typeof exportOptions)[number]['id']>('all');

  if (!user) {
    return <Redirect href="/login" />;
  }

  function handleLogout() {
    Alert.alert('Keluar dari akun?', 'Sesi aplikasi akan ditutup di perangkat ini.', [
      {
        text: 'Batal',
        style: 'cancel',
      },
      {
        text: 'Keluar',
        style: 'destructive',
        onPress: () => {
          logout();
          router.replace('/login');
        },
      },
    ]);
  }

  async function handleDownloadDataset() {
    if (user.role !== 'admin') {
      return;
    }

    try {
      setDownloading(true);
      const url = getDatasetExcelDownloadUrl();
      const baseDirectory = FileSystem.documentDirectory ?? FileSystem.cacheDirectory;

      if (!baseDirectory) {
        throw new Error('Direktori penyimpanan aplikasi tidak tersedia.');
      }

      const fileUri = `${baseDirectory}hydrigo-dataset.xls`;
      const result = await FileSystem.downloadAsync(url, fileUri);

      Alert.alert('Download selesai', 'Dataset Excel berhasil diunduh ke penyimpanan aplikasi.', [
        {
          text: 'Tutup',
          style: 'cancel',
        },
        {
          text: 'Buka file',
          onPress: () => {
            const nextUriPromise =
              Platform.OS === 'android' ? FileSystem.getContentUriAsync(result.uri).catch(() => result.uri) : Promise.resolve(result.uri);

            nextUriPromise
              .then(async (nextUri) => {
                const supported = await Linking.canOpenURL(nextUri);

                if (!supported) {
                  throw new Error('File berhasil diunduh, tetapi tidak ada aplikasi yang bisa membukanya.');
                }

                await Linking.openURL(nextUri);
              })
              .catch((openError) => {
                Alert.alert(
                  'File tersimpan',
                  openError instanceof Error
                    ? `${openError.message}\n\nLokasi file: ${result.uri}`
                    : `Dataset berhasil diunduh.\n\nLokasi file: ${result.uri}`,
                );
              });
          },
        },
      ]);
    } catch (downloadError) {
      Alert.alert(
        'Download gagal',
        downloadError instanceof Error ? downloadError.message : 'Dataset Excel tidak bisa diunduh.',
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <ThemedText style={styles.kicker}>Akun</ThemedText>
        <ThemedText type="title" style={styles.title}>
          Kelola akses pengguna aplikasi
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Informasi ini dipakai untuk menentukan apakah pengguna hanya melihat dashboard atau juga bisa membuka kontrol.
        </ThemedText>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>{user.name.slice(0, 1).toUpperCase()}</ThemedText>
        </View>
        <View style={styles.identity}>
          <ThemedText style={styles.name}>{user.name}</ThemedText>
          <ThemedText style={styles.email}>{user.email}</ThemedText>
        </View>
        <View style={[styles.roleBadge, user.role === 'admin' ? styles.roleAdmin : styles.roleViewer]}>
          <ThemedText style={styles.roleBadgeText}>{getRoleLabel(user.role)}</ThemedText>
        </View>
      </View>

      <View style={styles.infoCard}>
        <ThemedText style={styles.sectionLabel}>Peran aktif</ThemedText>
        <ThemedText style={styles.roleTitle}>{getRoleLabel(user.role)}</ThemedText>
        <ThemedText style={styles.roleBody}>{getRoleDescription(user.role)}</ThemedText>
      </View>

      <View style={styles.infoCard}>
        <ThemedText style={styles.sectionLabel}>Akses aplikasi</ThemedText>
        <View style={styles.accessRow}>
          <ThemedText style={styles.accessName}>Dashboard</ThemedText>
          <ThemedText style={styles.accessValue}>Tersedia</ThemedText>
        </View>
        <View style={styles.accessRow}>
          <ThemedText style={styles.accessName}>Blockchain</ThemedText>
          <ThemedText style={styles.accessValue}>Tersedia</ThemedText>
        </View>
        <View style={styles.accessRow}>
          <ThemedText style={styles.accessName}>Kontrol perangkat</ThemedText>
          <ThemedText style={styles.accessValue}>{user.role === 'admin' ? 'Tersedia' : 'Tidak aktif'}</ThemedText>
        </View>
        <View style={styles.accessRow}>
          <ThemedText style={styles.accessName}>Download dataset Excel</ThemedText>
          <ThemedText style={styles.accessValue}>{user.role === 'admin' ? 'Admin saja' : 'Tidak aktif'}</ThemedText>
        </View>
      </View>

      {user.role === 'admin' ? (
        <View style={styles.infoCard}>
          <ThemedText style={styles.sectionLabel}>Dataset</ThemedText>
          <ThemedText style={styles.roleTitle}>Export data hydroponic</ThemedText>
          <ThemedText style={styles.roleBody}>
            Unduh dataset Excel yang berisi reading sensor beserta metadata blockchain untuk kebutuhan audit atau analisis.
          </ThemedText>
          <View style={styles.optionList}>
            {exportOptions.map((option) => {
              const selected = selectedExportOption === option.id;

              return (
                <Pressable
                  key={option.id}
                  style={[styles.optionCard, selected ? styles.optionCardSelected : null]}
                  onPress={() => setSelectedExportOption(option.id)}>
                  <View style={[styles.optionRadio, selected ? styles.optionRadioSelected : null]} />
                  <View style={styles.optionCopy}>
                    <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                    <ThemedText style={styles.optionDescription}>{option.description}</ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.downloadButton, downloading ? styles.downloadButtonDisabled : null]}
            onPress={() => handleDownloadDataset().catch(() => undefined)}
            disabled={downloading}>
            <ThemedText style={styles.downloadText}>
              {downloading ? 'Mengunduh file...' : 'Download seluruh dataset Excel'}
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <ThemedText style={styles.logoutText}>Keluar dari akun</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#edf4e8',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
    gap: 18,
  },
  hero: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 30,
    backgroundColor: '#173322',
    padding: 22,
    gap: 10,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -15,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: '#5ba85d',
    opacity: 0.2,
  },
  kicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: '#284d33',
    color: '#dcefd4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  title: {
    color: '#f4fff1',
    lineHeight: 38,
  },
  subtitle: {
    color: '#c6dcc8',
    fontSize: 15,
    lineHeight: 22,
  },
  profileCard: {
    borderRadius: 26,
    backgroundColor: '#fffef8',
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 999,
    backgroundColor: '#dcefd4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#24512a',
    fontSize: 24,
    fontWeight: '800',
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: '#173122',
    fontSize: 20,
    fontWeight: '800',
  },
  email: {
    color: '#6a7e6f',
    fontSize: 14,
  },
  roleBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  roleAdmin: {
    backgroundColor: '#d8eed2',
  },
  roleViewer: {
    backgroundColor: '#edf0e8',
  },
  roleBadgeText: {
    color: '#244a2a',
    fontSize: 12,
    fontWeight: '700',
  },
  infoCard: {
    borderRadius: 24,
    backgroundColor: '#fffef8',
    padding: 20,
    gap: 10,
  },
  sectionLabel: {
    color: '#58705f',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  roleTitle: {
    color: '#173122',
    fontSize: 22,
    fontWeight: '800',
  },
  roleBody: {
    color: '#476050',
    fontSize: 15,
    lineHeight: 22,
  },
  accessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    gap: 12,
  },
  accessName: {
    color: '#244230',
    fontSize: 15,
    fontWeight: '600',
  },
  accessValue: {
    color: '#5f775f',
    fontSize: 14,
    fontWeight: '700',
  },
  optionList: {
    gap: 10,
    marginTop: 4,
  },
  optionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d8e4d4',
    backgroundColor: '#f8fbf5',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  optionCardSelected: {
    borderColor: '#24512a',
    backgroundColor: '#edf6e9',
  },
  optionRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#8ca18d',
    marginTop: 2,
  },
  optionRadioSelected: {
    borderColor: '#24512a',
    backgroundColor: '#24512a',
  },
  optionCopy: {
    flex: 1,
    gap: 4,
  },
  optionTitle: {
    color: '#173122',
    fontSize: 15,
    fontWeight: '700',
  },
  optionDescription: {
    color: '#5f775f',
    fontSize: 13,
    lineHeight: 19,
  },
  downloadButton: {
    marginTop: 6,
    borderRadius: 18,
    backgroundColor: '#24512a',
    paddingVertical: 15,
    alignItems: 'center',
  },
  downloadButtonDisabled: {
    opacity: 0.7,
  },
  downloadText: {
    color: '#f4fff1',
    fontSize: 15,
    fontWeight: '800',
  },
  logoutButton: {
    borderRadius: 20,
    backgroundColor: '#8f2f2f',
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff8f8',
    fontSize: 16,
    fontWeight: '700',
  },
});
