import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow, TAP_TARGET, palette } from '../components/theme';
import { Icon } from '../components/Icons';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Champs requis', 'Veuillez renseigner votre email et mot de passe.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      Alert.alert('Connexion échouée', err.message ?? 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Hero ── */}
        <View style={styles.hero}>
          <View style={styles.blobBlue} />
          <View style={styles.blobPurple} />
          <View style={styles.blobGreen} />
          <View style={styles.logoMark}>
            <Icon name="cross" size={32} color={palette.white} strokeWidth={2.5} />
          </View>
          <Text style={styles.appName}>SantéDirect</Text>
          <Text style={styles.appSub}>Kolongono</Text>
          <Text style={styles.tagline}>Votre santé, à portée de main</Text>
        </View>

        {/* ── Formulaire ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Connexion</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email ou téléphone</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votreemail@exemple.com"
              placeholderTextColor={colors.placeholder}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.placeholder}
                secureTextEntry={!showPass}
                onSubmitEditing={handleLogin}
                returnKeyType="done"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Icon name={showPass ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={palette.white} />
              : <Text style={styles.loginBtnText}>Se connecter</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>
        </View>

        {/* ── Démo ── */}
        <View style={styles.demoBox}>
          <Text style={styles.demoTitle}>Comptes démo</Text>
          {[
            { label: 'Adhérent',   email: 'marie@test.cd',      pass: 'demo1234' },
            { label: 'Auxiliaire', email: 'jean@test.cd',       pass: 'demo1234' },
            { label: 'Médecin',    email: 'dr.lukusa@test.cd',  pass: 'demo1234' },
            { label: 'Admin',      email: 'admin@test.cd',      pass: 'admin1234' },
          ].map(d => (
            <TouchableOpacity
              key={d.email}
              style={styles.demoRow}
              onPress={() => { setEmail(d.email); setPassword(d.pass); }}
            >
              <Text style={styles.demoLabel}>{d.label}</Text>
              <Text style={styles.demoEmail}>{d.email}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Urgence ── */}
        <View style={styles.urgence}>
          <Text style={styles.urgenceText}>Urgence médicale ?</Text>
          <Text style={styles.urgenceNum}>SAMU 15  ·  Pompiers 18</Text>
        </View>

        <Text style={styles.version}>SantéDirect Kolongono v1.0 · 2026</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  scroll:{ flexGrow: 1 },

  hero: {
    backgroundColor: palette.white,
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 44,
    overflow: 'hidden',
    position: 'relative',
  },
  blobBlue:   { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: palette.blue,   opacity: 0.55, top: -90,  right: -70  },
  blobPurple: { position: 'absolute', width: 180, height: 180, borderRadius: 90,  backgroundColor: palette.purple, opacity: 0.45, bottom: -70, left: -50  },
  blobGreen:  { position: 'absolute', width: 110, height: 110, borderRadius: 55,  backgroundColor: palette.green,  opacity: 0.4,  top: 30,   left: 24   },

  logoMark:  { width: 76, height: 76, borderRadius: 24, backgroundColor: palette.dark, justifyContent: 'center', alignItems: 'center', ...shadow.lg, marginBottom: 18 },
  appName:   { color: colors.text, fontSize: fontSize.xxxl, fontWeight: fontWeight.black, letterSpacing: 1 },
  appSub:    { color: colors.textMuted, fontSize: fontSize.md, fontWeight: fontWeight.medium, letterSpacing: 4, marginTop: 2 },
  tagline:   { color: colors.textLight, fontSize: fontSize.sm, marginTop: 8 },

  card: {
    backgroundColor: palette.white,
    margin: spacing.lg,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    ...shadow.lg,
  },
  cardTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.black, color: colors.text, marginBottom: spacing.xl },

  field:    { marginBottom: spacing.lg },
  label:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    height: TAP_TARGET,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.md,
    color: colors.text,
  },
  passwordRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  eyeBtn:         { height: TAP_TARGET, width: TAP_TARGET, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },

  loginBtn: { height: TAP_TARGET, backgroundColor: palette.dark, borderRadius: radius.full, justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm, ...shadow.primary },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: palette.white, fontSize: fontSize.lg, fontWeight: fontWeight.black, letterSpacing: 0.5 },

  forgotBtn:  { alignItems: 'center', paddingVertical: spacing.md },
  forgotText: { color: palette.dark, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  demoBox: {
    backgroundColor: palette.white,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    ...shadow.sm,
  },
  demoTitle: { color: colors.textLight, fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 1, marginBottom: spacing.sm },
  demoRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  demoLabel: { color: colors.text, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  demoEmail: { color: colors.textMuted, fontSize: fontSize.xs },

  urgence:    { alignItems: 'center', paddingVertical: spacing.lg },
  urgenceText:{ color: colors.textMuted, fontSize: fontSize.xs },
  urgenceNum: { color: colors.danger, fontSize: fontSize.md, fontWeight: fontWeight.bold, marginTop: 4 },

  version: { textAlign: 'center', color: colors.textLight, fontSize: fontSize.xs, paddingBottom: spacing.xxl },
});
