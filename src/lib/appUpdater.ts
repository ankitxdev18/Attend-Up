import { Linking, Platform } from 'react-native';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Notifications from 'expo-notifications';
import { getAppSettings, updateAppSettings } from '../db/database';

export const GITHUB_LATEST_RELEASE_API =
  'https://api.github.com/repos/ankitxdev18/Attend-Up/releases/latest';
export const LATEST_RELEASES_PAGE =
  'https://github.com/ankitxdev18/Attend-Up/releases/latest';

const AUTO_CHECK_INTERVAL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6000;

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  htmlUrl: string;
  hasApkAsset: boolean;
  isDismissed?: boolean;
}

interface GitHubAsset {
  name?: string;
  browser_download_url?: string;
}

interface GitHubReleaseResponse {
  tag_name?: string;
  body?: string;
  html_url?: string;
  assets?: GitHubAsset[];
}

export function isExpoGoRuntime(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function getInstalledVersion(): string {
  const raw =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    '1.0.1';
  return raw.replace(/^v/i, '').trim() || '1.0.1';
}

function parseSemver(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/i, '').split('-')[0] ?? '0.0.0';
  const parts = cleaned.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function isNewerVersion(remote: string, current: string): boolean {
  const [rMaj, rMin, rPat] = parseSemver(remote);
  const [cMaj, cMin, cPat] = parseSemver(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

/**
 * Checks GitHub Releases for a newer AttendUp version.
 * Fails silently when offline or timed out so offline usage is never disrupted.
 */
export async function checkForAppUpdate(options?: {
  force?: boolean;
}): Promise<UpdateInfo | null> {
  const force = Boolean(options?.force);

  if (!force && isExpoGoRuntime()) {
    return null;
  }

  try {
    const settings = await getAppSettings();
    if (!force && Date.now() - settings.lastUpdateCheckAt < AUTO_CHECK_INTERVAL_MS) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(GITHUB_LATEST_RELEASE_API, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    await updateAppSettings({ lastUpdateCheckAt: Date.now() }).catch(() => {});

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubReleaseResponse;
    const tagRaw = data.tag_name ?? '';
    const latestVersion = tagRaw.replace(/^v/i, '').trim();
    if (!latestVersion) {
      return null;
    }

    const currentVersion = getInstalledVersion();
    if (!isNewerVersion(latestVersion, currentVersion)) {
      return null;
    }

    const isDismissed = !force && settings.dismissedVersion === latestVersion;

    if (settings.notifiedUpdateVersion !== latestVersion && !isExpoGoRuntime()) {
      await updateAppSettings({ notifiedUpdateVersion: latestVersion }).catch(() => {});
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'AttendUp Update Available',
            body: `Version v${latestVersion} is ready with new improvements. Tap to update.`,
            data: { type: 'app_update', version: latestVersion },
            sound: true,
          },
          trigger: null,
        });
      } catch {
        // Ignore notification errors when permissions are denied or unsupported.
      }
    }

    const assets = Array.isArray(data.assets) ? data.assets : [];
    const apkAsset = assets.find(
      (a) =>
        typeof a.name === 'string' &&
        a.name.toLowerCase().endsWith('.apk') &&
        typeof a.browser_download_url === 'string'
    );

    const htmlUrl = data.html_url || LATEST_RELEASES_PAGE;
    const downloadUrl = apkAsset?.browser_download_url || htmlUrl;

    return {
      currentVersion,
      latestVersion,
      releaseNotes:
        (data.body ?? '').trim() ||
        'Performance improvements, stability fixes, and latest features.',
      downloadUrl,
      htmlUrl,
      hasApkAsset: Boolean(apkAsset?.browser_download_url),
      isDismissed,
    };
  } catch {
    return null;
  }
}

export async function dismissUpdateVersion(version: string): Promise<void> {
  await updateAppSettings({ dismissedVersion: version }).catch(() => {});
}

/**
 * Downloads the APK to cache while reporting 0..100 progress and launches
 * the Android package installer, falling back to browser URL if needed.
 */
export async function downloadAndInstallApk(
  apkUrl: string,
  onProgress?: (percent: number) => void
): Promise<void> {
  if (Platform.OS !== 'android' || !apkUrl.toLowerCase().endsWith('.apk')) {
    await Linking.openURL(apkUrl);
    return;
  }

  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      await Linking.openURL(apkUrl);
      return;
    }

    const targetUri = `${cacheDir}AttendUp-update.apk`;
    const downloadResumable = FileSystem.createDownloadResumable(
      apkUrl,
      targetUri,
      {},
      (progressData) => {
        if (progressData.totalBytesExpectedToWrite > 0 && onProgress) {
          const pct = Math.min(
            100,
            Math.max(
              0,
              Math.round(
                (progressData.totalBytesWritten /
                  progressData.totalBytesExpectedToWrite) *
                  100
              )
            )
          );
          onProgress(pct);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      await Linking.openURL(apkUrl);
      return;
    }

    onProgress?.(100);
    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } catch {
    await Linking.openURL(apkUrl).catch(() => {});
  }
}
