'use client';

import { createContext, useContext, useState } from 'react';

// type Step = 0 | 1 | 2 | 3
type StepContextType = {
    step: number;
    setStep: (step: number) => void;
};

const StepContext = createContext<StepContextType | undefined>(undefined);

export function StepProvider({ children }: { children: React.ReactNode }) {
    const [step, setStep] = useState(0);
    return (
        <StepContext.Provider value={{ step, setStep }}>
            {children}
        </StepContext.Provider>
    );
}

export function useStep() {
    const context = useContext(StepContext);
    if (!context) throw new Error("useStep must be used within StepProvider");
    return context;
}
