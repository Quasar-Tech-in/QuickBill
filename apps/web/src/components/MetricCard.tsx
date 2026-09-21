import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  icon: LucideIcon;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  variant = 'primary',
  icon: Icon,
}) => {
  return (
    <div className={`metric-card ${variant}`}>
      <div className="metric-header">
        <span className="metric-title">{title}</span>
        <div className="metric-icon-box">
          <Icon size={18} />
        </div>
      </div>
      <div className="metric-value">{value}</div>
      {subtitle && <div className="metric-subtitle">{subtitle}</div>}
    </div>
  );
};
