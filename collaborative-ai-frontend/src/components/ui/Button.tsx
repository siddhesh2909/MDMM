import React from 'react';
import './ui.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'danger' | 'outline';
    icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className = '', variant = 'primary', icon, children, ...props }, ref) => {
        return (
            <button
                ref={ref}
                className={`btn btn-${variant} ${className}`}
                {...props}
            >
                {icon && <span className="btn-icon">{icon}</span>}
                {children}
            </button>
        );
    }
);

Button.displayName = 'Button';
