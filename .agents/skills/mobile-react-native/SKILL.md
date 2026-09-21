---
name: mobile-react-native
description: >-
  Guidelines and best practices for building the cross-platform mobile application
  using React Native, Expo, TypeScript strict mode, camera scanner integration,
  responsive UI components, state management, and offline cache hooks.
---

# Mobile Application: React Native + Expo Guidelines

## 1. Architecture & Technology Stack
- **Framework**: React Native with Expo (Managed Workflow or EAS Prebuild).
- **Language**: TypeScript (Strict Mode enabled: `noImplicitAny: true`, `strictNullChecks: true`).
- **Navigation**: React Navigation (Bottom Tabs for primary modules + Native Stack for modal/flow navigation).
- **State Management & Caching**: Zustand / Redux Toolkit + TanStack Query (React Query) for server state caching.
- **Local Secure Storage**: `expo-secure-store` for JWT auth tokens; `AsyncStorage` / SQLite for offline cache.
- **Hardware Integration**: `expo-camera` / `react-native-vision-camera` for QR scanning, `expo-sharing` & `expo-print` for invoice PDFs.

---

## 2. Navigation & Screen Hierarchy

```text
RootNavigator (Native Stack)
├── AuthStack
│   ├── LoginScreen
│   ├── BusinessSelectScreen
│   └── ForgotPasswordScreen
└── MainTabNavigator (Bottom Tabs)
    ├── HomeScreen (Dashboard, Key Metrics, Quick Actions)
    ├── TransactionsScreen (All Bills, Purchases, Payments, Filters)
    ├── QuickActionModal (+ New Sale, + Purchase, + Expense, + Payment)
    ├── ItemsScreen (Catalog, Stock Status, QR Label Export)
    ├── ReportsScreen (Sales, P&L, Stock Summary, Party Statements)
    └── SettingsScreen (Business Profile, Users, Tax Config, Logout)
```

---

## 3. Mobile UX Standards & Performance Rules

### 3.1. Tap Targets & Numeric Entry
- Interactive elements (buttons, list rows, icon triggers) must have a minimum hit area of **48x48 dp**.
- Use `keyboardType="numeric"` or `keyboardType="decimal-pad"` on all quantity, price, and tax input fields.
- Wrap form views with `KeyboardAvoidingView` or `react-native-keyboard-aware-scroll-view` to prevent active inputs from being occluded.

### 3.2. State Handling Invariants
Every data-driven screen must explicitly handle 4 distinct UI states:
1. **Loading State**: Render skeleton placeholders rather than generic full-screen spinners.
2. **Success / Content State**: Clean list or card layout with pull-to-refresh (`RefreshControl`).
3. **Empty State**: Actionable illustration/icon with a primary CTA button (e.g., "No items found. Tap 'Add Item' to create one").
4. **Error State**: User-friendly message with a "Retry" button; never display raw technical stack traces to the user.

---

## 4. Camera & QR Integration Patterns

```typescript
import React, { useState } from 'react';
import { StyleSheet, View, Text, Vibration } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

interface QRScanHandlerProps {
  onItemScanned: (publicItemId: string) => void;
  onClose: () => void;
}

export const BillingQRScanner: React.FC<QRScanHandlerProps> = ({ onItemScanned, onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningLocked, setIsScanningLocked] = useState(false);

  if (!permission) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Camera access is required to scan item QR codes.</Text>
      </View>
    );
  }

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (isScanningLocked) return;

    if (data.startsWith('ITEM:')) {
      const publicItemId = data.replace('ITEM:', '').trim();
      setIsScanningLocked(true);
      Vibration.vibrate(100);
      onItemScanned(publicItemId);
      
      // Throttle rapid duplicate scans
      setTimeout(() => setIsScanningLocked(false), 1200);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  errorText: { color: '#fff', fontSize: 16, textAlign: 'center', marginHorizontal: 24 },
});
```

---

## 5. Token Storage & API Authentication
- Store JWT Access Token and Refresh Token exclusively in `expo-secure-store`.
- Configure an Axios / fetch interceptor to attach `Authorization: Bearer <token>` to outbound requests.
- Implement silent 401 refresh: If an access token expires, automatically request a refreshed token via `/auth/refresh` before failing user requests.

---

## 6. Verification Checklist
- [ ] TypeScript compiles cleanly with zero `any` suppressions in critical business flows.
- [ ] Camera permissions handle "denied", "granted", and "prompt" gracefully.
- [ ] Pull-to-refresh functions on all list screens.
- [ ] Safe area insets (`react-native-safe-area-context`) respected on iPhone notch/Android status bar.
- [ ] Offline indicator displays when network connectivity drops (`@react-native-community/netinfo`).
