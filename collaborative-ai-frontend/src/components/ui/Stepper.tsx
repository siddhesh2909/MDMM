import React from 'react';
import { Check } from 'lucide-react';
import './Stepper.css';

interface StepperProps {
    steps: string[];
    currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
    return (
        <div className="stepper-container">
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isActive = index === currentStep;

                return (
                    <div key={index} className="stepper-item">
                        <div className={`stepper-circle ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                            {isCompleted ? <Check size={16} strokeWidth={3} /> : index + 1}
                        </div>
                        <div className={`stepper-label ${isActive || isCompleted ? 'active-label' : ''}`}>
                            {step}
                        </div>
                        {index < steps.length - 1 && (
                            <div className={`stepper-line ${isCompleted ? 'completed-line' : ''}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
