import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  Zap, 
  Package, 
  FileText, 
  LayoutDashboard, 
  Menu 
} from 'lucide-react';
import { store } from '../services/store';

interface MobileBottomNavProps {
  onToggleMenu: () => void;
  isMenuOpen: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onToggleMenu,
  isMenuOpen
}) => {
  const location = useLocation();
  const currentPath = location.pathname;
  const currentUser = store.getCurrentUser();
  const userRole = currentUser?.role || 'TENANT_ADMIN';
  const isSuperAdmin = userRole === 'SUPER_ADMIN';

  // Listen to POS cart to show dynamic badge count on POS tab
  const posCart = store.getPosCart();
  const cartItemCount = posCart.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Cashier or regular user role routes
  const isPosActive = currentPath === '/pos';
  const isInventoryActive = currentPath === '/inventory';
  const isInvoicesActive = currentPath === '/invoices' || currentPath === '/transactions';
  const isDashboardActive = currentPath === '/dashboard';

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Bottom Navigation">
      {/* 1. POS Billing Tab */}
      <NavLink
        to="/pos"
        className={`mobile-nav-item ${isPosActive ? 'active' : ''}`}
        title="POS Billing"
      >
        <div style={{ position: 'relative' }}>
          <Zap size={20} />
          {cartItemCount > 0 && (
            <span className="mobile-nav-badge">
              {cartItemCount > 99 ? '99+' : Math.round(cartItemCount)}
            </span>
          )}
        </div>
        <span className="mobile-nav-label">POS</span>
      </NavLink>

      {/* 2. Inventory / Items Tab */}
      {!isSuperAdmin && userRole !== 'CASHIER' && (
        <NavLink
          to="/inventory"
          className={`mobile-nav-item ${isInventoryActive ? 'active' : ''}`}
          title="Items & Inventory"
        >
          <Package size={20} />
          <span className="mobile-nav-label">Items</span>
        </NavLink>
      )}

      {/* 3. Invoices / Bills Tab */}
      <NavLink
        to="/invoices"
        className={`mobile-nav-item ${isInvoicesActive ? 'active' : ''}`}
        title="Invoices & History"
      >
        <FileText size={20} />
        <span className="mobile-nav-label">Invoices</span>
      </NavLink>

      {/* 4. Dashboard Tab */}
      <NavLink
        to="/dashboard"
        className={`mobile-nav-item ${isDashboardActive ? 'active' : ''}`}
        title="Store Analytics & Cockpit"
      >
        <LayoutDashboard size={20} />
        <span className="mobile-nav-label">Dashboard</span>
      </NavLink>

      {/* 5. Menu Drawer Trigger */}
      <button
        type="button"
        className={`mobile-nav-item ${isMenuOpen ? 'active' : ''}`}
        onClick={onToggleMenu}
        aria-label="Toggle navigation drawer"
        title="More Modules & Menu"
      >
        <Menu size={20} />
        <span className="mobile-nav-label">Menu</span>
      </button>
    </nav>
  );
};
