import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { BrandLogo } from './BrandLogo';
import { useAttendance } from '../context/AttendanceContext';
import { verifyPin } from '../db/database';
import {
  BRAND_COLORS,
  FONT_FAMILIES,
  HEADING_STYLE,
  SEMANTIC_COLORS,
  TABULAR_NUMS,
} from '../theme/tokens';
import { AmbientCanvas } from './AmbientCanvas';

const MAX_ATTEMPTS = 5;
const BASE_COOLDOWN_SECONDS = 30;
const MAX_COOLDOWN_SECONDS = 900;

export function PinLockScreen() {
  const { palette, settings, unlockApp } = useAttendance();
  const [digits, setDigits] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutStage, setLockoutStage] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (cooldownLeft <= 0) return;
    const id = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          setErrorMsg('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownLeft]);

  const handleDigit = async (digit: string) => {
    if (cooldownLeft > 0 || digits.length >= 4) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = digits + digit;
    setDigits(next);
    setErrorMsg('');

    if (next.length === 4) {
      const valid = await verifyPin(next, settings.pinHash);
      if (valid) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setLockoutStage(0);
        setFailedAttempts(0);
        unlockApp();
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        const nextFails = failedAttempts + 1;
        setFailedAttempts(nextFails);
        setDigits('');
        if (nextFails >= MAX_ATTEMPTS) {
          const waitSec = Math.min(
            MAX_COOLDOWN_SECONDS,
            BASE_COOLDOWN_SECONDS * Math.pow(2, lockoutStage)
          );
          setLockoutStage((s) => s + 1);
          setCooldownLeft(waitSec);
          setErrorMsg(`Too many failed attempts. Locked for ${waitSec}s.`);
        } else {
          setErrorMsg(`Incorrect PIN (${nextFails}/${MAX_ATTEMPTS})`);
        }
      }
    }
  };

  const handleBackspace = async () => {
    if (cooldownLeft > 0 || digits.length === 0) return;
    await Haptics.selectionAsync();
    setDigits((prev) => prev.slice(0, -1));
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

  return (
    <AmbientCanvas tone="healthy">
      <SafeAreaView style={styles.container}>
      <View style={styles.top}>
        <BrandLogo size={56} />
        <Text
          style={[
            styles.title,
            HEADING_STYLE,
            { color: palette.textPrimary, fontFamily: FONT_FAMILIES.sansBold },
          ]}
        >
          AttendUp is locked
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: palette.textSecondary, fontFamily: FONT_FAMILIES.sansMedium },
          ]}
        >
          Enter your 4-digit PIN to continue
        </Text>

        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < digits.length;
            return (
              <View
                key={idx}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor: filled
                      ? BRAND_COLORS.emeraldText
                      : palette.control,
                    borderColor: filled ? BRAND_COLORS.emeraldText : palette.border,
                  },
                ]}
              />
            );
          })}
        </View>

        <View style={styles.errorWrap}>
          {cooldownLeft > 0 ? (
            <Text style={[styles.errorText, TABULAR_NUMS]}>
              Locked for {cooldownLeft}s due to failed attempts
            </Text>
          ) : errorMsg ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.keypad}>
        {keys.map((k, idx) => {
          if (k === '') {
            return <View key={`empty-${idx}`} style={styles.keySpacer} />;
          }
          if (k === 'del') {
            return (
              <Pressable
                key="del"
                onPress={handleBackspace}
                disabled={cooldownLeft > 0}
                style={[
                  styles.keyBtn,
                  { backgroundColor: palette.control, borderColor: palette.border },
                ]}
              >
                <Delete size={22} color={palette.textPrimary} />
              </Pressable>
            );
          }
          return (
            <Pressable
              key={k}
              onPress={() => handleDigit(k)}
              disabled={cooldownLeft > 0}
              style={[
                styles.keyBtn,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border,
                  opacity: cooldownLeft > 0 ? 0.45 : 1,
                },
              ]}
            >
              <Text style={[styles.keyText, TABULAR_NUMS, { color: palette.textPrimary }]}>
                {k}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
    </AmbientCanvas>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  top: {
    alignItems: 'center',
    marginTop: 28,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 28,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  errorWrap: {
    minHeight: 28,
    marginTop: 18,
    justifyContent: 'center',
  },
  errorText: {
    color: SEMANTIC_COLORS.absent,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_FAMILIES.sansSemiBold,
    textAlign: 'center',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    maxWidth: 300,
    alignSelf: 'center',
    marginBottom: 16,
  },
  keySpacer: {
    width: 82,
    height: 62,
  },
  keyBtn: {
    width: 82,
    height: 62,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    fontSize: 24,
    fontWeight: '600',
  },
});
