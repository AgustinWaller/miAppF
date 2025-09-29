// Simple postinstall patch to fix nullability in RNGH for RN 0.76
const fs = require('fs');
const path = require('path');

function main() {
  const target = path.join(
    process.cwd(),
    'node_modules',
    'react-native-gesture-handler',
    'android',
    'src',
    'main',
    'java',
    'com',
    'swmansion',
    'gesturehandler',
    'react',
    'RNGestureHandlerTouchEvent.kt'
  );

  if (!fs.existsSync(target)) {
    console.log('[patch-rngh] Target file not found, skipping:', target);
    return;
  }

  const original = fs.readFileSync(target, 'utf8');

  // If already patched, skip
  if (original.includes('val view = handler.view!!') && original.includes('getSurfaceId(view), view.id')) {
    console.log('[patch-rngh] Already patched.');
    return;
  }

  const search = 'super.init(UIManagerHelper.getSurfaceId(handler.view), handler.view!!.id)';
  if (!original.includes(search)) {
    console.log('[patch-rngh] Expected pattern not found; leaving file unchanged.');
    return;
  }

  const replacement = 'val view = handler.view!!\n    super.init(UIManagerHelper.getSurfaceId(view), view.id)';
  const updated = original.replace(search, replacement);
  fs.writeFileSync(target, updated);
  console.log('[patch-rngh] Patched successfully.');
}

try {
  main();
} catch (e) {
  console.log('[patch-rngh] Error applying patch:', e?.message || e);
}

