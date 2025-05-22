import React from 'react';
import classNames from 'classnames';
import './card.css'; // Import the external CSS

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames("custom-card", className)}>
      {children}
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={classNames("custom-card-content", className)}>
      {children}
    </div>
  );
}
