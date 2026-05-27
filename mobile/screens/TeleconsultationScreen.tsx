import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  ActivityIndicator, Platform, StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing, radius, fontSize, fontWeight, palette } from '../components/theme';
import { Icon } from '../components/Icons';
import { api } from '../components/api';
import { useAuth } from '../components/AuthContext';

// Paramètres acceptés :
//   Nouveau flux (PriseRDVScreen) : { rdv_id, url, medecin, role? }
//   Ancien flux (direct)          : { lien, role, nomSalle }
type Props = {
  route: {
    params: {
      rdv_id?: string;
      url?: string;
      lien?: string;
      medecin?: string;
      role?: 'patient' | 'auxiliaire' | 'medecin';
      nomSalle?: string;
    };
  };
  navigation: any;
};

type Phase = 'attente' | 'en_cours' | 'termine';

const POLL_INTERVAL_MS = 10_000;

export default function TeleconsultationScreen({ route, navigation }: Props) {
  const { rdv_id, url, lien, medecin, role = 'patient', nomSalle } = route.params;
  const { token } = useAuth();

  const lienFinal  = url ?? lien ?? '';
  const salleName  = nomSalle ?? (medecin ? `Consultation · ${medecin}` : 'Consultation vidéo');
  const roleLabel  = role === 'medecin' ? 'Médecin' : role === 'auxiliaire' ? 'Auxiliaire' : 'Patient';

  const [phase, setPhase]         = useState<Phase>(rdv_id ? 'attente' : 'en_cours');
  const [tentatives, setTentatives] = useState(0);
  const [webLoading, setWebLoading] = useState(true);
  const [erreur, setErreur]         = useState(false);
  const webViewRef = useRef<WebView>(null);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Polling statut RDV ────────────────────────────────────────────────────

  const pollStatut = useCallback(async () => {
    if (!rdv_id || !token) return;
    try {
      const d = await api.get<{ statut: string }>(`/api/consultations/rdv/${rdv_id}`, token);
      const s = (d as any).statut ?? (d as any).rendez_vous?.statut ?? '';
      if (s === 'en_cours') {
        setPhase('en_cours');
        if (timerRef.current) clearInterval(timerRef.current);
      } else if (s === 'termine' || s === 'annule') {
        setPhase('termine');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    } catch (_) {}
    setTentatives(n => n + 1);
  }, [rdv_id, token]);

  useEffect(() => {
    if (phase !== 'attente') return;
    pollStatut(); // immédiat
    timerRef.current = setInterval(pollStatut, POLL_INTERVAL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, pollStatut]);

  // ── Rejoindre manuellement ────────────────────────────────────────────────

  function rejoindreQuandMeme() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('en_cours');
  }

  // ── Terminer ──────────────────────────────────────────────────────────────

  function terminerConsultation() {
    Alert.alert(
      'Terminer la consultation',
      'Êtes-vous sûr de vouloir quitter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Terminer',
          style: 'destructive',
          onPress: () => {
            if (timerRef.current) clearInterval(timerRef.current);
            webViewRef.current?.injectJavaScript(`
              try { APP.conference.hangup(); } catch(e) {}
            `);
            navigation.goBack();
          },
        },
      ],
    );
  }

  // ── JS injecté dans la WebView Jitsi ─────────────────────────────────────

  const injectedJS = `
    (function() {
      var tries = 0;
      var iv = setInterval(function() {
        tries++;
        if (tries > 40) { clearInterval(iv); return; }
        [
          '[aria-label="More options"]',
          '.toolbox-button[aria-label="Start recording"]',
          '.toolbox-button[aria-label="Reactions"]',
          '.watermark',
        ].forEach(function(s) {
          var el = document.querySelector(s);
          if (el) el.style.display = 'none';
        });
        if (document.querySelector('.toolbox-content-wrapper')) clearInterval(iv);
      }, 500);
      true;
    })();
  `;

  // ── PHASE : SALLE D'ATTENTE ───────────────────────────────────────────────

  if (phase === 'attente') {
    const minutesEcoules = Math.floor((tentatives * POLL_INTERVAL_MS) / 60000);
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0A1A2E" />
        <View style={styles.attenteContainer}>
          <View style={styles.attenteAnim}>
            <ActivityIndicator size="large" color={palette.blue} />
          </View>
          <Text style={styles.attenteTitle}>Salle d'attente</Text>
          <Text style={styles.attenteSub}>{salleName}</Text>
          <Text style={styles.attenteInfo}>
            En attente du médecin…{'\n'}Vous serez connecté automatiquement dès qu'il rejoindra.
          </Text>
          {minutesEcoules > 0 && (
            <Text style={styles.attenteTimer}>
              Attente : {minutesEcoules} min
            </Text>
          )}
          <View style={styles.attentePulse}>
            <View style={[styles.attenteDot, styles.attenteDot1]} />
            <View style={[styles.attenteDot, styles.attenteDot2]} />
            <View style={[styles.attenteDot, styles.attenteDot3]} />
          </View>
          <TouchableOpacity style={styles.rejoindreDirect} onPress={rejoindreQuandMeme} activeOpacity={0.8}>
            <Text style={styles.rejoindreDirectText}>Rejoindre maintenant →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quitterAttente} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={styles.quitterAttenteText}>Quitter la salle d'attente</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PHASE : CONSULTATION TERMINÉE ─────────────────────────────────────────

  if (phase === 'termine') {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0A1A2E" />
        <View style={styles.attenteContainer}>
          <Icon name="check-circle" size={64} color={palette.green} strokeWidth={1.5} />
          <Text style={styles.attenteTitle}>Consultation terminée</Text>
          <Text style={styles.attenteInfo}>
            La consultation a été clôturée par le médecin.{'\n'}
            Votre ordonnance sera disponible dans votre dossier.
          </Text>
          <TouchableOpacity style={styles.rejoindreDirect} onPress={() => navigation.popToTop()} activeOpacity={0.8}>
            <Text style={styles.rejoindreDirectText}>Retour à l'accueil</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── PHASE : CONSULTATION EN COURS ─────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>EN DIRECT</Text>
          </View>
          <Text style={styles.topBarTitle} numberOfLines={1}>{salleName}</Text>
        </View>
        <View style={styles.topBarRight}>
          <Text style={styles.roleChip}>{roleLabel}</Text>
          <TouchableOpacity style={styles.endBtn} onPress={terminerConsultation}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name="phone-off" size={14} color="#fff" />
              <Text style={styles.endBtnText}>Fin</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {webLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Connexion à la consultation vidéo…</Text>
          <Text style={styles.loadingSubtext}>Jitsi Meet · Chiffrement de bout en bout</Text>
        </View>
      )}

      {erreur && (
        <View style={styles.erreurView}>
          <Icon name="video-off" size={48} color={colors.textLight} strokeWidth={1.2} />
          <Text style={styles.erreurTitle}>Connexion impossible</Text>
          <Text style={styles.erreurText}>
            Vérifiez la connexion internet.{'\n'}Le médecin et l'auxiliaire doivent être connectés.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setErreur(false); setWebLoading(true); webViewRef.current?.reload(); }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="refresh" size={14} color="#fff" />
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: spacing.md }}>
            <Text style={[styles.retryBtnText, { color: colors.textMuted }]}>← Retour</Text>
          </TouchableOpacity>
        </View>
      )}

      {!erreur && (
        <WebView
          ref={webViewRef}
          source={{ uri: lienFinal }}
          style={styles.webview}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsFullscreenVideo={true}
          originWhitelist={['https://*', 'http://*']}
          injectedJavaScript={injectedJS}
          onLoadStart={() => setWebLoading(true)}
          onLoadEnd={() => setWebLoading(false)}
          onError={() => { setWebLoading(false); setErreur(true); }}
          onHttpError={(e) => { if (e.nativeEvent.statusCode >= 500) { setWebLoading(false); setErreur(true); } }}
          mediaCapturePermissionGrantType="grant"
        />
      )}

      <View style={styles.bottomBar}>
        <Text style={styles.bottomText}>🔒 Consultation chiffrée · Jitsi Meet</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // ── Salle d'attente ──
  attenteContainer: {
    flex: 1, backgroundColor: '#0A1A2E',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.md,
  },
  attenteAnim:  { marginBottom: spacing.sm },
  attenteTitle: { color: '#fff', fontSize: fontSize.xxl, fontWeight: fontWeight.black, textAlign: 'center' },
  attenteSub:   { color: 'rgba(255,255,255,.55)', fontSize: fontSize.sm, textAlign: 'center' },
  attenteInfo:  { color: 'rgba(255,255,255,.4)', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginTop: spacing.xs },
  attenteTimer: { color: palette.blue, fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  attentePulse: { flexDirection: 'row', gap: 8, marginVertical: spacing.lg },
  attenteDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.blue, opacity: 0.4 },
  attenteDot1:  { opacity: 1 },
  attenteDot2:  { opacity: 0.6 },
  attenteDot3:  { opacity: 0.3 },
  rejoindreDirect: {
    backgroundColor: palette.blue, borderRadius: radius.full,
    paddingHorizontal: spacing.xl, paddingVertical: 14,
    marginTop: spacing.sm,
  },
  rejoindreDirectText: { color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.black },
  quitterAttente:      { paddingVertical: spacing.sm },
  quitterAttenteText:  { color: 'rgba(255,255,255,.3)', fontSize: fontSize.sm },

  // ── TopBar ──
  topBar: {
    backgroundColor: colors.primaryDark,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, paddingTop: spacing.xl,
  },
  topBarLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  liveDot:     { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText:    { color: '#fff', fontSize: 10, fontWeight: fontWeight.black },
  topBarTitle: { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.bold, flex: 1 },
  roleChip:    { backgroundColor: 'rgba(255,255,255,.15)', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 3, color: '#fff', fontSize: fontSize.xs, fontWeight: fontWeight.bold },
  endBtn:      { backgroundColor: colors.danger, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: 6 },
  endBtnText:  { color: '#fff', fontSize: fontSize.sm, fontWeight: fontWeight.black },

  webview: { flex: 1 },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1A0A',
    justifyContent: 'center', alignItems: 'center',
    gap: spacing.md, zIndex: 10,
  },
  loadingText:    { color: '#fff', fontSize: fontSize.lg, fontWeight: fontWeight.bold, marginTop: spacing.md },
  loadingSubtext: { color: 'rgba(255,255,255,.4)', fontSize: fontSize.xs },

  erreurView: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0A1A0A',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: spacing.xl, gap: spacing.md, zIndex: 10,
  },
  erreurTitle: { color: '#fff', fontSize: fontSize.xl, fontWeight: fontWeight.black },
  erreurText:  { color: 'rgba(255,255,255,.5)', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
  retryBtn:    { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, marginTop: spacing.sm },
  retryBtnText:{ color: '#fff', fontSize: fontSize.md, fontWeight: fontWeight.black },

  bottomBar: { backgroundColor: 'rgba(0,0,0,.8)', paddingVertical: spacing.xs, alignItems: 'center' },
  bottomText: { color: 'rgba(255,255,255,.3)', fontSize: fontSize.xs },
});
