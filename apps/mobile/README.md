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
│   ├── components/         # Mobile UI components (Cards, Inputs, Buttons, Modals)
│   ├── screens/            # Screen views:
│   │   ├── BillingScreen.tsx     # Mobile POS screen with Camera QR trigger
│   │   ├── ScannerScreen.tsx     # Fullscreen camera barcode & QR scanner
│   │   ├── ItemsScreen.tsx       # Product catalog & stock viewer
│   │   ├── PartiesScreen.tsx     # Customer & Supplier Khata ledger
│   │   └── ReportsScreen.tsx     # Daily sales & financial summaries
│   ├── services/           # API client with JWT storage & auth interceptors
│   ├── hooks/              # Offline storage and network state hooks
│   └── types/              # Shared TypeScript contracts
├── App.tsx                 # Mobile app entry point and navigation container
├── app.json                # Expo project configuration and permissions
└── package.json            # Mobile dependencies and scripts
```

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
