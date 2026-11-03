import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Coffee,
  Search,
  ShoppingBag,
  Plus,
  Minus,
  AlertCircle,
  Leaf,
  Phone,
  Users,
  Copy,
  Check,
  ArrowRight,
  ChevronRight,
  Share2,
  Receipt,
  Clock,
  ChefHat,
} from 'lucide-react';
import { CustomerCartDrawer, CartLineItem } from './CustomerCartDrawer';
import { CustomerOrdersDrawer } from './CustomerOrdersDrawer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getSessionKey(prefix: string, tableNum: string) {
  return `${prefix}_${tableNum}`;
}

function saveSession(tableNum: string, data: SessionIdentity) {
  try {
    sessionStorage.setItem(getSessionKey('qb_member', tableNum), JSON.stringify(data));
  } catch (_) { /* ignore quota errors */ }
}

function loadSession(tableNum: string): SessionIdentity | null {
  try {
    const raw = sessionStorage.getItem(getSessionKey('qb_member', tableNum));
    return raw ? JSON.parse(raw) : null;
  } catch (_) { return null; }
}

function clearSession(tableNum: string) {
  try { sessionStorage.removeItem(getSessionKey('qb_member', tableNum)); } catch (_) { /* noop */ }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SessionIdentity {
  sessionId: string;
  memberId: string;
  memberToken: string;
  role: 'HOST' | 'GUEST';
  phone: string;
  joinCode: string;
  tableId: string;
  tableNumber: string;
  tableLabel: string;
  storeName: string;
}

type Stage =
  | 'checking'    // Loading initial session state
  | 'phone_entry' // Phone entry for HOST (no active session)
  | 'join_prompt' // Table occupied — ask for phone + join code
  | 'menu';       // Authenticated member can browse & order

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const DigitalMenuPage: React.FC = () => {
  // Support both new clean URL (/menu/:slug/:tableNum) and legacy (/order/:businessId/:tableId)
  const { slug, tableNum, businessId: legacyBizId, tableId: legacyTableId } = useParams<{
    slug?: string;
    tableNum?: string;
    businessId?: string;
    tableId?: string;
  }>();
  const [searchParams] = useSearchParams();

  // Token param: new format uses 't', legacy uses 'token'
  const qrToken = searchParams.get('t') || searchParams.get('token') || '';
  // Pre-filled join code from shared link (?join=XXXX)
  const prefilledJoinCode = searchParams.get('join') || '';

  // Resolve which mode we're in
  const isLegacyUrl = Boolean(legacyBizId && legacyTableId && !slug);
  const effectiveSlug = slug || legacyBizId || '';
  const effectiveTableNum = tableNum || ''; // Only available in clean URL mode

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [stage, setStage] = useState<Stage>('checking');
  const [sessionInfo, setSessionInfo] = useState<SessionIdentity | null>(null);
  const [sessionIdServer, setSessionIdServer] = useState<string | null>(null); // existing session ID from check
  const [joinCodeExists, setJoinCodeExists] = useState<string | null>(null);  // server-reported joinCode
  const [hasActiveSession, setHasActiveSession] = useState(false);

  // Phone / name form state
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joinCode, setJoinCode] = useState(prefilledJoinCode);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Menu & cart state
  const [menuData, setMenuData] = useState<any>(null);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [dietaryFilter, setDietaryFilter] = useState<'ALL' | 'VEG' | 'NON_VEG'>('ALL');
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [joinCodeCopied, setJoinCodeCopied] = useState(false);

  // Orders Drawer & Live Status
  const [isOrdersDrawerOpen, setIsOrdersDrawerOpen] = useState(false);
  const [customerOrdersData, setCustomerOrdersData] = useState<any>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchTableOrders = useCallback(async () => {
    if (!effectiveSlug || !effectiveTableNum) return;
    try {
      setOrdersLoading(true);
      const res = await axios.get(
        `${API_BASE_URL}/public/cafe/${effectiveSlug}/table/${effectiveTableNum}/orders`,
        { params: { t: qrToken } }
      );
      setCustomerOrdersData(res.data);
    } catch (_) {
      // quiet fail on polling
    } finally {
      setOrdersLoading(false);
    }
  }, [effectiveSlug, effectiveTableNum, qrToken]);

  useEffect(() => {
    if (stage === 'menu') {
      fetchTableOrders();
      const interval = setInterval(() => {
        fetchTableOrders();
      }, 8000);
      return () => clearInterval(interval);
    }
  }, [stage, fetchTableOrders]);

  // ---------------------------------------------------------------------------
  // Step 1: Check for existing session on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // For legacy URLs, skip the host/join flow and go directly to menu
    if (isLegacyUrl) {
      setStage('menu');
      return;
    }
    if (!effectiveSlug || !effectiveTableNum) {
      setStage('phone_entry');
      return;
    }

    // Check sessionStorage for persisted identity
    const stored = loadSession(effectiveTableNum);
    if (stored) {
      setSessionInfo(stored);
      setStage('menu');
      return;
    }

    // Ask server if table has an active session
    const checkSession = async () => {
      setStage('checking');
      try {
        const res = await axios.get(
          `${API_BASE_URL}/public/cafe/${effectiveSlug}/table/${encodeURIComponent(effectiveTableNum)}/session`,
          { params: { t: qrToken } }
        );
        const data = res.data;
        setHasActiveSession(data.hasActiveSession);
        setSessionIdServer(data.sessionId || null);
        setJoinCodeExists(data.joinCode || null);
        setStage(data.hasActiveSession ? 'join_prompt' : 'phone_entry');
      } catch (_) {
        // If check fails (e.g. network), fall through to phone_entry
        setStage('phone_entry');
      }
    };

    checkSession();
  }, [isLegacyUrl, effectiveSlug, effectiveTableNum, qrToken]);

  // ---------------------------------------------------------------------------
  // Step 2: Fetch menu once we're on the menu stage
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (stage !== 'menu') return;

    const fetchMenu = async () => {
      setMenuLoading(true);
      setMenuError(null);
      try {
        const params: Record<string, string> = {};
        if (qrToken) params.t = qrToken;
        if (!isLegacyUrl) {
          params.tableNum = effectiveTableNum;
        } else {
          if (legacyTableId) params.tableId = legacyTableId;
          if (searchParams.get('token')) params.token = searchParams.get('token')!;
        }

        const res = await axios.get(
          `${API_BASE_URL}/public/cafe/${effectiveSlug}/menu`,
          { params }
        );
        setMenuData(res.data);
      } catch (err: any) {
        setMenuError(
          err.response?.data?.detail ||
          'Unable to load the menu. Please check your network or ask a staff member.'
        );
      } finally {
        setMenuLoading(false);
      }
    };

    fetchMenu();
  }, [stage]);

  // ---------------------------------------------------------------------------
  // Host: Start a new session
  // ---------------------------------------------------------------------------
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/public/cafe/${effectiveSlug}/table/${encodeURIComponent(effectiveTableNum)}/session/start`,
        { phone: cleanPhone, name: displayName.trim() || undefined },
        { params: { t: qrToken } }
      );
      const identity: SessionIdentity = {
        sessionId: res.data.sessionId,
        memberId: res.data.memberId,
        memberToken: res.data.memberToken,
        role: 'HOST',
        phone: cleanPhone,
        joinCode: res.data.joinCode || '',
        tableId: res.data.tableId,
        tableNumber: res.data.tableNumber,
        tableLabel: res.data.tableLabel,
        storeName: res.data.storeName,
      };
      saveSession(effectiveTableNum, identity);
      setSessionInfo(identity);
      setStage('menu');
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to start session. Please try again.';
      // If table already has a session (409), offer join flow
      if (err.response?.status === 409) {
        setHasActiveSession(true);
        setStage('join_prompt');
        setFormError('');
      } else {
        setFormError(msg);
      }
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Guest: Join an existing session
  // ---------------------------------------------------------------------------
  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }
    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setFormError('Please enter the join code given by the host.');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      const res = await axios.post(
        `${API_BASE_URL}/public/cafe/${effectiveSlug}/table/${encodeURIComponent(effectiveTableNum)}/session/join`,
        { phone: cleanPhone, name: displayName.trim() || undefined, joinCode: cleanCode },
        { params: { t: qrToken } }
      );
      const identity: SessionIdentity = {
        sessionId: res.data.sessionId,
        memberId: res.data.memberId,
        memberToken: res.data.memberToken,
        role: res.data.role || 'GUEST',
        phone: cleanPhone,
        joinCode: '',
        tableId: res.data.tableId,
        tableNumber: res.data.tableNumber,
        tableLabel: res.data.tableLabel,
        storeName: res.data.storeName,
      };
      saveSession(effectiveTableNum, identity);
      setSessionInfo(identity);
      setStage('menu');
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to join session. Check the join code and try again.');
    } finally {
      setFormLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Cart helpers
  // ---------------------------------------------------------------------------
  const handleAddToCart = (item: any, variantName?: string) => {
    setCartItems(prev => {
      const existingIdx = prev.findIndex(
        c => c.item.id === item.id && c.variantName === variantName
      );
      if (existingIdx !== -1) {
        const copy = [...prev];
        copy[existingIdx].quantity += 1;
        return copy;
      }
      return [...prev, { item, quantity: 1, notes: '', variantName }];
    });
  };

  const handleUpdateQuantity = (itemId: string, delta: number, variantName?: string) => {
    setCartItems(prev =>
      prev
        .map(c => {
          if (c.item.id === itemId && c.variantName === variantName) {
            return { ...c, quantity: c.quantity + delta };
          }
          return c;
        })
        .filter(c => c.quantity > 0)
    );
  };

  const handleUpdateNotes = (itemId: string, notes: string, variantName?: string) => {
    setCartItems(prev =>
      prev.map(c => {
        if (c.item.id === itemId && c.variantName === variantName) {
          return { ...c, notes };
        }
        return c;
      })
    );
  };

  const handleCopyJoinCode = () => {
    if (!sessionInfo?.joinCode) return;
    navigator.clipboard.writeText(sessionInfo.joinCode).then(() => {
      setJoinCodeCopied(true);
      setTimeout(() => setJoinCodeCopied(false), 2000);
    });
  };

  const handleShareLink = () => {
    if (!sessionInfo?.joinCode) return;
    const shareUrl = `${window.location.origin}/menu/${effectiveSlug}/${effectiveTableNum}?t=${encodeURIComponent(qrToken)}&join=${sessionInfo.joinCode}`;
    if (navigator.share) {
      navigator.share({ title: `Join my table at ${sessionInfo.storeName}`, url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareUrl);
    }
  };

  const totalCartCount = cartItems.reduce((sum, c) => sum + c.quantity, 0);
  const cartSubtotal = cartItems.reduce((sum, c) => {
    const price = c.item.salePrice || c.item.unitPrice || 0;
    return sum + price * c.quantity;
  }, 0);

  const rawItems: any[] = menuData?.items || [];

  const categories: string[] = useMemo(() => {
    const set = new Set<string>();
    rawItems.forEach(item => { if (item.category) set.add(item.category); });
    return Array.from(set);
  }, [rawItems]);

  const filteredItems = useMemo(() => {
    return rawItems.filter(item => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (dietaryFilter === 'VEG' && item.dietaryFlags?.isVeg !== true && item.isVeg !== true) return false;
      if (dietaryFilter === 'NON_VEG' && (item.dietaryFlags?.isVeg === true || item.isVeg === true)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!item.name?.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rawItems, selectedCategory, dietaryFilter, searchQuery]);

  // Effective table ID for legacy order submission
  const effectiveTableId = sessionInfo?.tableId || legacyTableId || '';
  const effectiveMemberToken = sessionInfo?.memberToken || '';
  const effectiveSessionId = sessionInfo?.sessionId || '';
  const tableName = sessionInfo?.tableLabel
    || (sessionInfo?.tableNumber ? `Table ${sessionInfo.tableNumber}` : '')
    || (menuData?.table?.label || (menuData?.table?.tableNumber ? `Table ${menuData.table.tableNumber}` : `Table ${effectiveTableNum || ''}`));
  const storeName = sessionInfo?.storeName || menuData?.storeName || 'Café';

  // ============================================================
  // RENDER: Checking (spinner)
  // ============================================================
  if (stage === 'checking') {
    return (
      <div style={styles.centerPage}>
        <div style={{ ...styles.iconCircle, backgroundColor: '#eff6ff', color: '#2563eb' }}>
          <Coffee size={28} />
        </div>
        <h3 style={styles.heading}>Loading...</h3>
        <p style={styles.subtext}>Connecting to the café</p>
      </div>
    );
  }

  // ============================================================
  // RENDER: Phone Entry (HOST)
  // ============================================================
  if (stage === 'phone_entry') {
    return (
      <div style={styles.centerPage}>
        <div style={styles.formCard}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ ...styles.iconCircle, backgroundColor: '#eff6ff', color: '#2563eb', margin: '0 auto 14px' }}>
              <Coffee size={26} />
            </div>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              Welcome!
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              Enter your mobile number to start ordering
            </p>
            {effectiveTableNum && (
              <div style={styles.tableBadge}>
                Table {effectiveTableNum}
              </div>
            )}
          </div>

          <form onSubmit={handleStartSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Phone field */}
            <div>
              <label style={styles.label}>Mobile Number *</label>
              <div style={styles.inputWrapper}>
                <Phone size={16} style={styles.inputIcon} />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
            </div>

            {/* Name field (optional) */}
            <div>
              <label style={styles.label}>Your Name (optional)</label>
              <input
                type="text"
                placeholder="e.g. Rahul"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{ ...styles.input, paddingLeft: 14 }}
              />
            </div>

            {formError && <p style={styles.errorText}><AlertCircle size={14} style={{ marginRight: 4, flexShrink: 0 }} />{formError}</p>}

            <button type="submit" disabled={formLoading} style={styles.primaryBtn}>
              {formLoading ? 'Starting session...' : 'Start Ordering'}
              {!formLoading && <ChevronRight size={18} />}
            </button>
          </form>

          <p style={{ fontSize: '0.72rem', color: '#94a3b8', textAlign: 'center', marginTop: 14 }}>
            Your number is used only to register your order. No spam.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Join Prompt (GUEST — table is occupied)
  // ============================================================
  if (stage === 'join_prompt') {
    return (
      <div style={styles.centerPage}>
        <div style={styles.formCard}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ ...styles.iconCircle, backgroundColor: '#fef9c3', color: '#ca8a04', margin: '0 auto 14px' }}>
              <Users size={26} />
            </div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#0f172a', margin: '0 0 6px' }}>
              Table is Occupied
            </h1>
            <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
              {effectiveTableNum && <><strong>Table {effectiveTableNum}</strong> already has guests. </>}
              Ask the host for a join code and enter your number to join.
            </p>
          </div>

          <form onSubmit={handleJoinSession} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={styles.label}>Mobile Number *</label>
              <div style={styles.inputWrapper}>
                <Phone size={16} style={styles.inputIcon} />
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div>
              <label style={styles.label}>Your Name (optional)</label>
              <input
                type="text"
                placeholder="e.g. Priya"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={{ ...styles.input, paddingLeft: 14 }}
              />
            </div>

            <div>
              <label style={styles.label}>Join Code *</label>
              <input
                type="text"
                placeholder="e.g. A3X7K2"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={8}
                required
                style={{ ...styles.input, paddingLeft: 14, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 700 }}
              />
              <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: 4 }}>
                Ask the person who scanned first for the 6-character code.
              </p>
            </div>

            {formError && <p style={styles.errorText}><AlertCircle size={14} style={{ marginRight: 4, flexShrink: 0 }} />{formError}</p>}

            <button type="submit" disabled={formLoading} style={styles.primaryBtn}>
              {formLoading ? 'Joining...' : 'Join Table'}
              {!formLoading && <ChevronRight size={18} />}
            </button>
          </form>

          <div style={{ borderTop: '1px solid #f1f5f9', marginTop: 18, paddingTop: 14, textAlign: 'center' }}>
            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '0 0 8px' }}>
              Are you starting fresh? (e.g. old QR session expired)
            </p>
            <button
              type="button"
              onClick={() => { setStage('phone_entry'); setHasActiveSession(false); setFormError(''); }}
              style={styles.ghostBtn}
            >
              Start New Session Instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: Menu (authenticated member)
  // ============================================================
  if (menuLoading) {
    return (
      <div style={styles.centerPage}>
        <div style={{ ...styles.iconCircle, backgroundColor: '#eff6ff', color: '#2563eb' }}>
          <Coffee size={28} />
        </div>
        <h3 style={styles.heading}>Loading Menu...</h3>
        <p style={styles.subtext}>Fetching fresh items from the counter</p>
      </div>
    );
  }

  if (menuError) {
    return (
      <div style={styles.centerPage}>
        <div style={{ ...styles.iconCircle, backgroundColor: '#fef2f2', color: '#dc2626' }}>
          <AlertCircle size={28} />
        </div>
        <h3 style={styles.heading}>Unable to Open Menu</h3>
        <p style={{ ...styles.subtext, maxWidth: 320 }}>{menuError}</p>
        <button type="button" onClick={() => setMenuLoading(true)} style={styles.primaryBtn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      paddingBottom: cartItems.length > 0 ? 100 : 40,
    }}>
      {/* ---- Sticky Brand Header ---- */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '14px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 680, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '10px',
                backgroundColor: '#2563eb', color: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Coffee size={20} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#0f172a', margin: 0 }}>
                  {storeName}
                </h1>
                <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>Contactless Dine-In</span>
                  <span>•</span>
                  <span style={{
                    backgroundColor: '#f1f5f9', color: '#1e293b',
                    padding: '1px 8px', borderRadius: '12px', fontWeight: 700, fontSize: '0.7rem'
                  }}>
                    {tableName}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* Host: show invite button */}
              {sessionInfo?.role === 'HOST' && sessionInfo.joinCode && (
                <button
                  type="button"
                  onClick={handleShareLink}
                  title="Invite friends to join your table"
                  style={{
                    border: '1px solid #e2e8f0', background: '#f8fafc',
                    borderRadius: '8px', padding: '6px 10px',
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: '0.75rem', fontWeight: 700, color: '#334155', cursor: 'pointer'
                  }}
                >
                  <Share2 size={13} />
                  Invite
                </button>
              )}

              {/* Cart icon */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                style={{
                  position: 'relative', backgroundColor: '#f1f5f9',
                  border: 'none', borderRadius: '50%',
                  width: 40, height: 40,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#1e293b'
                }}
              >
                <ShoppingBag size={19} />
                {totalCartCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -2, right: -2,
                    backgroundColor: '#dc2626', color: '#ffffff',
                    fontSize: '0.68rem', fontWeight: 900,
                    width: 18, height: 18, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {totalCartCount}
                  </span>
                )}
              </button>

              {/* Orders status icon */}
              <button
                type="button"
                onClick={() => {
                  fetchTableOrders();
                  setIsOrdersDrawerOpen(true);
                }}
                title="View your table orders & kitchen status"
                style={{
                  position: 'relative',
                  backgroundColor: (customerOrdersData?.pendingOrders?.length || 0) > 0 ? '#fef3c7' : '#f1f5f9',
                  border: (customerOrdersData?.pendingOrders?.length || 0) > 0 ? '1px solid #fde68a' : 'none',
                  borderRadius: '50%',
                  width: 40,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: (customerOrdersData?.pendingOrders?.length || 0) > 0 ? '#b45309' : '#1e293b',
                }}
              >
                <Receipt size={18} />
                {((customerOrdersData?.allOrders?.length || 0) > 0) && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      backgroundColor: (customerOrdersData?.pendingOrders?.length || 0) > 0 ? '#f59e0b' : '#2563eb',
                      color: '#ffffff',
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {customerOrdersData?.allOrders?.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Host: join code pill */}
          {sessionInfo?.role === 'HOST' && sessionInfo.joinCode && (
            <div style={{
              marginTop: 10,
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '10px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#2563eb', fontWeight: 700, textTransform: 'uppercase' }}>
                  Your Join Code — Share with friends at this table
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#1e3a8a', letterSpacing: '0.12em' }}>
                  {sessionInfo.joinCode}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyJoinCode}
                style={{
                  border: 'none', background: '#dbeafe',
                  borderRadius: '8px', padding: '6px 10px',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.75rem', fontWeight: 700, color: '#1d4ed8', cursor: 'pointer'
                }}
              >
                {joinCodeCopied ? <><Check size={13} />Copied!</> : <><Copy size={13} />Copy</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pending Orders Notification Banner */}
      {customerOrdersData?.pendingOrders?.length > 0 && (
        <div
          onClick={() => {
            fetchTableOrders();
            setIsOrdersDrawerOpen(true);
          }}
          style={{
            backgroundColor: '#fffbeb',
            borderBottom: '1px solid #fde68a',
            padding: '10px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#b45309',
            maxWidth: 680,
            margin: '0 auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <Clock size={15} />
            <span>{customerOrdersData.pendingOrders.length} order(s) submitted • Awaiting kitchen confirmation</span>
          </div>
          <span style={{ fontWeight: 800, textDecoration: 'underline' }}>View Status &rarr;</span>
        </div>
      )}

      {/* ---- Menu Content ---- */}
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '16px 20px' }}>
        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search coffee, mains, shakes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px 11px 38px',
              borderRadius: '12px', border: '1px solid #cbd5e1',
              backgroundColor: '#ffffff', fontSize: '0.87rem', color: '#0f172a', outline: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}
          />
        </div>

        {/* Dietary Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
          {([
            { key: 'ALL', label: 'All Items', color: '#0f172a' },
            { key: 'VEG', label: '🟢 Pure Veg', color: '#16a34a' },
            { key: 'NON_VEG', label: '🔴 Non-Veg', color: '#dc2626' },
          ] as const).map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setDietaryFilter(f.key)}
              style={{
                padding: '5px 13px', borderRadius: '20px',
                border: dietaryFilter === f.key ? `1.5px solid ${f.color}` : '1px solid #cbd5e1',
                backgroundColor: dietaryFilter === f.key ? (f.key === 'ALL' ? '#0f172a' : f.key === 'VEG' ? '#f0fdf4' : '#fef2f2') : '#ffffff',
                color: dietaryFilter === f.key ? (f.key === 'ALL' ? '#ffffff' : f.color) : '#475569',
                fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Category Pills */}
        {categories.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, overflowX: 'auto', paddingBottom: 4 }}>
            {['ALL', ...categories].map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '5px 14px', borderRadius: '8px', border: 'none',
                  backgroundColor: selectedCategory === cat ? '#2563eb' : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#475569',
                  fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)', whiteSpace: 'nowrap'
                }}
              >
                {cat === 'ALL' ? 'All Categories' : cat}
              </button>
            ))}
          </div>
        )}

        {/* Items List */}
        {filteredItems.length === 0 ? (
          <div style={{
            backgroundColor: '#ffffff', borderRadius: '12px',
            border: '1px dashed #cbd5e1', padding: '48px 24px',
            textAlign: 'center', color: '#64748b'
          }}>
            <Coffee size={36} style={{ margin: '0 auto 10px', color: '#94a3b8' }} />
            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.92rem' }}>No dishes found</div>
            <div style={{ fontSize: '0.78rem', marginTop: 4 }}>
              Try searching for something else or clear dietary filters.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filteredItems.map(item => {
              const price = item.salePrice || item.unitPrice || 0;
              const isVeg = item.dietaryFlags?.isVeg ?? item.isVeg ?? true;
              const cartLine = cartItems.find(c => c.item.id === item.id);
              const currentQty = cartLine?.quantity || 0;

              return (
                <div key={item.id} style={{
                  backgroundColor: '#ffffff', borderRadius: '14px',
                  border: '1px solid #e2e8f0', padding: '14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 13, height: 13,
                        border: `1.5px solid ${isVeg ? '#16a34a' : '#dc2626'}`,
                        borderRadius: '3px', padding: 1,
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', backgroundColor: isVeg ? '#16a34a' : '#dc2626' }} />
                      </span>
                      <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#0f172a' }}>{item.name}</div>
                    </div>
                    {item.description && (
                      <p style={{
                        fontSize: '0.76rem', color: '#64748b', margin: '0 0 6px', lineHeight: 1.4,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                      }}>
                        {item.description}
                      </p>
                    )}
                    <div style={{ fontSize: '0.96rem', fontWeight: 900, color: '#0f172a' }}>
                      ₹{Number(price).toFixed(2)}
                    </div>
                  </div>

                  <div>
                    {currentQty > 0 ? (
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 10,
                        backgroundColor: '#eff6ff', border: '1.5px solid #2563eb', borderRadius: '10px', padding: '4px 10px',
                      }}>
                        <button type="button" onClick={() => handleUpdateQuantity(item.id, -1)}
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e3a8a', minWidth: 16, textAlign: 'center' }}>
                          {currentQty}
                        </span>
                        <button type="button" onClick={() => handleUpdateQuantity(item.id, 1)}
                          style={{ border: 'none', background: 'transparent', color: '#2563eb', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 2 }}>
                          <Plus size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddToCart(item)}
                        style={{
                          padding: '7px 16px', borderRadius: '10px',
                          backgroundColor: '#ffffff', border: '1.5px solid #2563eb',
                          color: '#2563eb', fontWeight: 800, fontSize: '0.83rem',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <Plus size={14} />Add
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ---- Floating Cart Bar ---- */}
      {totalCartCount > 0 && (
        <div style={{
          position: 'fixed', bottom: 20, left: 20, right: 20,
          maxWidth: 640, margin: '0 auto', zIndex: 100,
        }}>
          <div
            onClick={() => setIsCartOpen(true)}
            style={{
              backgroundColor: '#0f172a', color: '#ffffff', borderRadius: '14px',
              padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              boxShadow: '0 8px 24px rgba(15, 23, 42, 0.35)', cursor: 'pointer',
            }}
          >
            <div>
              <div style={{ fontSize: '0.73rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 700 }}>
                {totalCartCount} {totalCartCount === 1 ? 'Item' : 'Items'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>
                ₹{cartSubtotal.toFixed(2)} <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 400 }}>+ GST</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: '0.9rem', color: '#60a5fa' }}>
              <span>View Cart & Place Order</span>
              <ArrowRight size={17} />
            </div>
          </div>
        </div>
      )}

      {/* ---- Cart Drawer ---- */}
      <CustomerCartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        onUpdateQuantity={handleUpdateQuantity}
        onUpdateNotes={handleUpdateNotes}
        onClearCart={() => setCartItems([])}
        businessId={effectiveSlug}
        tableId={effectiveTableId}
        token={qrToken}
        memberToken={effectiveMemberToken}
        sessionId={effectiveSessionId}
        tableName={tableName}
        onOrderSuccess={() => {
          fetchTableOrders();
          setIsOrdersDrawerOpen(true);
        }}
      />

      {/* ---- Table Orders & Bill Status Drawer ---- */}
      <CustomerOrdersDrawer
        isOpen={isOrdersDrawerOpen}
        onClose={() => setIsOrdersDrawerOpen(false)}
        ordersData={customerOrdersData}
        loading={ordersLoading}
        onRefresh={fetchTableOrders}
        onBrowseMenu={() => setIsOrdersDrawerOpen(false)}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared inline styles
// ---------------------------------------------------------------------------
const styles: Record<string, React.CSSProperties> = {
  centerPage: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    textAlign: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  formCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
    padding: '28px 24px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: {
    fontSize: '1.15rem',
    fontWeight: 800,
    color: '#0f172a',
    margin: '0 0 6px',
  },
  subtext: {
    fontSize: '0.83rem',
    color: '#64748b',
    margin: 0,
  },
  label: {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#374151',
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 13,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#94a3b8',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '10px 14px 10px 38px',
    borderRadius: '10px',
    border: '1.5px solid #cbd5e1',
    fontSize: '0.88rem',
    color: '#0f172a',
    outline: 'none',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  errorText: {
    fontSize: '0.8rem',
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    margin: 0,
    backgroundColor: '#fef2f2',
    padding: '8px 12px',
    borderRadius: '8px',
  } as React.CSSProperties,
  primaryBtn: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: '12px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    fontWeight: 800,
    fontSize: '0.95rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
  } as React.CSSProperties,
  ghostBtn: {
    border: 'none',
    background: 'none',
    color: '#2563eb',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '4px 0',
  } as React.CSSProperties,
  tableBadge: {
    display: 'inline-block',
    marginTop: 10,
    backgroundColor: '#f1f5f9',
    color: '#1e293b',
    padding: '3px 12px',
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: '0.78rem',
  } as React.CSSProperties,
};
