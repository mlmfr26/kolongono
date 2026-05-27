import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { colors, spacing, radius, fontSize, fontWeight, shadow, palette } from '../components/theme';
import { Icon, type IconName } from '../components/Icons';

const ROLE_LABELS: Record<string, string> = {
  adherent:   'Adhérent',
  auxiliaire: 'Auxiliaire de santé',
  medecin:    'Médecin',
  admin:      'Administrateur',
  livreur:    'Livreur',
};

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const initiales = ((user?.prenom?.[0] ?? '') + (user?.nom?.[0] ?? '')).toUpperCase();

  function confirmLogout() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.blobBlue} />
        <View style={styles.blobPurple} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initiales}</Text>
        </View>
        <Text style={styles.headerName}>{user?.prenom} {user?.nom}</Text>
        <Text style={styles.headerRole}>{ROLE_LABELS[user?.role ?? ''] ?? user?.role}</Text>
        {user?.plan && (
          <View style={styles.planBadge}>
            <Text style={styles.planBadgeText}>Plan {user.plan}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Infos */}
        <View style={styles.infoCard}>
          <InfoRow iconName="mail"        label="Email" value={user?.email ?? ''} />
          <InfoRow iconName="user-circle" label="ID"    value={user?.id ?? ''} />
          <InfoRow iconName="user"        label="Rôle"  value={ROLE_LABELS[user?.role ?? ''] ?? user?.role ?? ''} />
        </View>

        {/* Liens rapides */}
        <Text style={styles.secLabel}>NAVIGATION</Text>
        <View style={styles.linksCard}>
          {([
            { iconName: 'calendar'  as IconName, label: 'Mes consultations', screen: 'Consultation' },
            { iconName: 'pill'      as IconName, label: 'Pharmacie',         screen: 'Pharmacie'   },
            { iconName: 'clipboard' as IconName, label: 'Mon dossier',       screen: 'Dossier'     },
            { iconName: 'file-text' as IconName, label: 'Ordonnances',       screen: 'Ordonnance'  },
            { iconName: 'shield'    as IconName, label: 'Ma mutuelle',       screen: 'Abonnement'  },
          ]).map(link => (
            <TouchableOpacity
              key={link.screen}
              style={styles.linkRow}
              onPress={() => navigation.navigate(link.screen)}
              activeOpacity={0.7}
            >
              <View style={styles.linkIcon}><Icon name={link.iconName} size={18} color={colors.primary} /></View>
              <Text style={styles.linkLabel}>{link.label}</Text>
              <Icon name="chevron-right" size={16} color={colors.textLight} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={confirmLogout} activeOpacity={0.85}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>

        <Text style={styles.version}>SantéDirect Kolongono v1.2.20 · 2026</Text>
        <Text style={styles.proverbe}>"Bidimu m'bupita buanga"</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ iconName, label, value }: { iconName: IconName; label: string; value: string }) {
  return (
    <View style={infoRowStyles.row}>
      <View style={infoRowStyles.iconBg}><Icon name={iconName} size={16} color={colors.textMuted} /></View>
      <View style={infoRowStyles.content}>
        <Text style={infoRowStyles.label}>{label}</Text>
        <Text style={infoRowStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoRowStyles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBg: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center' },
  content:{ flex: 1 },
  label:  { fontSize: fontSize.xs, color: colors.textMuted },
  value:  { fontSize: fontSize.md, fontWeight: fontWeight.medium, color: colors.text },
});

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: palette.white,
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: spacing.xxl,
    overflow: 'hidden',
  },
  blobBlue:   { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: palette.blue,   opacity: 0.45, top: -80, right: -60 },
  blobPurple: { position: 'absolute', width: 140, height: 140, borderRadius: 70,  backgroundColor: palette.purple, opacity: 0.35, bottom: -50, left: -40 },
  avatar:      { width: 84, height: 84, borderRadius: 42, backgroundColor: palette.blue, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: palette.white, ...shadow.md, marginBottom: spacing.md },
  avatarText:  { color: palette.blueDeep, fontSize: fontSize.xxl, fontWeight: fontWeight.black },
  headerName:  { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.black },
  headerRole:  { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 4 },
  planBadge:   { backgroundColor: palette.dark, borderRadius: radius.full, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: spacing.sm },
  planBadgeText: { color: palette.white, fontSize: fontSize.xs, fontWeight: fontWeight.black },

  scroll:        { flex: 1 },
  scrollContent: { paddingTop: spacing.lg },

  secLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, color: colors.textMuted, letterSpacing: 1, marginHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.sm },

  infoCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg, ...shadow.md },

  linksCard: { backgroundColor: colors.card, marginHorizontal: spacing.lg, borderRadius: radius.xl, overflow: 'hidden', ...shadow.md },
  linkRow:   { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkIcon:  { width: 38, height: 38, borderRadius: radius.md, backgroundColor: palette.blueSoft, justifyContent: 'center', alignItems: 'center' },
  linkLabel: { flex: 1, fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  linkChevron:{ fontSize: 20, color: colors.textLight }, // kept for safety

  logoutBtn:  { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.dangerLight, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: fontWeight.bold, fontSize: fontSize.md },

  version:  { textAlign: 'center', color: colors.textLight, fontSize: fontSize.xs, marginTop: spacing.xl },
  proverbe: { textAlign: 'center', color: colors.textLight, fontSize: fontSize.xs, fontStyle: 'italic', marginTop: spacing.xs },
});
