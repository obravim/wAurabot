'use client'
import React from 'react'
import { ArrowLeft } from "lucide-react";
import Stages from "@/components/Stages";
import { useStep } from '@/app/context/StepContext';

export default function Nav() {
    const { step, setStep } = useStep();
    const handleBack = () => {
        setStep(step - 1);
    }
    return (
        <div className="flex items-center">
            {/* Back Button */}
            <button className="flex items-center grow-0 gap-1 text-sm text-[#e7e6e9] hover:text-white" onClick={handleBack}>
                <ArrowLeft size={16} color={"white"} />
                <span className="leading-none mt-0.5 font-sans">Back</span>
            </button>
            {/* Stepper */}
            <Stages active={step} />
        </div>
    )
}
