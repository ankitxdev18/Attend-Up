import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  DevSettings,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, RefreshCw, ShieldAlert } from 'lucide-react-native';
import {
  getAllRecords,
  getAllSubjects,
  getAppSettings,
  initDatabase,
} from '../db/database';
import { exportJsonBackup } from '../lib/reports';
import { BRAND_COLORS, FONT_FAMILIES, SEMANTIC_COLORS } from '../theme/tokens';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: number;
  exporting: boolean;
  exportFeedback: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
    resetKey: 0,
    exporting: false,
    exportFeedback: '',
  };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AttendUp ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState((prev) => ({
      error: null,
      resetKey: prev.resetKey + 1,
      exportFeedback: '',
    }));
    try {
      if (typeof DevSettings?.reload === 'function') {
        DevSettings.reload();
      }
    } catch {
      // Fallback resetKey remount already recovers the React tree cleanly.
    }
  };

  private handleEmergencyBackup = async () => {
    if (this.state.exporting) return;
    this.setState({ exporting: true, exportFeedback: '' });
    try {
      await initDatabase();
      const [subjects, records, settings] = await Promise.all([
        getAllSubjects(),
        getAllRecords(),
        getAppSettings(),
      ]);
      await exportJsonBackup({ subjects, records, settings });
      this.setState({
        exportFeedback: 'Emergency backup exported successfully.',
      });
    } catch (err) {
      console.error('[AttendUp EmergencyBackup]', err);
      this.setState({
        exportFeedback: 'Could not export backup. Try reloading the app first.',
      });
    } finally {
      this.setState({ exporting: false });
    }
  };

  render() {
    const { error, resetKey, exporting, exportFeedback } = this.state;

    if (!error) {
      return <React.Fragment key={resetKey}>{this.props.children}</React.Fragment>;
    }

    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <ShieldAlert size={24} color={SEMANTIC_COLORS.absent} />
            </View>

            <Text style={styles.title}>AttendUp hit an unexpected error</Text>
            <Text style={styles.subtitle}>
              Your offline SQLite attendance database is safe. Reload the app or
              export an emergency JSON backup right now.
            </Text>

            <View style={styles.errorBox}>
              <Text numberOfLines={4} style={styles.errorDetail}>
                {error.message || 'Unknown rendering error'}
              </Text>
            </View>

            <Pressable onPress={this.handleReload} style={styles.primaryBtn}>
              <RefreshCw size={17} color="#050608" strokeWidth={2.2} />
              <Text style={styles.primaryBtnText}>Reload App</Text>
            </Pressable>

            <Pressable
              onPress={this.handleEmergencyBackup}
              disabled={exporting}
              style={[styles.secondaryBtn, { opacity: exporting ? 0.6 : 1 }]}
            >
              <Download size={17} color="#F8FAFC" strokeWidth={1.8} />
              <Text style={styles.secondaryBtnText}>
                {exporting
                  ? 'Preparing backup...'
                  : 'Export Emergency JSON Backup'}
              </Text>
            </Pressable>

            {exportFeedback ? (
              <Text style={styles.feedbackText}>{exportFeedback}</Text>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050608',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: '#101215',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 22,
    alignItems: 'center',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BRAND_COLORS.iconBadgeBg,
    borderWidth: 1,
    borderColor: 'rgba(251, 113, 133, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 19,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.sansBold,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FONT_FAMILIES.sansRegular,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#181A1F',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 12,
    marginBottom: 16,
  },
  errorDetail: {
    color: SEMANTIC_COLORS.absent,
    fontSize: 12,
    lineHeight: 17,
    fontFamily: FONT_FAMILIES.monoMedium,
  },
  primaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: BRAND_COLORS.emerald,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: '#050608',
    fontSize: 14.5,
    fontWeight: '700',
    fontFamily: FONT_FAMILIES.sansBold,
  },
  secondaryBtn: {
    width: '100%',
    height: 48,
    borderRadius: 14,
    backgroundColor: '#181A1F',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: FONT_FAMILIES.sansSemiBold,
  },
  feedbackText: {
    color: BRAND_COLORS.emeraldText,
    fontSize: 12.5,
    fontFamily: FONT_FAMILIES.sansMedium,
    marginTop: 12,
    textAlign: 'center',
  },
});
