import React from 'react';
import './ui.css';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
}

export function Card({ className = '', children, style, ...props }: CardProps) {
    return (
        <div className={`ui-card ${className}`} style={style} {...props}>
            {children}
        </div>
    );
}

export function CardHeader({ children, className = '', actions, style }: { children: React.ReactNode, className?: string, actions?: React.ReactNode, style?: React.CSSProperties }) {
    return (
        <div className={`ui-card-header ${className}`} style={style}>
            <div className="ui-card-title">{children}</div>
            {actions && <div>{actions}</div>}
        </div>
    );
}

export function CardContent({ children, className = '', style, ...props }: CardProps) {
    return (
        <div className={`ui-card-content ${className}`} style={style} {...props}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className = '', style, ...props }: CardProps) {
    return (
        <div className={`ui-card-footer ${className}`} style={style} {...props}>
            {children}
        </div>
    );
}
