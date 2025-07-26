import React from 'react'
import Image from 'next/image'
import {User} from 'lucide-react'

export default function Header() {
  return (
    <div className='flex justify-between items-center bg-[#0d0d0d] h-[96px] px-12'>
        <div className="flex gap-3 items-center">
            <Image src={'./logo.svg'} alt='logo' width={24} height={24} />
            <h1 className='font-bold font-sans mt-0.5 text-xl'>AuraBots</h1>
        </div>
        <span className='w-8 h-8 bg-[#d9d9d9] rounded-full flex items-center justify-center'>
        <User size={20} color='black'/>
        </span>
    </div>
  )
}
