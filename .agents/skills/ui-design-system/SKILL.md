---
name: ui-design-system
description: >-
  Visual design system, color tokens, typography scales, responsive layouts,
  reusable UI components, and state management conventions for mobile (React Native) and Web Admin.
---

# UI Design System & Component Guidelines

## 1. Design Tokens & Color Palette

### 1.1. Color Tokens (Light & Dark Theme)
```typescript
export const theme = {
  colors: {
    primary: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      500: '#4F46E5',  // Primary Indigo Brand
      600: '#4338CA',  // Primary Hover / Active
      700: '#3730A3',
    },
    success: {
      50: '#ECFDF5',
      500: '#10B981',  // Paid / In Stock / Positive P&L
      700: '#047857',
    },
    warning: {
      50: '#FFFBEB',
      500: '#F59E0B',  // Low Stock / Partial Payment
      700: '#B45309',
    },
    danger: {
      50: '#FEF2F2',
      500: '#EF4444',  // Unpaid / Overdue / Delete
      700: '#B91C1C',
    },
    neutral: {
      50: '#F8FAFC',
      100: '#F1F5F9',
      200: '#E2E8F0',
      400: '#94A3B8',
      700: '#334155',
      900: '#0F172A',
    },
    surface: {
      card: '#FFFFFF',
      background: '#F8FAFC',
      border: '#E2E8F0',
    }
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    full: 9999,
  },
  typography: {
    fontFamily: {
      sans: 'Inter, system-ui, sans-serif',
      mono: 'JetBrains Mono, monospace',
    },
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      '2xl': 24,
      '3xl': 30,
    }
  }
};
```

---

## 2. Core Reusable Mobile Components

### 2.1. Status Badge Component
Used for payment statuses (`PAID`, `PARTIAL`, `UNPAID`) and stock statuses (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`):
```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatusBadgeProps {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'LOW_STOCK';
}

const statusConfig = {
  PAID: { bg: '#ECFDF5', text: '#047857', label: 'Paid' },
  PARTIAL: { bg: '#FFFBEB', text: '#B45309', label: 'Partial' },
  UNPAID: { bg: '#FEF2F2', text: '#B91C1C', label: 'Unpaid' },
  LOW_STOCK: { bg: '#FFFBEB', text: '#B45309', label: 'Low Stock' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status] || statusConfig.UNPAID;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '600' },
});
```

### 2.2. Metric Summary Card
```typescript
export interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  icon?: string;
}
```

---

## 3. UI Invariants & Accessibility Rules
- Contrast ratio between text and background must meet WCAG 2.1 AA ($\ge 4.5:1$).
- High-velocity actions (e.g., "+ Add Item", "Complete Bill") should be placed within the thumb zone at the bottom of the mobile screen.
- Loading states must use shimmering Skeleton loaders matching the dimensions of content cards.

---

## 4. Verification Checklist
- [ ] Theme tokens consistently applied across mobile and web admin.
- [ ] Tap targets meet the minimum 48x48 dp standard.
- [ ] Status badges accurately reflect colors for all business state transitions.
