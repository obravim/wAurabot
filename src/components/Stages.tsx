import React from 'react'
import { Check } from 'lucide-react';

const steps = ["Upload", "Scale", "Edit", "Save Project Name"];

function Stages({ active }: Readonly<{ active: number; }>) {
    return (
        <div className="grow flex justify-center items-center gap-2 mt-[24px] mb-[48px]">
            {steps.map((step, index) => (
                <div key={index} className="flex flex-col items-center gap-2">
                    <div className='flex items-center gap-2'>
                        <div
                            className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs border-3 font-semibold font-heading
                                ${index < active ? "bg-[#873efd] border-[#873efd]" : ""}
                                 ${index === active ? "text-[#873efd] border-[#873efd] bg-white" : ""} 
                                 ${index > active ? "border-[#a1aebe] bg-[#ffffff] text-[#242E39]" : ""}`}
                        >
                            {index < active ? <Check size={16} /> : <span className='leading-none'>{String(index + 1).padStart(2, '0')}</span>}
                            <span className={`absolute w-[80px] text-xs font-semibold top-[calc(100%+12px)] text-center  ${index <= active ? "text-[#873efd]" : "text-[#465668]"}`}>{step}</span>
                        </div>
                        {(index < steps.length - 1) ? <div className={`h-[3px] w-[100px] ${index < active ? "bg-[#873efd]" : "bg-[#a1aebe]"}`} /> : null}
                    </div>
                </div>
            ))}
        </div>
    )
}

export default Stages