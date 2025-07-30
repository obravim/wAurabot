"use client"

import { ZoomInIcon, ZoomOutIcon, Move, Eraser, Eye, RefreshCcw, X, TriangleAlert } from 'lucide-react'
import Canvas, { CanvasHandle } from './Canvas';
import { useCanvas } from '@/app/context/CanvasContext';
import { useEffect, useState, useRef } from 'react';
import { useStep } from '@/app/context/StepContext';

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

function formatBytes(bytes: number | undefined): string {
    if (bytes == undefined) {
        return ""
    }
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function ScaleView() {
    const { file, setCanvasFile, setScaleFactor, setRoomCoords } = useCanvas();
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [inputModelOpen, setinputModelOpen] = useState(false);
    const canvasRef = useRef<CanvasHandle>(null);
    const [move, setMove] = useState(false);
    const feetRef = useRef<HTMLInputElement>(null);
    const inchRef = useRef<HTMLInputElement>(null);
    const [pixelDist, setpixelDist] = useState<number>(0);
    const [result, setResult] = useState<{ feet: number, inch: number } | null>(null);
    const { setStep } = useStep();

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

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCanvasFile(e.target.files[0]);
        }

        const formData = new FormData();
        formData.append('image', file as Blob);

        fetch('/api/scale', {
            method: 'POST',
            body: formData,
        }).then(res => res.json()).then(data => {
            const resp = data.response;
            setScaleFactor(resp.scaleFactor);
            setRoomCoords(resp.roomCoords);
        });

        // const data = await res.json();
        // console.log(data);
    };

    const handleApply = async () => {
        
        if (!result || pixelDist == 0) {
            alert("Draw a line over a known-length object to manually scale.")
            return;
        }

        const {feet,inch} = result;
        const totalInch = feet*12 + inch;
        const scaleFactor = totalInch/pixelDist

        fetch('/api/detect', {
            method: 'POST',
            body: JSON.stringify({
                scaleFactor
            }),
        }).then(res => res.json()).then(data => {
            const resp = data.response;
            setScaleFactor(resp.scaleFactor);
            setRoomCoords(resp.roomCoords);
            setStep(2);
        });
    }

    const handleSaveDimens = () => {
        if (!feetRef.current || !inchRef.current) {
            return;
        }
        const feet = parseInt(feetRef.current.value.trim() == "" ? '0' : feetRef.current.value.trim());
        const inch = parseFloat(inchRef.current.value.trim() == "" ? '0' : inchRef.current.value.trim());

        if (feet == 0 && inch == 0) {
            return;
        }
        if (inch >= 12) {
            alert("Enter a valid value for inch!");
            return;
        }
        setResult({ feet, inch })
        canvasRef.current?.setDimText(`${feet}'-${inch}"`)
        setinputModelOpen(false);
    }


    return (
        <div className="flex justify-center grow items-center mt-8 flex-col gap-8">
            <div className='p-2.5 px-4 flex gap-2 items-center bg-[#E13131] rounded-lg border-2 border-[#FF2A2A]'>
                <TriangleAlert size={28} />
                <div className='flex flex-col font-sans'>
                    <p className='font-semibold'>Auto-scale failed</p>
                    <p className='text-sm'>Please calibrate manually to continue</p>
                </div>
            </div>
            <div className='p-8 bg-[#242229] flex flex-col gap-6 rounded-lg'>
                {/* top row */}
                <div className='w-full flex justify-between gap-8'>
                    {/* title div */}
                    <div className=''>
                        <h2 className='text-2xl mb-2'>
                            Manual Scale Drawing Tool
                        </h2>
                        <p className='text-sm text-[#873efd] font-figtree'>Draw a line over a known-length object to manually scale.</p>
                    </div>
                    {/* tools sections */}
                    <div className='p-4 bg-[#292730] rounded-xl'>
                        <h4 className='mb-4 font-bold'>Tools</h4>
                        <div className="flex gap-3 items-center">
                            <button className='flex items-center justify-center bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
                                onClick={() => canvasRef.current?.zoomStage("in", 1.1)}>
                                <ZoomInIcon size={20} />
                            </button>
                            <button className='flex items-center justify-center bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
                                onClick={() => canvasRef.current?.zoomStage("out", 1.1)}>
                                <ZoomOutIcon size={20} />
                            </button>
                            <button className={`flex items-center justify-center ${move ? "bg-[#421C7F]" : "bg-[#35333A]"}  text-[#E7E6E9] px-3 py-1.5 rounded-md gap-1.5 cursor-pointer`}
                                onClick={() => setMove(move => !move)}>
                                <Move size={20} />
                                <span className="leading-none mt-0 text-sm">Move</span>
                            </button>
                            <button className='flex items-center justify-center bg-[#35333A] text-[#E7E6E9] px-3 py-1.5 rounded-md gap-1.5 cursor-pointer'
                                onClick={() => canvasRef.current?.handleDelete()}>
                                <Eraser size={20} />
                                <span className="leading-none mt-0 text-sm">Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
                {/* canvas section */}
                <div className='w-[800px] rounded-2xl h-[800px]  mt-6 overflow-hidden flex items-center justify-center bg-[#6b6775]'>
                    <Canvas image={image} ref={canvasRef} move={move} setInputModelOpen={setinputModelOpen} setPixelDist={setpixelDist} stageSize={{ width: 800, height: 800 }} drawRect='none' rects={[]} setRects={()=>{}}/>
                </div>
                <p className='text-center font-figtree'>
                    Once you&#39;ve defined a known-length reference, click <span className='text-[#873EFD]'>Apply Scale</span> to begin detection.
                </p>
                <div className='w-full flex gap-6'>
                    <button onClick={handleApply} className='fonts-sans font-medium py-3 bg-[#421c7f] rounded-md w-full hover:bg-[#6c2ed1] transition cursor-pointer'>Apply Scale</button>
                </div>
            </div>
            {/* image information */}
            <div className='flex flex-col w-[914px] gap-2 mb-20'>
                <h3 className='font-medium text-2xl'>Information from the Image</h3>
                <div className='font-figtree'>
                    <p className=''>{file?.name}</p>
                    <p className='text-sm text-[#999999]'>{formatBytes(file?.size)}</p>
                </div>
                <p>Format : {file?.type}</p>
                <p>Resolution : {image?.width} x {image?.height}</p>
                <div className='flex gap-4 my-2'>
                    <button className='font-sans px-8 py-2 flex gap-2 items-center justify-center bg-[#35333A] rounded-md hover:bg-[hsl(258,6%,30%)] cursor-pointer transition '
                        onClick={() => setPreviewOpen(true)}
                    >
                        <Eye size={16} /> <span className='mt-0'>Preview</span>
                    </button>
                    <label
                        htmlFor="file-upload-replace" className='font-sans px-8 py-2 flex gap-2 items-center justify-center bg-[#35333A] rounded-md hover:bg-[hsl(258,6%,30%)] cursor-pointer transition '>
                        <RefreshCcw size={16} /> <span className='mt-0'>Replace</span>
                        <input
                            id="file-upload-replace"
                            type="file"
                            accept=".jpg,.jpeg,.png,.heic,.avif"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                </div>
            </div>
            {/* Preview Modal */}
            {
                previewOpen && (
                    <div className="fixed inset-0 bg-[#35333A] bg-opacity-70 z-50 flex items-center justify-center">
                        <div className="relative bg-white p-2 rounded shadow-xl max-w-[90%] max-h-[90%]">
                            <button
                                onClick={() => setPreviewOpen(false)}
                                className="absolute top-2 right-2 text-black text-xl bg-white p-2 rounded-full cursor-pointer"
                            >
                                <X size={24} />
                            </button>
                            {image?.src && <img
                                src={image.src}
                                alt="Full view"
                                className="max-h-[80vh] max-w-[80vw] object-contain"
                            />}
                        </div>
                    </div>
                )
            }
            {/* input model */}
            {
                inputModelOpen && (
                    <div className="fixed inset-0 bg-[#35333a7c] z-2 flex items-center justify-center">
                        <div className="relative bg-[#242229] p-6 rounded-lg shadow-xl w-[450px] flex flex-col gap-5">
                            <button
                                onClick={() => { canvasRef.current?.handleDelete(); setinputModelOpen(false) }}
                                className="absolute top-2 right-2 text-black text-xl  p-2 rounded-full cursor-pointer"
                            >
                                <X size={24} color='#873EFD' />
                            </button>
                            <h4 className='font-sans font-medium text-2xl'>Input Dimensions</h4>
                            <div className='p-3 flex flex-col gap-3 w-full bg-[#292730]'>
                                <p className='font-bold font-sans'>Dimensions</p>
                                <div className='flex gap-2 items-center'>
                                    <div>
                                        <input ref={feetRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' type="number" name="feet" id="feet" placeholder='Feet' />
                                    </div>
                                    <div>
                                        <input ref={inchRef} className='text-sm w-24 border-1 border-[#585656] rounded-sm px-3 py-2.5 focus:ring-0 focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' type="number" name="inches" id="inches" placeholder='Inches' />
                                    </div>
                                </div>
                                <button className='bg-[#421C7F] hover:bg-[hsl(263,64%,40%)] transition w-full py-3 rounded font-sans cursor-pointer' onClick={handleSaveDimens}>Save</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default ScaleView