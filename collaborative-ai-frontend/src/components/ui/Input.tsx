import React from 'react';
import './ui.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className = '', label, id, ...props }, ref) => {
        const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
        return (
            <div className={`input-wrapper ${className}`}>
                {label && (
                    <label htmlFor={inputId} className="input-label">
                        {label}
                    </label>
                )}
                <input
                    ref={ref}
                    id={inputId}
                    className="input-field"
                    {...props}
                />
            </div>
        );
    }
);

Input.displayName = 'Input';
