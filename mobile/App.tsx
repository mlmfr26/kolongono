/**
 * SantéDirect — Kolongono
 * Navigation principale : rôles adhérent / auxiliaire / médecin / admin
 *
 * Architecture :
 *   AuthProvider > NavigationContainer > RootStack
 *     ├── Login (non connecté)
 *     ├── AdherentTabs   (adhérent / famille)
 *     ├── AuxiliaireTabs (auxiliaire)
 *     ├── MedecinTabs    (médecin)
 *     ├── CentreTabs     (admin local / gestionnaire / personnel interne ou externe)
 *     └── AdminTabs      (superadmin — réseau complet)
 */

import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform,
} from 'react-native';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message || String(e) }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#ff4444', fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Erreur JS</Text>
          <Text style={{ color: '#fff', fontSize: 13, lineHeight: 20 }}>{this.state.error}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}
import { GestureHandlerRootView }     from 'react-native-gesture-handler';
import { NavigationContainer }        from '@react-navigation/native';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { createStackNavigator }       from '@react-navigation/stack';
import { SafeAreaProvider }           from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from './components/AuthContext';
import { colors, fontSize, fontWeight, BOTTOM_TAB_HEIGHT, BOTTOM_TAB_MARGIN, spacing, radius, shadow, palette } from './components/theme';
import { Icon, IconName } from './components/Icons';

// ── Screens communs ────────────────────────────────────────────────────────────
import LoginScreen           from './screens/LoginScreen';
import DashboardScreen       from './screens/DashboardScreen';
import ConsultationScreen    from './screens/ConsultationScreen';
import PreConsultationScreen from './screens/PreConsultationScreen';
import PharmacieScreen       from './screens/PharmacieScreen';
import DossierScreen         from './screens/DossierScreen';
import AbonnementScreen      from './screens/AbonnementScreen';
import OrdonnanceScreen      from './screens/OrdonnanceScreen';
import ProfileScreen             from './screens/ProfileScreen';
import TeleconsultationScreen    from './screens/TeleconsultationScreen';

// ── Screens auxiliaire ────────────────────────────────────────────────────────
import AuxiliaireHomeScreen       from './screens/auxiliaire/AuxiliaireHomeScreen';
import SaisieSignesVitauxScreen   from './screens/auxiliaire/SaisieSignesVitauxScreen';
import SuiviPatientScreen         from './screens/auxiliaire/SuiviPatientScreen';
import FournituresScreen          from './screens/auxiliaire/FournituresScreen';

// ── Screens médecin ───────────────────────────────────────────────────────────
import MedecinDashboardScreen     from './screens/medecin/MedecinDashboardScreen';
import ConsultationEnCoursScreen  from './screens/medecin/ConsultationEnCoursScreen';
import OrdonnanceDigitaleScreen   from './screens/medecin/OrdonnanceDigitaleScreen';

// ── Screens centre de santé ───────────────────────────────────────────────────
import CentreDashboardScreen      from './screens/centre/CentreDashboardScreen';
import PersonnelScreen            from './screens/centre/PersonnelScreen';
import AdmissionScreen            from './screens/centre/AdmissionScreen';
import RefectoireScreen           from './screens/centre/RefectoireScreen';

// ── Screens admin ─────────────────────────────────────────────────────────────
import AdminDashboardScreen       from './screens/admin/AdminDashboardScreen';
import PharmacieAdminScreen       from './screens/admin/PharmacieAdminScreen';
import MedecinsAdminScreen        from './screens/admin/MedecinsAdminScreen';

// ── Screens scanner pharmacie ─────────────────────────────────────────────────
import ScannerStockScreen         from './screens/pharmacie/ScannerStockScreen';
import MedicamentInconnuScreen    from './screens/pharmacie/MedicamentInconnuScreen';
import FormulaireStockScreen      from './screens/pharmacie/FormulaireStockScreen';
import AbonnementsAdminScreen     from './screens/admin/AbonnementsAdminScreen';
import UnitesSanitairesScreen     from './screens/admin/UnitesSanitairesScreen';
import UniteDetailScreen          from './screens/admin/UniteDetailScreen';
import RapportsScreen             from './screens/admin/RapportsScreen';
import QRScannerScreen            from './screens/QRScannerScreen';
import TriageScreen               from './screens/TriageScreen';
import PriseRDVScreen             from './screens/PriseRDVScreen';
import ComptePatientScreen        from './screens/ComptePatientScreen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Tab item — pill sombre flottant ─────────────────────────────────────────

function TabItem({ iconName, label, focused }: { iconName: IconName; label: string; focused: boolean }) {
  return (
    <View style={[tabStyles.item, focused && tabStyles.itemFocused]}>
      <Icon
        name={iconName}
        size={focused ? 18 : 22}
        color={focused ? palette.dark : 'rgba(255,255,255,0.55)'}
        strokeWidth={focused ? 2.2 : 1.8}
      />
      {focused && <Text style={tabStyles.label}>{label}</Text>}
    </View>
  );
}

