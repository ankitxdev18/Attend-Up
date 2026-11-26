import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Download } from 'lucide-react-native';
import { useAttendance } from '../context/AttendanceContext';
import {
  dismissUpdateVersion,
  downloadAndInstallApk,
  type UpdateInfo,
} from '../lib/appUpdater';
import {
  FONT_FAMILIES,
  HEADING_STYLE,
  TABULAR_NUMS,
  UI_METRICS,
} from '../theme/tokens';
import { BrandLogo } from './BrandLogo';
import { TactilePressable } from './TactilePressable';

interface UpdateModalProps {
  updateInfo: UpdateInfo | null;
  onClose: () => void;
}

export function UpdateModal({ updateInfo, onClose }: UpdateModalProps) {
  const { palette, activeAccent, isDark, showToast } = useAttendance();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!updateInfo) return null;

  const handleUpdateNow = async () => {
    if (downloading) return;
    setDownloading(true);
    setProgress(0);
    try {
      await downloadAndInstallApk(updateInfo.downloadUrl, (pct) => {
        setProgress(pct);
      });
    } catch {
      showToast('Unable to start update download.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleLater = async () => {
    if (downloading) return;
    await dismissUpdateVersion(updateInfo.latestVersion);
    onClose();
  };

  return (
    <Modal
      visible={Boolean(updateInfo)}
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? '#0E1014' : palette.sheet,
              borderColor: palette.border,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <BrandLogo size={44} accentColor={activeAccent.primary} />
            <View style={styles.headerTextCol}>
              <Text
                style={[
                  styles.title,
                  HEADING_STYLE,
                  { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                Update Available
              </Text>
              <View
                style={[
                  styles.versionBadge,
                  {
                    backgroundColor: activeAccent.tintBg,
                    borderColor: activeAccent.borderTint,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.versionBadgeText,
                    TABULAR_NUMS,
                    {
                      color: activeAccent.bright,
                      fontFamily: FONT_FAMILIES.monoBold,
                    },
                  ]}
                >
                  v{updateInfo.currentVersion} → v{updateInfo.latestVersion}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            style={[
              styles.notesBox,
              { backgroundColor: palette.control, borderColor: palette.border },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.notesText,
                {
                  color: palette.textSecondary,
                  fontFamily: FONT_FAMILIES.sansRegular,
                },
              ]}
            >
              {updateInfo.releaseNotes}
            </Text>
          </ScrollView>

          {downloading ? (
            <View style={styles.progressWrap}>
              <View style={styles.progressLabelRow}>
                <Text
                  style={[
                    styles.progressLabel,
                    {
                      color: palette.textSecondary,
                      fontFamily: FONT_FAMILIES.sansSemiBold,
                    },
                  ]}
                >
                  Downloading APK...
                </Text>
                <Text
                  style={[
                    styles.progressPct,
                    TABULAR_NUMS,
                    {
                      color: activeAccent.bright,
                      fontFamily: FONT_FAMILIES.monoBold,
                    },
                  ]}
                >
                  {progress}%
                </Text>
              </View>
              <View
                style={[styles.progressTrack, { backgroundColor: palette.control }]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: activeAccent.primary,
                      width: `${progress}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              onPress={handleLater}
              disabled={downloading}
              style={[
                styles.laterBtn,
                {
                  backgroundColor: palette.control,
                  borderColor: palette.border,
                  opacity: downloading ? 0.5 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.laterText,
                  {
                    color: palette.textPrimary,
                    fontFamily: FONT_FAMILIES.sansSemiBold,
                  },
                ]}
              >
                Later
              </Text>
            </Pressable>

            <TactilePressable
              onPress={handleUpdateNow}
              disabled={downloading}
              style={[
                styles.updateBtn,
                {
                  backgroundColor: activeAccent.primary,
                  opacity: downloading ? 0.75 : 1,
                },
              ]}
            >
              <Download size={16} color="#050608" />
              <Text
                style={[
                  styles.updateText,
                  { color: '#050608', fontFamily: FONT_FAMILIES.sansBold },
                ]}
              >
                {downloading ? `${progress}%` : 'Update Now'}
              </Text>
            </TactilePressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 26,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  headerTextCol: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
  },
  versionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  versionBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  notesBox: {
    maxHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  notesText: {
    fontSize: 13,
    lineHeight: 19,
  },
  progressWrap: {
    gap: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 12.5,
  },
  progressPct: {
    fontSize: 12.5,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  laterBtn: {
    flex: 1,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  updateBtn: {
    flex: 1.4,
    height: UI_METRICS.buttonHeight,
    borderRadius: UI_METRICS.radiusMd,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  updateText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
