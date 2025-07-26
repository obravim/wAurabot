import React, { useState, useEffect, useRef } from 'react'
import NextImage from 'next/image'
import { CheckCircle2, Eraser, Move, ZoomInIcon, ZoomOutIcon, DoorOpen, DoorClosed } from 'lucide-react'
import { useCanvas } from '@/app/context/CanvasContext'
import { useZone } from '@/app/context/ZoneContext'
import Compass from './Compass';
import Canvas, { CanvasHandle } from './Canvas';

function fileToImage(file: File | null): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        if (!file) {
            reject("File is null!");
            return;
        }
        const reader = new FileReader();


        reader.onload = () => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (err) => reject(err);
            img.src = reader.result as string;
        };

        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
    });
}

export default function EditView() {
    const { file, scaleFactor, roomCoords, doorCoords, windowCoords, setScaleFactor, setRoomCoords, setDoorCoords, setWindowCoords } = useCanvas();
    const { setZones } = useZone();
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [move, setMove] = useState(false);
    const canvasRef = useRef<CanvasHandle>(null);
    const [drawRect, setDrawRect] = useState<'none' | 'room' | 'door' | 'window'>('none')

    useEffect(() => {
        (async () => {
            try {
                const img = await fileToImage(file);
                setImage(img);
            } catch (err) {
                console.error('Failed to load image:', err);
            }
        })();
    }, [file]);

    const reRunDetection = async () => {
        const formData = new FormData();
        formData.append('image', file as Blob);

        fetch('/api/scale', {
            method: 'POST',
            body: formData,
        }).then(res => res.json()).then(data => {
            const resp = data.response;
            setScaleFactor(resp.scaleFactor);
            setRoomCoords(resp.roomCoords);
            setDoorCoords(resp.doorCoords);
            setWindowCoords(resp.windowsCoords);
            setZones([])
        });
    }

    return (
        <div className="flex grow items-center mt-8 mb-16 flex-col gap-8">
            <div className='flex justify-center items-center grow justify-self-stretch-stretch w-full relative'>
                <button className='absolute left-0 font-sans px-8 py-2 flex gap-2 items-center justify-center
                 bg-[#873EFD] rounded-md hover:bg-[hsl(263,98%,72%)] cursor-pointer transition z-10 '
                    onClick={reRunDetection}>
                    Re-Run Detection
                </button>
                <div className=' p-2.5 pl-4 pr-8 flex gap-3 items-center bg-[#56BC49] rounded-lg border-2 border-[#38FF2A]'>
                    <CheckCircle2 size={28} />
                    <div className='flex flex-col font-sans'>
                        <p className='font-semibold'>Successfully Scaled to {scaleFactor && scaleFactor.toFixed(2)}x</p>
                        <p className='text-sm'>Next run detection</p>
                    </div>
                </div>
            </div>
            <div className='p-8 bg-[#242229] flex flex-col gap-6 rounded-lg w-[714px]'>
                <div className='flex gap-8 justify-start'>
                    <Compass />
                    <div className='p-4 bg-[#292730] rounded-xl w-full mt-[32px]'>
                        <h4 className='mb-1 font-bold'>Tools</h4>
                        <p className='text-sm text-[#873efd] font-figtree mb-3 font-medium'>Tip: Zoom in to increase accuary when drawing the scale line.</p>
                        <div className="flex gap-3 items-center">
                            <button className='flex items-center justify-center bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
                                onClick={() => canvasRef.current?.zoomStage("in", 1.1)}
                            >
                                <ZoomInIcon size={20} />
                            </button>
                            <button className='flex items-center justify-center bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
                                onClick={() => canvasRef.current?.zoomStage("out", 1.1)}
                            >
                                <ZoomOutIcon size={20} />
                            </button>
                            <button className={`flex items-center justify-center ${move ? "bg-[#421C7F]" : "bg-[#35333A]"}  text-[#E7E6E9] px-3 py-1.5 rounded-md gap-1.5 cursor-pointer`}
                                onClick={() => setMove(move => !move)}
                            >
                                <Move size={20} />
                                <span className="leading-none mt-0 text-sm">Move</span>
                            </button>
                            <button className='flex items-center justify-center bg-[#35333A] text-[#E7E6E9] px-3 py-1.5 rounded-md gap-1.5 cursor-pointer'
                                onClick={() => canvasRef.current?.handleDelete()}
                            >
                                <Eraser size={20} />
                                <span className="leading-none mt-0 text-sm">Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className='w-[650px] h-[650px]'>
                    <Canvas ref={canvasRef} move={move} image={image} stageSize={{ width: 650, height: 650 }} setInputModelOpen={null} setPixelDist={null} drawRect={drawRect} />
                </div>
                <div className='p-6 bg-[#292730] rounded-xl'>
                    <h4 className='mb-3 font-bold'>Drawing Tools</h4>
                    <p className='text-sm text-[#873efd] font-figtree mb-3 wrap-break-word font-medium'>Choose a pencil according to the type of object you want to point out in the image for the auto scale.</p>
                    <div className="flex gap-3 items-center w-full justify-between">
                        <button className={`flex items-center justify-center ${drawRect == 'room' ? "bg-[#421C7F]" : "bg-[#35333A]"}  px-5 py-2 gap-2 rounded-md cursor-pointer`}
                            onClick={() => setDrawRect((drawRect) => drawRect == 'room' ? 'none' : 'room')}
                        >
                            <DoorOpen size={20} />
                            <span className="leading-none mt-0 text-sm">Draw Room</span>

                        </button>
                        <button className={`flex items-center justify-center ${drawRect == 'window' ? "bg-[#421C7F]" : "bg-[#35333A]"}   text-[#E7E6E9] px-5 py-2 rounded-md gap-2 cursor-pointer`}
                            onClick={() => setDrawRect((drawRect) => drawRect == 'window' ? 'none' : 'window')}
                        >
                            <NextImage src={'./window-frame.svg'} alt='logo' width={14} height={14} />
                            <span className="leading-none mt-0 text-sm">Draw Window</span>
                        </button>
                        <button className={`flex items-center justify-center ${drawRect == 'door' ? "bg-[#421C7F]" : "bg-[#35333A]"}  text-[#E7E6E9] px-5 py-2 rounded-md gap-2 cursor-pointer`}
                            onClick={() => setDrawRect((drawRect) => drawRect == 'door' ? 'none' : 'door')}
                        >
                            <DoorClosed size={20} />
                            <span className="leading-none mt-0 text-sm">Draw Door</span>
                        </button>
                    </div>
                </div>
                <div className='p-6 bg-[#292730] rounded-xl w-full mt-4'>
                    <div className='flex gap-8 mb-5'>
                        <div className='w-full flex flex-col'>
                            <h4 className='mb-3 font-bold'>Icee</h4>
                            <select name="icee" id="icee"
                                className='text-sm bg-[#313131] rounded-md px-3 py-2.5 focus:ring-0
                             focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'>
                                <option value="2018" className='bg-[#585656]'>2018</option>
                                <option value="2019" className='bg-[#585656]'>2019</option>
                                <option value="2020" className='bg-[#585656]'>2020</option>
                                <option value="2021" className='bg-[#585656]'>2021</option>
                            </select>
                        </div>
                        <div className='w-full flex flex-col'>
                            <h4 className='mb-3 font-bold'>Ceiling Height</h4>
                            <input type="number" name="height" id="height" placeholder='HEIGHT'
                                className='bg-[#313131] rounded-md text-sm border-1 border-[#585656] px-3 py-2.5 focus:ring-0
                             focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'/>
                        </div>
                    </div>
                    <button className='fonts-sans font-medium py-3 bg-[#421c7f] rounded-md w-full hover:bg-[#6c2ed1] transition cursor-pointer'>CALCULATE</button>

                </div>
            </div>
        </div>
    )
}