const TAB_SCREEN_OPTS = {
  headerStyle:      { backgroundColor: colors.primaryDark },
  headerTintColor:  '#fff',
  headerTitleStyle: { fontWeight: fontWeight.bold, fontSize: fontSize.lg } as any,
};

const TAB_NAV_OPTS = {
  ...TAB_SCREEN_OPTS,
  tabBarShowLabel: false,
  tabBarStyle: {
    position: 'absolute' as const,
    bottom: BOTTOM_TAB_MARGIN,
    left: 20,
    right: 20,
    height: BOTTOM_TAB_HEIGHT,
    backgroundColor: palette.dark,
    borderRadius: radius.full,
    borderTopWidth: 0,
    ...shadow.nav,
  },
  tabBarItemStyle: {
    paddingVertical: 6,
  },
};

// ─── "Plus" adhérent ──────────────────────────────────────────────────────────

function AdherentPlusScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const initiales = ((user?.prenom?.[0] ?? '') + (user?.nom?.[0] ?? '')).toUpperCase();
  const modules: { iconName: IconName; label: string; screen: string; color: string }[] = [
    { iconName: 'clipboard',    label: 'Mon dossier',    screen: 'Dossier',       color: colors.dossier    },
    { iconName: 'file-text',    label: 'Ordonnances',    screen: 'Ordonnance',    color: colors.accent     },
    { iconName: 'wallet',       label: 'Mon compte',     screen: 'ComptePatient', color: colors.warning    },
    { iconName: 'shield',       label: 'Ma mutuelle',    screen: 'Abonnement',    color: colors.abonnement },
    { iconName: 'user-circle',  label: 'Mon profil',     screen: 'Profile',       color: colors.primaryDark },
  ];
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={plusStyles.header}>
        <View style={plusStyles.decor1} />
        <View style={plusStyles.decor2} />
        <View style={plusStyles.avatar}><Text style={plusStyles.avatarText}>{initiales}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={plusStyles.name}>{user?.prenom} {user?.nom}</Text>
          <Text style={plusStyles.role}>Adhérent · Plan {user?.plan ?? '—'}</Text>
        </View>
      </View>
      <View style={plusStyles.modules}>
        {modules.map(m => (
          <TouchableOpacity key={m.screen} style={plusStyles.row} onPress={() => navigation.navigate(m.screen, m.screen === 'ComptePatient' ? { patient_id: user?.id, patient_nom: `${user?.prenom} ${user?.nom}` } : undefined)} activeOpacity={0.7}>
            <View style={[plusStyles.iconBg, { backgroundColor: m.color + '18' }]}>
              <Icon name={m.iconName} size={20} color={m.color} />
            </View>
            <Text style={plusStyles.rowLabel}>{m.label}</Text>
            <Icon name="chevron-right" size={18} color={colors.textLight} />
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={plusStyles.logout} onPress={logout}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="logout" size={18} color={colors.danger} />
          <Text style={plusStyles.logoutText}>Se déconnecter</Text>
        </View>
      </TouchableOpacity>
      <Text style={plusStyles.version}>SantéDirect Kolongono v1.2.20 · 2026</Text>
    </ScrollView>
  );
}

// ─── Tabs adhérent ─────────────────────────────────────────────────────────────

function AdherentTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_NAV_OPTS}>
      <Tab.Screen name="Accueil"      component={DashboardScreen}    options={{ title: 'SantéDirect',  tabBarIcon: ({ focused }) => <TabItem iconName="home"     label="Accueil"   focused={focused} /> }} />
      <Tab.Screen name="Consultation" component={ConsultationScreen} options={{ title: 'Consultation', tabBarIcon: ({ focused }) => <TabItem iconName="calendar"  label="RDV"       focused={focused} /> }} />
      <Tab.Screen name="Pharmacie"    component={PharmacieScreen}    options={{ title: 'Pharmacie',    tabBarIcon: ({ focused }) => <TabItem iconName="pill"      label="Pharmacie" focused={focused} /> }} />
      <Tab.Screen name="Plus"         component={AdherentPlusScreen} options={{ title: 'Plus',         tabBarIcon: ({ focused }) => <TabItem iconName="user"      label="Profil"    focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ─── Tabs auxiliaire ──────────────────────────────────────────────────────────

function AuxiliaireTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_NAV_OPTS}>
      <Tab.Screen name="AuxiliaireDashboard" component={AuxiliaireHomeScreen}     options={{ title: 'Tableau de bord', tabBarIcon: ({ focused }) => <TabItem iconName="grid"        label="Tableau"     focused={focused} /> }} />
      <Tab.Screen name="SaisieSignesVitaux"  component={SaisieSignesVitauxScreen} options={{ title: 'Signes vitaux',   tabBarIcon: ({ focused }) => <TabItem iconName="thermometer"  label="Signes"      focused={focused} /> }} />
      <Tab.Screen name="Fournitures"         component={FournituresScreen}        options={{ title: 'Fournitures',     tabBarIcon: ({ focused }) => <TabItem iconName="package"      label="Fournitures" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ─── Tabs médecin ─────────────────────────────────────────────────────────────

function MedecinTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_NAV_OPTS}>
      <Tab.Screen name="MedecinDashboard"    component={MedecinDashboardScreen}    options={{ title: 'Tableau de bord', tabBarIcon: ({ focused }) => <TabItem iconName="stethoscope" label="Tableau"      focused={focused} /> }} />
      <Tab.Screen name="ConsultationEnCours" component={ConsultationEnCoursScreen} options={{ title: 'Consultation',    tabBarIcon: ({ focused }) => <TabItem iconName="video"        label="Consultation" focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ─── Tabs centre de santé ─────────────────────────────────────────────────────

function CentreTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_NAV_OPTS}>
      <Tab.Screen name="CentreDashboard" component={CentreDashboardScreen} options={{ title: 'Tableau de bord', tabBarIcon: ({ focused }) => <TabItem iconName="home"      label="Tableau"    focused={focused} /> }} />
      <Tab.Screen name="CentrePersonnel" component={PersonnelScreen}       options={{ title: 'Personnel',       tabBarIcon: ({ focused }) => <TabItem iconName="users"     label="Personnel"  focused={focused} /> }} />
      <Tab.Screen name="CentreAdmission" component={AdmissionScreen}       options={{ title: 'Admissions',      tabBarIcon: ({ focused }) => <TabItem iconName="clipboard" label="Admissions" focused={focused} /> }} />
      <Tab.Screen name="CentreRefect"    component={RefectoireScreen}      options={{ title: 'Réfectoire',      tabBarIcon: ({ focused }) => <TabItem iconName="heart"     label="Réfect."    focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ─── Tabs admin ───────────────────────────────────────────────────────────────

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={TAB_NAV_OPTS}>
      <Tab.Screen name="AdminDashboard"   component={AdminDashboardScreen}   options={{ title: 'Admin',     tabBarIcon: ({ focused }) => <TabItem iconName="grid"     label="Dashboard" focused={focused} /> }} />
      <Tab.Screen name="PharmacieAdmin"   component={PharmacieAdminScreen}   options={{ title: 'Pharmacie', tabBarIcon: ({ focused }) => <TabItem iconName="pill"     label="Pharmacie" focused={focused} /> }} />
      <Tab.Screen name="AbonnementsAdmin" component={AbonnementsAdminScreen} options={{ title: 'Mutuelle',  tabBarIcon: ({ focused }) => <TabItem iconName="shield"   label="Mutuelle"  focused={focused} /> }} />
      <Tab.Screen name="UnitesAdmin"      component={UnitesSanitairesScreen} options={{ title: 'Unités',    tabBarIcon: ({ focused }) => <TabItem iconName="building" label="Unités"    focused={focused} /> }} />
    </Tab.Navigator>
  );
}

// ─── Splash ───────────────────────────────────────────────────────────────────

function SplashScreen() {
  return (
    <View style={splashStyles.root}>
      {/* Décors pastels */}
      <View style={splashStyles.blob1} />
      <View style={splashStyles.blob2} />
      <View style={splashStyles.blob3} />
      <View style={splashStyles.logoMark}>
        <Icon name="cross" size={36} color={palette.dark} strokeWidth={2.5} />
      </View>
      <Text style={splashStyles.appName}>SantéDirect</Text>
      <Text style={splashStyles.appSub}>KOLONGONO</Text>
      <ActivityIndicator size="small" color={palette.dark} style={{ marginTop: 48, opacity: 0.4 }} />
    </View>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────

function RootNavigator() {
  const { token, isLoading, user } = useAuth();

  if (isLoading) return <SplashScreen />;

  const RootTabs =
    user?.role === 'auxiliaire'         ? AuxiliaireTabs :
    user?.role === 'medecin'            ? MedecinTabs    :
    user?.role === 'superadmin'         ? AdminTabs       :
    user?.role === 'admin'              ? CentreTabs      :
    user?.role === 'gestionnaire'       ? CentreTabs      :
    user?.role === 'personnel_interne'  ? CentreTabs      :
    user?.role === 'personnel_externe'  ? CentreTabs      :
    user?.role === 'responsable_centre' ? CentreTabs      :
    AdherentTabs;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <>
            <Stack.Screen name="Main" component={RootTabs} />

            {/* ── Adhérent ── */}
            <Stack.Screen name="PreConsultation"    component={PreConsultationScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Pré-consultation' }} />
            <Stack.Screen name="Teleconsultation"
              component={TeleconsultationScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="Dossier"    component={DossierScreen}    options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Dossier médical'   }} />
            <Stack.Screen name="Ordonnance" component={OrdonnanceScreen} options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Mes ordonnances'   }} />
            <Stack.Screen name="Abonnement" component={AbonnementScreen} options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Ma mutuelle'       }} />
            <Stack.Screen name="Profile"    component={ProfileScreen}    options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Mon profil'        }} />

            {/* ── Auxiliaire ── */}
            <Stack.Screen name="SuiviPatient"         component={SuiviPatientScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Suivi patient' }} />

            {/* ── Médecin ── */}
            <Stack.Screen name="ConsultationEnCours"  component={ConsultationEnCoursScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Consultation' }} />
            <Stack.Screen name="OrdonnanceDigitale"   component={OrdonnanceDigitaleScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Ordonnance numérique' }} />

            {/* ── Admin ── */}
            <Stack.Screen name="MedecinsAdmin"   component={MedecinsAdminScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Médecins partenaires' }} />
            <Stack.Screen name="UniteDetail"     component={UniteDetailScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="UniteForm"       component={UnitesSanitairesScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Nouvelle unité' }} />
            <Stack.Screen name="Rapports"        component={RapportsScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Rapports' }} />

            {/* ── QR Scanner (partagé tous rôles) ── */}
            <Stack.Screen name="QRScanner"       component={QRScannerScreen}
              options={{ headerShown: false }} />

            {/* ── Scanner pharmacie — module stock ── */}
            <Stack.Screen name="ScannerStockScreen"      component={ScannerStockScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="MedicamentInconnuScreen" component={MedicamentInconnuScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Nouveau médicament' }} />
            <Stack.Screen name="FormulaireStockScreen"   component={FormulaireStockScreen}
              options={{ ...TAB_SCREEN_OPTS, headerShown: true, title: 'Mouvement de stock' }} />

            {/* ── Triage IA + Prise RDV ── */}
            <Stack.Screen name="Triage"          component={TriageScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="PriseRDV"        component={PriseRDVScreen}
              options={{ headerShown: false }} />
            <Stack.Screen name="ComptePatient"   component={ComptePatientScreen}
              options={{ headerShown: false }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <AuthProvider>
            <RootNavigator />
          </AuthProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  item:        {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical:   10,
    paddingHorizontal: 10,
    borderRadius: radius.full,
    gap: 5,
  },
  itemFocused: {
    backgroundColor: palette.white,
    paddingHorizontal: 16,
    ...shadow.sm,
  },
  label: { fontSize: 12, fontWeight: fontWeight.semibold, color: palette.dark },
});

const plusStyles = StyleSheet.create({
  header: {
    backgroundColor: palette.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    paddingTop: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: palette.blue,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: palette.dark, fontSize: 20, fontWeight: fontWeight.black },
  name:  { fontSize: fontSize.lg, fontWeight: fontWeight.black, color: colors.text },
  role:  { fontSize: fontSize.sm, color: colors.textMuted, marginTop: 2 },
  modules: {
    backgroundColor: palette.white,
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    ...shadow.md,
  },
  row:      { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 14 },
  iconBg:   { width: 42, height: 42, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
  rowLabel: { flex: 1, fontSize: fontSize.md, color: colors.text, fontWeight: fontWeight.medium },
  logout:   { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: colors.dangerLight, borderRadius: radius.xl, padding: spacing.lg, alignItems: 'center' },
  logoutText: { color: colors.danger, fontWeight: fontWeight.bold, fontSize: fontSize.md },
  version:  { textAlign: 'center', color: colors.textLight, fontSize: fontSize.xs, marginTop: spacing.lg },
  // Compat
  decor1:  {},
  decor2:  {},
});

const splashStyles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: palette.gray50, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  blob1:   { position: 'absolute', width: 320, height: 320, borderRadius: 160, backgroundColor: palette.blue,   opacity: 0.35, top: -120, right: -80  },
  blob2:   { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: palette.purple, opacity: 0.25, bottom: -60, left: -60  },
  blob3:   { position: 'absolute', width: 160, height: 160, borderRadius: 80,  backgroundColor: palette.green,  opacity: 0.30, top: '35%', left: -40   },
  logoMark:{ width: 88, height: 88, borderRadius: 28, backgroundColor: palette.white, justifyContent: 'center', alignItems: 'center', marginBottom: 24, ...shadow.lg },
  appName: { color: palette.dark, fontSize: 34, fontWeight: fontWeight.black, letterSpacing: 1 },
  appSub:  { color: colors.textMuted, fontSize: fontSize.sm, letterSpacing: 4, marginTop: 4 },
});
