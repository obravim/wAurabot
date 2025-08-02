import React, { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Drag from './Icons/Drag'
import WindowFrame from './Icons/WindowFrame'
import { ChevronDown, DoorOpen, EditIcon, Search, Plus, Check, Delete, DeleteIcon, Trash } from 'lucide-react'
import { useZone, ZoneData, Zone } from '@/app/context/ZoneContext'
import EditModel, { EditModelDataType } from './EditModel'
import { unSelectRooms } from "./Canvas"
import { useCanvas } from '@/app/context/CanvasContext'

function calculateTotalRoomArea(zoneData: ZoneData): number {
    let total = 0;

    zoneData.rooms.forEach((room) => {
        total += room.dimension.length_ft * room.dimension.breadth_ft;
    });

    return total;
}
export default function EditZone() {
    const { zoneData, setZoneData, multiSelect, setMultiSelect } = useZone();
    const { scaleFactor } = useCanvas();
    // const [zoneDataUI, setZoneDataUI] = useState<ZoneData>({ zones: [], rooms: [] });
    const [editModelOpen, setEditModelOpen] = useState(false);
    const editModelData = useRef<EditModelDataType>({ itemId: "", breadth: 0, height: 0, length: 0, isRoom: true, name: "Input", isZone: false })
    const [isTotalAreaOpen, setIsTotalAreaOpen] = useState(false)
    const totalAreaRef = useRef(0);

    // useEffect(()=>{
    //     totalAreaRef.current=
    // })

    useEffect(() => {
        //on multiselect change
        if (!multiSelect) {
            const selectedRoomIds = Array.from(zoneData.rooms.values())
                .filter(room => room.selected && room.zone == null)
                .map(room => room.id);
            if (selectedRoomIds.length === 0) {
                return;
            }

            const newZone: Zone = {
                id: "zone" + zoneData.zones.length,
                roomIds: selectedRoomIds,
                color: "black",
                expanded: false,
                name: "Zone" + zoneData.zones.length
            };

            setZoneData(prev => {
                const updatedRooms = new Map(prev.rooms);
                const updatedOrphans = prev.orphanRoomIds.filter(id => !selectedRoomIds.includes(id));

                // update zone reference inside each room
                selectedRoomIds.forEach(id => {
                    const room = updatedRooms.get(id);
                    if (room) {
                        updatedRooms.set(id, { ...room, zone: newZone.id, selected: false });
                    }
                });

                return {
                    ...prev,
                    zones: [...prev.zones, newZone],
                    rooms: updatedRooms,
                    orphanRoomIds: updatedOrphans,
                };
            });
        }
    }, [multiSelect])

    function toggleZoneExpand(index: number) {
        setZoneData(zoneData => {
            return { ...zoneData, zones: zoneData.zones.map((zone, i) => i === index ? { ...zone, expanded: !zone.expanded } : zone) }
        })
    }

    function toggleRoomExpand(roomId: string) {
        const room = zoneData.rooms.get(roomId);
        if (!room) return;
        room.expanded = !room.expanded;

        setZoneData(zoneData => {
            const rooms = new Map(zoneData.rooms);
            rooms.set(room.id, room);
            return { ...zoneData, rooms: rooms }
        })
    }

    function openModel(data: EditModelDataType) {
        editModelData.current = data;
        setEditModelOpen(true)
    }

    function closeModel() {
        setEditModelOpen(false)
    }

    function editValues(data: EditModelDataType) {
        setZoneData(prev => {
            if (data.isZone) {
                const updatedZones = [...prev.zones];

                const zoneIndex = updatedZones.findIndex(zone => zone.id == data.itemId);
                if (zoneIndex == -1) return prev;
                const newZone = { ...updatedZones[zoneIndex] }
                newZone.name = data.name
                updatedZones[zoneIndex] = newZone

                return {
                    ...prev,
                    zones: updatedZones,
                };
            }
            else if (data.isRoom) {
                const updatedRooms = new Map(prev.rooms);
                const room = updatedRooms.get(data.itemId);
                if (!room) return prev;

                updatedRooms.set(data.itemId, {
                    ...room,
                    name: data.name,
                    dimension: {
                        length_ft: data.length,
                        breadth_ft: data.breadth ?? 0,
                        ceilingHeight_ft: data.height,
                    },
                    pos: {
                        ...room.pos,
                        length: data.length * 12 / scaleFactor,
                        breadth: data.breadth ? data.breadth * 12 / scaleFactor : room.pos.breadth
                    }
                });
                return {
                    ...prev,
                    rooms: updatedRooms,
                };
            } else {
                const updatedWindoors = new Map(prev.windoors);
                const windoor = updatedWindoors.get(data.itemId);
                if (!windoor) return prev;

                updatedWindoors.set(data.itemId, {
                    ...windoor,
                    name: data.name,
                    dimension: {
                        length_ft: data.length,
                        height_ft: data.height,
                    },
                    pos: {
                        ...windoor.pos,
                        length: data.length * 12 / scaleFactor,
                        breadth: data.breadth ? data.breadth * 12 / scaleFactor : windoor.pos.breadth
                    }
                });
                return {
                    ...prev,
                    windoors: updatedWindoors,

                };
            }
        });
        setEditModelOpen(false)
    }

    function deleteZoneById(zoneId: string) {
        setZoneData(prev => {
            const updatedZones = prev.zones.filter(zone => zone.id !== zoneId);

            const deletedZone = prev.zones.find(zone => zone.id === zoneId);
            if (!deletedZone) return prev;

            const orphanedRooms = deletedZone.roomIds;

            const updatedOrphans = [...prev.orphanRoomIds, ...orphanedRooms];

            return {
                ...prev,
                zones: updatedZones,
                orphanRoomIds: updatedOrphans,
            };
        });
    }

    return (
        <div className='flex flex-col w-full bg-[#191919] h-full gap-4'>
            <div className='px-[30px] py-[20px] bg-[#421C7F] flex items-center justify-between'>
                <h3 className='font-medium text-xl flex items-center gap-2'>
                    <Image src={"/editzone.svg"} alt={"icon-editzone"} width={20} height={20} />
                    Edit Zone
                </h3>
                <div className='flex items-center'>
                    <button className='bg-white rounded-full overflow-hidden cursor-pointer p-0.5'
                        onClick={() => setMultiSelect(multiSelect => !multiSelect)}
                    >
                        {multiSelect ? <Check width={24} color='#421C7F' height={24} /> : <Plus width={24} color='#421C7F' height={24} />}
                    </button>
                    {/* <button>
                        <ChevronDown width={32} />
                    </button> */}
                </div>
            </div>
            <div className='mt-4 flex flex-col gap-4 px-4'>
                <div className='bg-[#313131] rounded-lg text-sm border-1 border-[#585656] px-3 py-2.5
                             focus:border-[hsl(0,1%,54%)] flex items-center p-1 gap-2'>
                    <Search size={16} color='#7C7C7C' />
                    <input className='focus:ring-0 focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none' type="text" name="search" id="search" placeholder='Search' />
                </div>
                <div className='bg-[#1F1F1F] rounded-lg p-4 flex flex-col gap-4 items-stretch'>
                    <div className='flex gap-2 items-center'>
                        <Image src={"/drag.svg"} alt="move item" width={16} height={16} />
                        <div>
                            <h5 className='text-sm'>
                                Drag & drop:
                            </h5>
                            <p className='text-xs break-words whitespace-break-spaces'>
                                Hold down an element and drag it to change its order.
                            </p>
                        </div>
                    </div>
                    <hr className="border-t border-[#36343E] w-full bg-[#36343E]" />
                    <div className='flex gap-2 items-center'>
                        {/* <Image src={"/drag.svg"} alt="move item" width={16} height={16} /> */}
                        <EditIcon size={18} />
                        <div>
                            <h5 className='text-sm'>
                                Edit:
                            </h5>
                            <p className='text-xs break-words whitespace-break-spaces'>
                                You can switch to information about each object.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            {/* zone section */}
            <div className='flex flex-col gap-2 w-full mt-2'>
                {
                    zoneData.zones ? zoneData.zones.map((zone, index) => {
                        return <div key={index} className=''>
                            {
                                zone.expanded ?
                                    <div className='cursor-auto flex flex-col gap-4'>
                                        <div className='px-6 py-3 hover:bg-[rgb(51,51,51)] flex items-center justify-between cursor-pointer'
                                            onClick={() => toggleZoneExpand(index)}
                                        >
                                            <p className='text-sm font-medium text-[#873EFD]'>{zone.name}</p>
                                            <div className='flex items-center gap-2'>
                                                <button onClick={() => deleteZoneById(zone.id)}><Trash size={14} color={"#873EFD"} /></button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); openModel({ itemId: zone.id, name: zone.name, isZone: true, isRoom: false, length: 0, breadth: 0, height: 0 }) }}
                                                ><EditIcon size={14} color={"#873EFD"} /></button>
                                                <button><ChevronDown size={20} color='#873EFD' className="rotate-180" /></button>
                                            </div>
                                        </div>
                                        {
                                            zone.roomIds && zone.roomIds.map((roomId, roomIndex) => {
                                                const room = zoneData.rooms.get(roomId);
                                                if (!room) return null;
                                                return room.expanded ?
                                                    <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                                        <div className='flex items-center gap-2'>
                                                            <Drag color={zone.color} width={16} height={16} />
                                                            <div className={`flex items-center gap-2 bg-[#421C7F] p-2 px-3 rounded-lg grow justify-between cursor-pointer hover:bg-[#5725a7]`}
                                                                onClick={() => toggleRoomExpand(room.id)}
                                                            >
                                                                <div className='flex flex-col items-start'>
                                                                    <p style={{ color: zone.color }} className={`text-sm mb-1 font-medium`}>
                                                                        {room.name}
                                                                    </p>
                                                                    <p style={{ color: zone.color }} className={`text-xs`}>
                                                                        Dimension: {`${room.dimension.length_ft.toFixed(2)} ft x ${room.dimension.breadth_ft.toFixed(2)} ft`}
                                                                    </p>
                                                                    <p style={{ color: zone.color }} className={`text-xs`}>
                                                                        Area: {`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)} ft2`}
                                                                    </p>
                                                                </div>
                                                                <div className='flex items-center gap-2'>
                                                                    <button className='flex items-center gap-1.5 text-xs cursor-pointer' style={{ color: zone.color }}
                                                                        onClick={(e) => { e.stopPropagation(); openModel({ itemId: room.id, name: room.name, isZone: false, isRoom: true, length: room.dimension.length_ft, breadth: room.dimension.breadth_ft, height: room.dimension.ceilingHeight_ft }) }}
                                                                    >
                                                                        <EditIcon size={12} color={zone.color} />
                                                                        Edit
                                                                    </button>
                                                                    <button>
                                                                        <ChevronDown size={14} color={zone.color} className="rotate-180" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {
                                                            room.children && room.children.map((itemId) => {
                                                                const item = zoneData.windoors.get(itemId)
                                                                if (!item) return null;
                                                                return <div key={item.id} className='px-2 flex items-center gap-2'>
                                                                    <Drag color={zone.color} width={12} height={12} />
                                                                    <div className={`flex items-center gap-2 bg-[#292929] p-3 pl-4 rounded-lg grow justify-between`}>
                                                                        <div className='flex items-center gap-2'>
                                                                            {item.type == "door" ? <DoorOpen size={32} color={zone.color} /> : <WindowFrame color={zone.color} width={32} height={32} />}
                                                                            <div className='flex flex-col items-start'>
                                                                                <p style={{ color: zone.color }} className={`text-sm mb-1 font-bold`}>
                                                                                    {item.name}
                                                                                </p>
                                                                                <p style={{ color: zone.color }} className={`text-xs`}>
                                                                                    Dimension: {`${item.dimension.length_ft.toFixed(2)} ft x ${item.dimension.height_ft.toFixed(2)} ft`}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <button className='flex items-center gap-1.5 text-xs cursor-pointer' style={{ color: zone.color }}
                                                                            onClick={(e) => { e.stopPropagation(); openModel({ itemId: item.id, name: item.name, isZone: false, isRoom: false, length: item.dimension.length_ft, breadth: null, height: item.dimension.height_ft }) }}
                                                                        >
                                                                            <EditIcon size={12} color={zone.color} />
                                                                            Edit
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            })
                                                        }
                                                    </div> : <div key={roomIndex} className='mx-6 hover:bg-[#333333] flex items-center justify-between cursor-pointer bg-[#1F1F1F] px-2 py-2 rounded-lg'
                                                        onClick={() => toggleRoomExpand(room.id)}
                                                    >
                                                        <p style={{ color: zone.color }} className='text-sm font-medium'>{room.name}</p>
                                                        <button><ChevronDown size={20} color={zone.color} /></button>
                                                    </div>
                                            })
                                        }
                                    </div> : <div className='flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-[#333333]'
                                        onClick={() => toggleZoneExpand(index)}
                                    >
                                        <p className='text-sm font-medium'>{zone.name}</p>
                                        <div className='flex items-center gap-2'>
                                            <button onClick={() => deleteZoneById(zone.id)}><Trash size={14} /></button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); openModel({ itemId: zone.id, name: zone.name, isZone: true, isRoom: false, length: 0, breadth: 0, height: 0 }) }}
                                            ><EditIcon size={14} /></button>
                                            <button><ChevronDown size={20} /></button>
                                        </div>
                                    </div>
                            }
                        </div>
                    }) : <p>No zones</p>
                }
            </div>
            {/* rooms section without parent */}
            <div className='flex flex-col gap-2 w-full mt-2'>
                {
                    zoneData.orphanRoomIds && zoneData.orphanRoomIds.map((roomId, roomIndex) => {
                        const room = zoneData.rooms.get(roomId);
                        if (!room) return null;
                        return room.expanded ?
                            <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                <div className='flex items-center gap-2'>
                                    <Drag color={room.stroke} width={12} height={12} />
                                    <div className={`flex items-center gap-2 bg-[#421C7F] p-2 px-3 rounded-lg grow justify-between cursor-pointer hover:bg-[#5725a7]`}
                                        onClick={() => toggleRoomExpand(room.id)}
                                    >
                                        <div className='flex flex-col items-start'>
                                            <p style={{ color: room.stroke }} className={`text-sm mb-1 font-medium`}>
                                                {room.name}
                                            </p>
                                            <p style={{ color: room.stroke }} className={`text-xs`}>
                                                Dimension: {`${room.dimension.length_ft.toFixed(2)} ft x ${room.dimension.breadth_ft.toFixed(2)} ft`}
                                            </p>
                                            <p style={{ color: room.stroke }} className={`text-xs`}>
                                                Area: {`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)}ft2`}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <button className='flex items-center gap-1.5 text-xs cursor-pointer' style={{ color: room.stroke }}
                                                onClick={(e) => { e.stopPropagation(); openModel({ itemId: room.id, name: room.name, isZone: false, isRoom: true, length: room.dimension.length_ft, breadth: room.dimension.breadth_ft, height: room.dimension.ceilingHeight_ft, }) }}
                                            >
                                                <EditIcon size={12} color={room.stroke} />
                                                Edit
                                            </button>
                                            <button>
                                                <ChevronDown size={14} color={room.stroke} className="rotate-180" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {
                                    room.children && room.children.map((itemId) => {
                                        const item = zoneData.windoors.get(itemId)
                                        if (!item) return null;
                                        return <div key={item.id} className='px-2 flex items-center gap-2'>
                                            <Drag color={room.stroke} width={12} height={12} />
                                            <div className={`flex items-center gap-2 bg-[#292929] p-3 pl-4 rounded-lg grow justify-between`}>
                                                <div className='flex items-center gap-2'>
                                                    {item.type == "door" ? <DoorOpen size={32} color={room.stroke} /> : <WindowFrame color={room.stroke} width={32} height={32} />}
                                                    <div className='flex flex-col items-start'>
                                                        <p style={{ color: room.stroke }} className={`text-sm mb-1 font-bold`}>
                                                            {item.name}
                                                        </p>
                                                        <p style={{ color: room.stroke }} className={`text-xs`}>
                                                            Dimension: {`${item.dimension.length_ft.toFixed(2)} ft x ${item.dimension.height_ft.toFixed(2)} ft`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-1.5 text-xs cursor-pointer' style={{ color: room.stroke }}
                                                    onClick={(e) => { e.stopPropagation(); openModel({ itemId: item.id, name: item.name, isZone: false, isRoom: false, length: item.dimension.length_ft, breadth: null, height: item.dimension.height_ft, }) }}
                                                >
                                                    <EditIcon size={12} color={room.stroke} />
                                                    Edit
                                                </div>
                                            </div>
                                        </div>
                                    })
                                }
                            </div> : <div key={roomIndex} className='mx-6 hover:bg-[#333333] flex items-center justify-between cursor-pointer bg-[#1F1F1F] px-2 py-2 rounded-lg'
                                onClick={() => toggleRoomExpand(room.id)}
                            >
                                <p style={{ color: room.stroke }} className='text-sm font-medium '>{room.name}</p>
                                <button><ChevronDown size={20} color={room.stroke} /></button>
                            </div>
                    })
                }
            </div>
            <div className='flex flex-col' onClick={() => setIsTotalAreaOpen(open => !open)}>
                <div className='px-6 py-4 bg-[#262626] flex items-center justify-between cursor-pointer'>

                <p className='text-lg font-medium'>Total Area</p>
                <button><ChevronDown size={20} className={`${isTotalAreaOpen && "rotate-180"}`} /></button>
                </div>
                {
                    isTotalAreaOpen &&
                    <div className='px-6 py-2'>
                        <p>{calculateTotalRoomArea(zoneData).toFixed(2)} sq ft</p>
                    </div>
                }

            </div>
            <div className='px-6 py-4 bg-[#262626] flex items-center justify-between cursor-pointer'>
                <p className='text-lg font-medium'>Results</p>
                <button><ChevronDown size={20} /></button>
            </div>
            <div className="p-4  pb-8">
                <p className="mb-2 text-white font-medium">Export</p>
                <div className="flex gap-4 items-center justify-stretch">
                    <button className="bg-[#35333A] text-white px-6 py-2 rounded-md hover:bg-[#3a3740] transition w-full cursor-pointer">
                        PDF
                    </button>
                    <button className="bg-[#35333A] text-white px-6 py-2 rounded-md hover:bg-[#3a3740] transition w-full cursor-pointer">
                        CSV
                    </button>
                </div>
            </div>
            <EditModel open={editModelOpen} data={editModelData.current} onClose={closeModel} onSave={editValues} />
        </div>
    )
}
