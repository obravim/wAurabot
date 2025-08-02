import React, { useState, useEffect, useRef } from 'react'
import NextImage from 'next/image'
import { CheckCircle2, Eraser, Move, ZoomInIcon, ZoomOutIcon, DoorOpen, DoorClosed } from 'lucide-react'
import { useCanvas } from '@/app/context/CanvasContext'
import { useZone, Room, WinDoor, Zone, ZoneData } from '@/app/context/ZoneContext'
import Compass from './Compass';
import Canvas, { CanvasHandle, RectCoord } from './Canvas';

const DEFAULT_CEILING_HEIGHT_FT = 10;
const DEFAULT_WINDOW_HEIGHT_FT = 5;
const DEFAULT_DOOR_HEIGHT_FT = 8;

export type RoomRectType = {
    id: string;
    name: string;
    x: number;
    y: number;
    length: number;
    breadth: number;
    stroke: string;
    selected: boolean,
    zone: number | null,
    length_ft: number,
    breadth_ft: number,
    ceilingHeight_ft: number;
    children: WinDoorRectType[]
};

export type WinDoorRectType = {
    id: string;
    name: string,
    type: 'window' | 'door';
    x: number;
    y: number;
    length: number;
    breadth: number;
    stroke: string;
    length_ft: number;
    height_ft: number;
    horizontal: boolean
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

function getWinDoorFromCoords(rectCoords: RectCoord, id: string, display: string, type: 'door' | 'window', scaleFactor: number) {
    const [x1, y1] = rectCoords.startPoint;
    const [x2, y2] = rectCoords.endPoint;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const length = Math.abs(x2 - x1);
    const breadth = Math.abs(y2 - y1);
    const horizontal = length > breadth;
    const length_ft = Math.abs(horizontal ? length : breadth) * scaleFactor / 12;
    const height_ft = type === 'door' ? DEFAULT_DOOR_HEIGHT_FT : DEFAULT_WINDOW_HEIGHT_FT;
    return {
        id, name: display, type,
        pos: { x, y, length, breadth },
        stroke: rectCoords.color,
        dimension: { length_ft, height_ft },
        horizontal
    }
}

export function getRoomFromCoords({ roomCoords, id, display, scaleFactor, selected = false }: { roomCoords: RectCoord, id: string, display: string, scaleFactor: number, selected?: boolean }) {
    const [x1, y1] = roomCoords.startPoint;
    const [x2, y2] = roomCoords.endPoint;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const length = Math.abs(x2 - x1);
    const breadth = Math.abs(y2 - y1);
    let length_ft = Math.abs(x2 - x1) * scaleFactor / 12;
    let breadth_ft = Math.abs(y2 - y1) * scaleFactor / 12;
    let ceilingHeight_ft = DEFAULT_CEILING_HEIGHT_FT;
    return {
        id,
        name: display,
        pos: { x, y, length, breadth },
        stroke: roomCoords.color,
        selected: selected,
        zone: null,
        dimension: {
            length_ft,
            breadth_ft,
            ceilingHeight_ft
        },
        children: [],
        expanded: false
    }
}

export function forEachRoom(zoneData: ZoneData, callback: (room: Room) => void) {
    const { zones, orphanRoomIds, rooms } = zoneData;

    // Loop through rooms inside zones
    for (const zone of zones) {
        for (const roomId of zone.roomIds) {
            const room = rooms.get(roomId);
            if (room && callback(room)) return;
        }
    }

    // Loop through orphan rooms
    for (const roomId of orphanRoomIds) {
        const room = rooms.get(roomId);
        if (room && callback(room)) return;
    }
}


function findRoomForWinDoor(door: WinDoor, roomIds: string[], rooms: Map<string, Room>) {
    const doorCenterX = door.pos.x + door.pos.length / 2;
    const doorCenterY = door.pos.y + door.pos.breadth / 2;
    let proximity = 20;
    let i = 0;

    for (i = 0; i < roomIds.length; i++) {

        const room = rooms.get(roomIds[i]);
        if (!room) continue;
        //wall1
        let [x1, y1, x2, y2] = [room.pos.x, room.pos.y, room.pos.x + room.pos.length, room.pos.y + room.pos.breadth]
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
    const [roomRects, setRoomRects] = useState<RoomRectType[]>([]);
    const { zoneData, setZoneData } = useZone();
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [move, setMove] = useState(false);
    const canvasRef = useRef<CanvasHandle>(null);
    const [drawRect, setDrawRect] = useState<'none' | 'room' | 'door' | 'window'>('none');
    const ceilingHeightRef = useRef<HTMLInputElement>(null);
    const windowHeightRef = useRef<HTMLInputElement>(null);
    const doorHeightRef = useRef<HTMLInputElement>(null);

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
        const rooms: Map<string, Room> = new Map<string, Room>();
        const windoors: Map<string, WinDoor> = new Map<string, WinDoor>();
        const orphanRoomIds: string[] = [];
        if (roomCoords) roomCoords.forEach((room, index) => {
            const id = "R" + index;
            const display = "Room" + index;
            const tempRoom = getRoomFromCoords({ roomCoords: { startPoint: [room.startPoint[0], room.startPoint[1]], endPoint: [room.endPoint[0], room.endPoint[1]], color: room.color }, id, display, scaleFactor })
            rooms.set(id, tempRoom)
            orphanRoomIds.push(id);
            // roomRects.push(tempRoom);
        })
        if (doorCoords) doorCoords.forEach((door, index) => {
            const id = "D" + index;
            const display = "Door" + index;
            const tempDoor = getWinDoorFromCoords({ startPoint: [door.startPoint[0], door.startPoint[1]], endPoint: [door.endPoint[0], door.endPoint[1]], color: door.color }, id, display, 'door', scaleFactor);
            const roomIndex = findRoomForWinDoor(tempDoor, orphanRoomIds, rooms)
            const room = rooms.get(orphanRoomIds[roomIndex]);
            if (!room) return;
            room.children = [...room.children, id];
            rooms.set(orphanRoomIds[roomIndex], room);
            windoors.set(id, tempDoor)
        })
        if (windowCoords) windowCoords.forEach((window, index) => {
            const id = "W" + index;
            const display = "Window" + index;
            const tempWindow = getWinDoorFromCoords({ startPoint: [window.startPoint[0], window.startPoint[1]], endPoint: [window.endPoint[0], window.endPoint[1]], color: window.color }, id, display, 'window', scaleFactor)
            const roomIndex = findRoomForWinDoor(tempWindow, orphanRoomIds, rooms)
            const room = rooms.get(orphanRoomIds[roomIndex]);
            if (!room) return;
            room.children = [...room.children, id];
            rooms.set(orphanRoomIds[roomIndex], room);
            windoors.set(id, tempWindow)
        })
        const sortedRects = [...orphanRoomIds].sort((a, b) => {
            const roomA = rooms.get(a);
            const roomB = rooms.get(b);
            if (!roomA || !roomB) return 0;
            // Smaller rectangles on top
            const aSize = Math.abs(roomA.pos.length) * Math.abs(roomA.pos.breadth);
            const bSize = Math.abs(roomB.pos.length) * Math.abs(roomB.pos.breadth);
            return bSize - aSize;
        });
        setZoneData({ zones: [], orphanRoomIds: orphanRoomIds, rooms: rooms, windoors: windoors })
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

    const toggleDraw = (type: 'door' | 'window' | 'room') => {
        if (drawRect == 'none') {
            setDrawRect(type)
            setMove(false)
        }
        else if (drawRect == type) {
            setDrawRect('none')
        }
        else {
            setDrawRect(type);
        }
    }

    const handleApplyAll = () => {

        const ceilingRef = ceilingHeightRef.current
        const windowRef = windowHeightRef.current
        const doorRef = doorHeightRef.current
        if (!ceilingRef || !windowRef || !doorRef) return;

        const ceilingHeight = ceilingRef.value.trim();
        const windowHeight = windowRef.value.trim();
        const doorHeight = doorRef.value.trim();

        if (!ceilingHeight && !windowHeight && !doorHeight) return
        setZoneData(zoneData => {
            let updatedWindoors = new Map(zoneData.windoors);
            let updatedRooms = new Map(zoneData.rooms);

            if (ceilingHeight) {
                for (const [id, room] of updatedRooms.entries()) {
                    updatedRooms.set(id, { ...room, dimension: { ...room.dimension, ceilingHeight_ft: parseFloat(ceilingHeight) } });
                }
            }
            if (windowHeight || doorHeight) {
                for (const [id, room] of updatedWindoors.entries()) {
                    if (windowHeight && room.type === 'window') updatedWindoors.set(id, { ...room, dimension: { ...room.dimension, height_ft: parseFloat(windowHeight) } });
                    if (doorHeight && room.type === 'door') updatedWindoors.set(id, { ...room, dimension: { ...room.dimension, height_ft: parseFloat(doorHeight) } });
                }
            }
            return {
                ...zoneData, rooms: updatedRooms, windoors: updatedWindoors
            };
        })
        ceilingRef.value = "";
        windowRef.value = "";
        doorRef.value = "";
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
                            <button className='flex items-center justify-center bg-[#35333A] active:bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
                                onClick={() => canvasRef.current?.zoomStage("in", 1.1)}
                            >
                                <ZoomInIcon size={20} />
                            </button>
                            <button className='flex items-center justify-center bg-[#35333A] active:bg-[#421C7F] px-3 py-1.5 rounded-md cursor-pointer'
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
                            onClick={() => toggleDraw('room')}
                        >
                            <DoorOpen size={20} />
                            <span className="leading-none mt-0 text-sm">Draw Room</span>

                        </button>
                        <button className={`flex items-center justify-center ${drawRect == 'window' ? "bg-[#421C7F]" : "bg-[#35333A]"}   text-[#E7E6E9] px-5 py-2 rounded-md gap-2 cursor-pointer`}
                            onClick={() => toggleDraw('window')}
                        >
                            <NextImage src={'./window-frame.svg'} alt='logo' width={14} height={14} className='w-[14px] h-[14px]' />
                            <span className="leading-none mt-0 text-sm">Draw Window</span>
                        </button>
                        <button className={`flex items-center justify-center ${drawRect == 'door' ? "bg-[#421C7F]" : "bg-[#35333A]"}  text-[#E7E6E9] px-5 py-2 rounded-md gap-2 cursor-pointer`}
                            onClick={() => toggleDraw('door')}
                        >
                            <DoorClosed size={20} />
                            <span className="leading-none mt-0 text-sm">Draw Door</span>
                        </button>
                    </div>
                </div>
                <div className='p-6 bg-[#292730] rounded-xl w-full mt-4'>
                    <div className='flex gap-8 mb-5 flex-col'>
                        <div className='flex items-center gap-4'>
                            <div className='flex flex-col'>
                                <h4 className='mb-3 font-bold'>Ceiling Height</h4>
                                <input ref={ceilingHeightRef} type="number" name="ceiling-height" id="ceiling-height" placeholder='HEIGHT'
                                    className='w-full bg-[#313131] rounded-md text-sm border-1 border-[#585656] px-3 py-2.5 focus:ring-0
                             focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'/>
                            </div>
                            <div className='flex flex-col'>
                                <h4 className='mb-3 font-bold'>Window Height</h4>
                                <input ref={windowHeightRef} type="number" name="window-height" id="window-height" placeholder='HEIGHT'
                                    className='w-full bg-[#313131] rounded-md text-sm border-1 border-[#585656] px-3 py-2.5 focus:ring-0
                             focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'/>
                            </div>
                            <div className='flex flex-col'>
                                <h4 className='mb-3 font-bold'>Door Height</h4>
                                <input ref={doorHeightRef} type="number" name="door-height" id="door-height" placeholder='HEIGHT'
                                    className='w-full bg-[#313131] rounded-md text-sm border-1 border-[#585656] px-3 py-2.5 focus:ring-0
                             focus:border-[hsl(0,1%,54%)] focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'/>
                            </div>
                        </div>
                        <div className='flex items-center gap-4 justify-stretch'>
                            <div className='grow flex flex-col'>
                                <h4 className='mb-3 font-bold'>Ceiling Type</h4>
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
                            <div className='grow flex flex-col'>
                                <h4 className='mb-3 font-bold'>Wall Type</h4>
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
                            <div className='grow flex flex-col'>
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
                        </div>
                    </div>
                    <button className='fonts-sans font-medium py-3 bg-[#421c7f] rounded-md w-full hover:bg-[#6c2ed1] transition cursor-pointer' onClick={handleApplyAll}>Apply to All</button>
                </div>
            </div>
        </div>
    )
}
