import fs from 'node:fs';
import path from 'node:path';

const androidDir = path.resolve(process.cwd(), 'android');
const proguardPath = path.join(androidDir, 'app', 'proguard-rules.pro');

const KEEP_MARKER = '# AttendUp Release Keep Rules';
const KEEP_RULES = `
${KEEP_MARKER}
-keep class com.reactnativeandroidwidget.** { *; }
-keep class expo.modules.** { *; }
-keep class com.swmansion.reanimated.** { *; }
-dontwarn com.reactnativeandroidwidget.**
-dontwarn com.swmansion.reanimated.**
`;

if (fs.existsSync(proguardPath)) {
  const existing = fs.readFileSync(proguardPath, 'utf8');
  if (!existing.includes(KEEP_MARKER)) {
    fs.writeFileSync(proguardPath, `${existing.trimEnd()}\n${KEEP_RULES}`, 'utf8');
    console.log('Appended AttendUp ProGuard keep rules to android/app/proguard-rules.pro');
  } else {
    console.log('AttendUp ProGuard keep rules already present.');
  }
} else {
  console.warn('Warning: android/app/proguard-rules.pro not found.');
}
