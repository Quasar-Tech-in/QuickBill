---
name: frontend-testing-audit
description: >-
  Frontend testing standards, component architecture quality, UI/UX design patterns,
  code duplication auditing, and client-side security hardening for React and React Native.
---

# Frontend Testing, Code Standards, Design Patterns & Security Audit Standards

This skill establishes the comprehensive testing, architecture rating, design pattern audit, and security verification standards for the client applications:
- **Web Admin Portal** (`apps/web` - React / Vite / TypeScript)
- **Mobile POS & Billing App** (`apps/mobile` - React Native / Expo / TypeScript)

---

## 1. Frontend Test Strategy & Hierarchy

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND TEST PYRAMID                           │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. E2E / User Flows     │ Critical journeys (Login -> POS Cart -> Bill)│
│ 2. Component Integration│ React Testing Library: Form, Table, Modal UX │
│ 3. Hook & Store Units   │ Zustand stores, offline queue, custom hooks  │
│ 4. Pure Utils Units     │ Currency formatters, tax math, QR parsers    │
└─────────────────────────┴──────────────────────────────────────────────┘
```

### 1.1. Testing Tools
- **Unit & Component Testing**: `vitest` / `jest`, `@testing-library/react`, `@testing-library/react-native`.
- **E2E Testing**: `playwright` for Web, `maestro` or `detox` for Mobile React Native.
- **Mocking**: `msw` (Mock Service Worker) for network layer intercepting.

### 1.2. React Component Testing Pattern
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { POSCartView } from '../views/POSCartView';

describe('POSCartView Component Integration', () => {
  it('calculates total, applies tax, and dispatches checkout event accurately', async () => {
    const mockOnCheckout = vi.fn();
    render(<POSCartView onCheckout={mockOnCheckout} />);

    // Add item with fractional quantity
    const qtyInput = screen.getByLabelText(/quantity/i);
    fireEvent.change(qtyInput, { target: { value: '2.5' } });

    const priceInput = screen.getByLabelText(/price/i);
    fireEvent.change(priceInput, { target: { value: '100.00' } });

    // Assert calculated subtotal before checkout
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('250.00');

    const checkoutBtn = screen.getByRole('button', { name: /generate bill/i });
    fireEvent.click(checkoutBtn);

    await waitFor(() => {
      expect(mockOnCheckout).toHaveBeenCalledWith(expect.objectContaining({
        subtotal: 250.00,
      }));
    });
  });
});
```

---

## 2. Design Patterns & Component Architecture Quality

### 2.1. Permitted vs Anti-Patterns

| Category | Standard Best Practice | Anti-Pattern to Penalize |
|---|---|---|
| **Component Structure** | Presentational (UI) vs Container (Data fetching/Logic) separation or headless hook patterns. | ❌ Monolithic 800-line components with inline fetch calls and raw state mess. |
| **State Management** | Modular Zustand stores / React Context for auth/theme; local state for UI toggles. | ❌ Global state prop-drilling through 6 layers or mutating store state directly. |
| **Error Handling** | React Error Boundaries catching render errors with fallback UI cards. | ❌ Unhandled promise rejections causing blank white screen crashes. |
| **Loading States** | Skeleton loaders, disabled action buttons with loading spinners. | ❌ Unresponsive UI on slow network; multiple submissions on button spam. |
| **Async Mutations** | Optimistic UI updates with rollback on network failure. | ❌ Freezing entire UI or leaving user unaware of background sync status. |

### 2.2. Custom Hook & Compound Component Patterns
- Encapsulate data fetching, pagination, and debounce searching inside custom hooks (`useItems`, `useSalesBilling`, `useOfflineSync`).
- Form components should use controlled components with Zod/Yup schema validation (e.g., `react-hook-form`).

---

## 3. Code Duplication (DRY) Auditing & Component Reusability

When auditing frontend code, detect and eliminate these common duplications:

