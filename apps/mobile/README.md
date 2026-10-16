# 📱 QuickBill Mobile Application (`apps/mobile`)

> **Cross-platform Mobile POS Billing, Inventory Scanning, and Khata Management application built with React Native and Expo.**

---

## 📌 Overview & Mobile Features

The QuickBill mobile app brings full store management capabilities to Android and iOS smartphones and tablets:
- 📷 **Integrated Camera Scanner**: Scan product barcodes or QR codes (`ITEM:<publicItemId>`) directly using the device camera.
- ⚡ **Mobile Fast Checkout**: Rapid mobile billing, discounts, tax-inclusive calculations, and payment collection.
- 📶 **Offline-Resilient Caching**: Local caching of product catalogs, customers, and pending transactions with background sync.
- 📲 **Native Share Sheet**: One-tap digital receipt sharing directly via WhatsApp, SMS, and Email.
- 🏪 **Location Switching**: Seamless multi-branch location switching from mobile devices.

---

## 📁 Source Code Structure

```text
apps/mobile/
├── src/
│   ├── components/         # Mobile UI components (Cards, Inputs, Buttons, Modals, Camera)
│   ├── screens/            # Screen views:
│   │   ├── LoginScreen.tsx            # Tenant authentication & server URL config
│   │   ├── HomeScreen.tsx             # Dashboard, KPI metrics & quick actions
│   │   ├── POSScreen.tsx              # Fast mobile POS checkout with camera QR scanner
│   │   ├── ItemsScreen.tsx            # Inventory catalog & stock adjustment
│   │   ├── TransactionsScreen.tsx     # Invoices, WhatsApp sharing, thermal print & returns
│   │   ├── PartiesScreen.tsx          # Customer & Supplier Khata directory
│   │   ├── LedgerScreen.tsx           # Cash register, Daybook & expenses
│   │   ├── PurchaseOrdersScreen.tsx   # Supplier POs & stock inwarding
│   │   ├── ReportsScreen.tsx          # Trading, P&L & financial summaries
│   │   ├── SettingsScreen.tsx         # Store profile, staff & branch management
│   │   ├── HubScreen.tsx              # Central shift & business operations hub
│   │   ├── ShippingDispatchScreen.tsx # [BACKLOG] Parcel packing & dispatch verification
│   │   └── NewSaleScreen.tsx          # [BACKLOG] Manual invoice creation
│   ├── services/           # MobileStore singleton & API client with JWT storage
│   ├── theme/              # Color tokens and styling definitions
│   ├── utils/              # Print, share, audio, and formatting utilities
│   └── types/              # TypeScript models and domain contracts
├── App.tsx                 # Mobile app entry point, role-based navigation & status banners
├── app.json                # Expo project configuration and camera permissions
└── package.json            # Mobile dependencies and scripts
```

> **Process & Feature Parity Reference**: For complete comparative process mapping against the Web gold standard and the stepwise alignment roadmap, see **[MOBILE_VS_WEB_FEATURE_PARITY_AND_IMPROVEMENT_PLAN.md](../../MOBILE_VS_WEB_FEATURE_PARITY_AND_IMPROVEMENT_PLAN.md)**.

---

## 🏃 Getting Started & Local Development

### 1. Prerequisites
- **Node.js 20+**
- **Expo Go App** installed on your Android (via Google Play Store) or iOS (via Apple App Store) device.

### 2. Install Dependencies
```bash
cd apps/mobile
npm install
```

### 3. Start Expo Development Server
```bash
npx expo start
```

### 4. Open App on Device
- **Android**: Scan the QR code displayed in the terminal using the **Expo Go** app.
- **iOS**: Scan the QR code using the native **Camera** app.
- **Emulator / Simulator**: Press `a` for Android Emulator or `i` for iOS Simulator.

---

## 📷 Camera & Scanner Permissions

The mobile app requires camera permissions to scan product barcodes and QR codes:
- Configured in `app.json` under `expo.plugins` and `ios.infoPlist.NSCameraUsageDescription`.

---

## 🧪 Testing & Linting

```bash
cd apps/mobile
npm test
npx tsc --noEmit
```

---

## 📦 Building Standalone Android APK

You can build an installable `.apk` file using either **EAS Build** (Recommended: cloud/local, no Android Studio needed) or **Local Native Gradle Build** (offline).

### Method 1: EAS Build (Recommended & Cloud-Free of Android Studio)

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Log in to Expo**:
   ```bash
   eas login
   ```

3. **Trigger APK Build**:
   ```bash
   cd apps/mobile
   # Build on EAS Cloud (Outputs a direct download link and QR code for the .apk):
   eas build --platform android --profile preview

   # OR build locally on your machine with EAS CLI:
   eas build --platform android --profile preview --local
   ```

---

### Method 2: Offline Local Gradle Build (Requires Android SDK & Java 17)

1. **Generate the native Android project folder**:
   ```bash
   cd apps/mobile
   npx expo prebuild --platform android
   ```

2. **Compile the release APK using Gradle**:
   - **Windows (PowerShell / Command Prompt)**:
     ```powershell
     cd android
     .\gradlew assembleRelease
     ```
   - **macOS / Linux**:
     ```bash
     cd android
     ./gradlew assembleRelease
     ```

3. **Locate the generated APK**:
   ```text
   apps/mobile/android/app/build/outputs/apk/release/app-release.apk
   ```
   *(Or for debug testing: `.\gradlew assembleDebug` -> `.../apk/debug/app-debug.apk`)*

4. **Install on connected Android device via ADB**:
   ```bash
   adb install -r android/app/build/outputs/apk/release/app-release.apk
   ```

