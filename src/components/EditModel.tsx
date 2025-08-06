import React, { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export const NAME_REGEX = /^[\w\d-_ ]+$/i

export type EditModelDataType = {
    itemId: string,
    length: number,
    breadth: number | null,
    height: number,
    name: string,
    isRoom: boolean,
    isZone: boolean
}

type EditModelProps = {
    data: EditModelDataType
    open: boolean,
    onClose: () => void,
    onSave: (outObject: EditModelDataType) => void,
}

export default function EditModel({ data, open, onClose, onSave }: EditModelProps) {
    const lengthRef = useRef<HTMLInputElement>(null);
    const breadthRef = useRef<HTMLInputElement>(null);
    const heightRef = useRef<HTMLInputElement>(null);
    const nameRef = useRef<HTMLInputElement>(null);

    const handleSave = () => {

        const lengthValue = lengthRef.current?.value.trim()
        const breadthValue = breadthRef.current?.value.trim()
        const heightValue = heightRef.current?.value.trim()
        const nameValue = nameRef.current?.value.trim()

        if (data.isZone && nameValue && nameValue.length > 0) {
            onSave({ ...data, name: nameValue })
        }

        if (lengthValue && lengthValue.length > 0 &&
            (!data.isRoom || (data.isRoom && breadthValue && breadthValue.length > 0)) &&
            heightValue && heightValue.length > 0 &&
            nameValue && nameValue.length > 0) {
            const length = parseFloat(lengthValue)
            const breadthVal = data.isRoom && breadthValue ? parseFloat(breadthValue) : 0
            const height = parseFloat(heightValue)
            if (!nameValue.match(NAME_REGEX)) {
                alert("Only Alphabets, digits, -, _ and space are allowed.");
                return;
            }
            onSave({ ...data, length, breadth: breadthVal, height, name: nameValue })
        }
        else {
            return;
        }
    }
    return (
        <div>
            {
                open && (
                    <div className="w-screen h-screen fixed inset-0 bg-[#35333a7c] z-2 flex items-center justify-center">
                        <div className="relative bg-[#242229] p-6 rounded-lg shadow-xl w-[450px] flex flex-col gap-5">
                            <button
                                onClick={onClose}
                                className="absolute top-2 right-2 text-black text-xl  p-2 rounded-full cursor-pointer"
                            >
                                <X size={24} color='#873EFD' />
                            </button>
                            <h4 className='font-sans font-medium text-2xl'>{data.name}</h4>
                            <div className='p-3 flex flex-col gap-3 w-full bg-[#292730]'>
                                <p className='font-bold font-sans'>Name</p>
                                <div className='flex gap-2 items-center'>
                                    <div>
                                        <input ref={nameRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                            type="text" name="name" id="name" placeholder='Name' defaultValue={data.name} />
                                    </div>
                                </div>
                                {!data.isZone && <>
                                    <p className='font-bold font-sans'>Dimensions</p>
                                    <div className='flex gap-2 items-center'>
                                        <div>
                                            <input ref={lengthRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                                type="number" name="length" id="length" placeholder='Length' defaultValue={data.length.toFixed(2)} />
                                        </div>
                                        {data.isRoom && data.breadth &&
                                            <div>
                                                <input ref={breadthRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                                    type="number" name="breadth" id="breadth" placeholder='Breadth' defaultValue={data.breadth.toFixed(2)} />
                                            </div>}
                                        <div>
                                            <input ref={heightRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                                                type="number" name="height" id="height" placeholder='Height' defaultValue={data.height.toFixed(2)} />
                                        </div>
                                    </div>
                                </>}
                                <button className='bg-[#421C7F] hover:bg-[hsl(263,64%,40%)] transition w-full py-3 rounded font-sans cursor-pointer' onClick={handleSave}>Save</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    )
}