1. **Duplicate UI Primitives**:
   - *Bad*: Defining distinct custom button/input/modal styles in every view.
   - *Good*: Central design system UI package (`Button`, `Input`, `Modal`, `DataTable`, `Badge`, `Card`).
2. **Duplicate Formatters & Calculations**:
   - *Bad*: Re-implementing currency symbol formatting (`₹ ${val.toFixed(2)}`) across 20 components.
   - *Good*: Centralized `formatCurrency(val)` and `formatDate(date)` utilities.
3. **Repeated API Request & Error Handling**:
   - *Bad*: Writing `try { await api.get(...) } catch(err) { toast.error(...) }` in every component.
   - *Good*: Generic React Query / Axios interceptor handling global 401/403/500 errors and toast triggers.
4. **Copy-Pasted Table/Pagination Logic**:
   - *Bad*: Re-creating search debounce, filter state, and page controls on every admin list page.
   - *Good*: Reusable generic `<DataTable<T> columns={...} data={...} pagination={...} />` component.

---

## 4. Frontend Security Patterns & Hardening

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND SECURITY CHECKLIST                       │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. XSS Prevention       │ Zero unescaped dangerouslySetInnerHTML       │
│ 2. Token Storage        │ SecureStore on Mobile, HttpOnly on Web       │
│ 3. Deep Link Security   │ Strict validation of URL query/intent params │
│ 4. Sensitive Data Leak  │ Mask phone numbers, tokens, and PII in state │
│ 5. Session Expiry       │ Clean logout & cache clearing on 401 response│
└─────────────────────────┴──────────────────────────────────────────────┘
```

### 4.1. Cross-Site Scripting (XSS) Prevention
- Never render user input into `dangerouslySetInnerHTML` without DOMPurify sanitization.
- Ensure all printable invoice templates escape HTML entities before rendering or generating PDFs.

### 4.2. Secure Token Storage & Auth Lifecycle
- **Web**: Store access tokens in memory/Context and refresh tokens in `HttpOnly, Secure, SameSite=Strict` cookies. Never store unencrypted JWTs in `localStorage` if vulnerable to XSS.
- **Mobile**: Use `expo-secure-store` / `react-native-keychain` for tokens. Never use plain `AsyncStorage` for sensitive auth credentials.
- **Automatic Logout**: On `401 Unauthorized`, automatically wipe cached tenant state, invalidate queries, and redirect to the login screen.

### 4.3. Input Masking & PII Protection
- Mask sensitive customer details (e.g., Aadhaar / PAN / Card details) in transaction logs and mobile crash reports (Sentry / Bugsnag).

---

## 5. Frontend Quality Rating Scorecard

Rate the frontend code out of 100 based on the following rubric:

| Dimension | Weight | Scoring Criteria |
|---|:---:|---|
| **Component Architecture & Clean Code** | 20% | Modular component design, custom hook separation, strict TypeScript types (`no-any`), clear folder structure. |
| **Design System & DRY Reuse** | 20% | High reusability of UI primitives, centralized formatters, unified error handling, zero duplicate styled elements. |
| **Client-Side Security Hardening** | 25% | Secure token storage, zero XSS vulnerabilities, safe deep link handling, proper cache invalidation on logout. |
| **UX Resilience & State Handling** | 20% | Error boundaries, loading skeletons, optimistic UI, offline queue status indicators, disabled double-clicks. |
| **Test Coverage & Reliability** | 15% | RTL component integration tests, hook tests, user flow coverage, MSW API mocking. |

### Certification Levels
- **Score 90 - 100 (A+)**: Flawless enterprise frontend, resilient offline-first UX, zero security leaks, clean component design.
- **Score 75 - 89 (B)**: Good UX, minor duplication or incomplete test coverage for edge-case states.
- **Score < 70 (F)**: Critical flaws present (unsecured token storage, missing error boundaries, duplicate business math in UI, vulnerable to XSS). Requires immediate remediation.
