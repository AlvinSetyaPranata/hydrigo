import { Link, Redirect, router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/lib/auth';

const roleOptions = [
  { value: 'viewer', label: 'User pemantau' },
  { value: 'admin', label: 'Admin kontrol' },
] as const;

export default function RegisterScreen() {
  const { register, user } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [role, setRole] = useState<(typeof roleOptions)[number]['value']>('viewer');
  const [error, setError] = useState('');

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  function handleRegister() {
    try {
      register({ name, email, password, role });
      setError('');
      router.replace('/(tabs)');
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : 'Registrasi gagal.');
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.shell}>
        <View style={styles.hero}>
          <ThemedText style={styles.kicker}>Akun baru</ThemedText>
          <ThemedText type="title" style={styles.title}>
            Daftarkan akses ke aplikasi Hydrigo
          </ThemedText>
          <ThemedText style={styles.body}>Pilih peran pengguna sejak awal supaya akses ke tab kontrol langsung sesuai.</ThemedText>
        </View>

        <View style={styles.card}>
          <ThemedText style={styles.label}>Nama</ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Nama pengguna"
            placeholderTextColor="#7a8a76"
            style={styles.input}
          />

          <ThemedText style={styles.label}>Email</ThemedText>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="nama@hydrigo.app"
            placeholderTextColor="#7a8a76"
            style={styles.input}
          />

          <ThemedText style={styles.label}>Kata sandi</ThemedText>
          <View style={styles.passwordField}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!passwordVisible}
              placeholder="Minimal untuk demo lokal"
              placeholderTextColor="#7a8a76"
              style={styles.passwordInput}
            />
            <Pressable style={styles.eyeButton} onPress={() => setPasswordVisible((current) => !current)}>
              <MaterialIcons
                name={passwordVisible ? 'visibility-off' : 'visibility'}
                size={22}
                color="#24512a"
              />
            </Pressable>
          </View>

          <ThemedText style={styles.label}>Peran pengguna</ThemedText>
          <View style={styles.roleRow}>
            {roleOptions.map((option) => {
              const selected = option.value === role;

              return (
                <Pressable
                  key={option.value}
                  style={[styles.roleButton, selected ? styles.roleButtonActive : null]}
                  onPress={() => setRole(option.value)}>
                  <ThemedText style={[styles.roleText, selected ? styles.roleTextActive : null]}>{option.label}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Pressable style={styles.primaryButton} onPress={handleRegister}>
            <ThemedText style={styles.primaryButtonText}>Daftar</ThemedText>
          </Pressable>

          <Link href="/login" asChild>
            <Pressable style={styles.secondaryButton}>
              <ThemedText style={styles.secondaryButtonText}>Sudah punya akun</ThemedText>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#eef6e8',
  },
  shell: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 28,
    justifyContent: 'center',
    gap: 22,
  },
  hero: {
    gap: 10,
  },
  kicker: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#d9ebcd',
    color: '#35651f',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  title: {
    color: '#15301c',
    fontSize: 30,
    lineHeight: 36,
  },
  body: {
    color: '#456052',
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    borderRadius: 28,
    backgroundColor: '#fffef8',
    padding: 22,
    gap: 12,
    shadowColor: '#294823',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  label: {
    color: '#21422b',
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d2e0ca',
    backgroundColor: '#f8fcf4',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#173122',
    fontSize: 15,
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d2e0ca',
    backgroundColor: '#f8fcf4',
    paddingLeft: 16,
    paddingRight: 10,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#173122',
    fontSize: 15,
  },
  eyeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2efd9',
  },
  roleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  roleButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cfddc8',
    backgroundColor: '#f8fcf4',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  roleButtonActive: {
    borderColor: '#2f7d32',
    backgroundColor: '#e5f4df',
  },
  roleText: {
    color: '#335240',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  roleTextActive: {
    color: '#225e27',
  },
  error: {
    color: '#a83b2d',
    fontSize: 14,
  },
  primaryButton: {
    marginTop: 8,
    borderRadius: 16,
    backgroundColor: '#2f7d32',
    paddingVertical: 15,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#f8fff6',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cfddc8',
    paddingVertical: 15,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#28452f',
    fontSize: 15,
    fontWeight: '600',
  },
});
