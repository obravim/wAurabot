import React, { useState, useEffect, useRef } from 'react'
import NextImage from 'next/image'
import { CheckCircle2, Eraser, Move, ZoomInIcon, ZoomOutIcon, DoorOpen, DoorClosed } from 'lucide-react'
import { useCanvas } from '@/app/context/CanvasContext'
import { useZone, Room } from '@/app/context/ZoneContext'
import Compass from './Compass';
import Canvas, { CanvasHandle, RoomCoord } from './Canvas';

export type RectType = {
    id: string;
    name: string;
    type: 'room' | 'door' | 'window';
    x: number;
    y: number;
    width: number;
    height: number;
    stroke: string;
    selected: boolean,
    zone: number | null,
    width_ft: number,
    height_ft: number,
};

type WinDoor = {
    id: string,
    type: 'window' | 'door',
    length: Length
}

type Length = {
    feet: number | null,
    inch: number | null
}

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

function getRectFromCoords(roomCoords: RoomCoord, id: string, display: string, type: 'room' | 'door' | 'window', scaleFactor: number) {
    const [x1, y1] = roomCoords.startPoint;
    const [x2, y2] = roomCoords.endPoint;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    let width_ft = Math.abs(x2 - x1) * scaleFactor / 12;
    let height_ft = 0;
    if (type == 'room') {
        height_ft = Math.abs(y2 - y1) * scaleFactor / 12;
    }
    return {
        id, name: display, x, y, width, type, stroke: roomCoords.color, height, selected: false, zone: null, width_ft, height_ft
    }
}

function findRoomForDoor(door: RectType, rooms: RectType[], type: string) {
    const doorCenterX = door.x + door.width / 2;
    const doorCenterY = door.y + door.height / 2;
    let proximity = 20;
    let i = 0;

    for (i = 0; i < rooms.length; i++) {
        //wall1
        let [x1, y1, x2, y2] = [rooms[i].x, rooms[i].y, rooms[i].x + rooms[i].width, rooms[i].y + rooms[i].height]
        if (doorCenterX >= x1 && doorCenterX <= x2 && Math.abs(doorCenterY - y1) < proximity) {
            return i;
        } else if (doorCenterX >= x1 && doorCenterX <= x2 && Math.abs(doorCenterY - y2) < proximity) {
            return i;
        } else if (doorCenterY >= y1 && doorCenterY <= y2 && Math.abs(doorCenterX - x1) < proximity) {
            return i;
        } else if (doorCenterY >= y1 && doorCenterY <= y2 && Math.abs(doorCenterX - x2) < proximity) {
            return i;
        }
    }
    return i - 1;
}

export default function EditView() {
    const { file, scaleFactor, roomCoords, doorCoords, windowCoords, setScaleFactor, setRoomCoords, setDoorCoords, setWindowCoords } = useCanvas();
    const [rects, setRects] = useState<RectType[]>([]);
    const { setZoneData } = useZone();
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

    useEffect(() => {
        const roomsRect: RectType[] = [];
        const doorsRect: RectType[] = [];
        const windowsRect: RectType[] = [];
        const rooms: Room[] = [];
        if (roomCoords) roomCoords.forEach((room, index) => {
            const id = "R" + index;
            const display = "Room" + index;
            const tempRoom = getRectFromCoords({ startPoint: [room.startPoint[0], room.startPoint[1]], endPoint: [room.endPoint[0], room.endPoint[1]], color: room.color }, id, display, 'room', scaleFactor)
            rooms.push({ id: tempRoom.id, name: display, dimension: { length: { feet: tempRoom.width_ft, inch: 0 }, breadth: { feet: tempRoom.height_ft, inch: 0 } }, child: [], expanded: false, area: { feetSq: tempRoom.width_ft * tempRoom.height_ft, inchSq: 0 } });
            roomsRect.push(tempRoom);
        })
        if (doorCoords) doorCoords.forEach((door, index) => {
            const id = "D" + index;
            const display = "Door" + index;
            const tempDoor = getRectFromCoords({ startPoint: [door.startPoint[0], door.startPoint[1]], endPoint: [door.endPoint[0], door.endPoint[1]], color: door.color }, id, display, 'door', scaleFactor);
            doorsRect.push(tempDoor);
            const roomIndex = findRoomForDoor(tempDoor, roomsRect, 'door')
            rooms[roomIndex].child?.push({ id: tempDoor.id, name: display, length: { feet: tempDoor.width_ft, inch: 0 }, type: "door" })
        })
        if (windowCoords) windowCoords.forEach((window, index) => {
            const id = "W" + index;
            const display = "Window" + index;
            const tempWindow = getRectFromCoords({ startPoint: [window.startPoint[0], window.startPoint[1]], endPoint: [window.endPoint[0], window.endPoint[1]], color: window.color }, id, display, 'window', scaleFactor)
            windowsRect.push(tempWindow);
            const roomIndex = findRoomForDoor(tempWindow, roomsRect, 'window')
            rooms[roomIndex].child?.push({ id: tempWindow.id, name: display, length: { feet: tempWindow.width_ft, inch: 0 }, type: "window" })
        })

        const sortedRects = [...roomsRect, ...doorsRect, ...windowsRect].sort((a, b) => {
            // Smaller rectangles on top
            const aSize = Math.abs(a.width) * Math.abs(a.height);
            const bSize = Math.abs(b.width) * Math.abs(b.height);
            return bSize - aSize;
        });
        setRects(sortedRects);
        setZoneData({ zones: [], rooms: rooms })
    }, [scaleFactor, roomCoords, doorCoords, windowCoords])

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
                    <Canvas ref={canvasRef} move={move} image={image} stageSize={{ width: 650, height: 650 }} setInputModelOpen={null} setPixelDist={null} drawRect={drawRect} rects={rects} setRects={setRects} />
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
                            <NextImage src={'./window-frame.svg'} alt='logo' width={14} height={14} className='w-auto h-auto' />
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
