import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronDown, DoorOpen, EditIcon, Search } from 'lucide-react'
import { useZone, ZoneData } from '@/app/context/ZoneContext'


export default function EditZone() {
    const { zoneData, setZoneData } = useZone();
    const [zoneDataUI, setZoneDataUI] = useState<ZoneData>({ zones: [], rooms: [] });

    useEffect(() => {
        setZoneDataUI(zoneData);
    }, [zoneData])

    function toggleZoneExpand(index: number) {
        setZoneDataUI(zoneDataUI => {
            return { zones: zoneDataUI.zones.map((zone, i) => i === index ? { ...zone, expanded: !zone.expanded } : zone), rooms: zoneDataUI.rooms }
        })
    }

    function toggleRoomExpand(zoneId: number | null, roomId: string) {

        if (zoneId == null) {
            setZoneDataUI(zoneDataUI => {
                return {
                    zones: zoneDataUI.zones, rooms: zoneDataUI.rooms.map(room => {
                        if (room.id !== roomId) return room;
                        return { ...room, expanded: !room.expanded }; // ✅ new object
                    })
                }
            })
            return;
        }

        setZoneDataUI(zoneDataUI => {
            return {
                zones: zoneDataUI.zones.map((zone) => {
                    if (zoneId !== zone.id) return zone;
                    const newRooms = zone.rooms.map((room) =>
                        roomId === room.id ? { ...room, expanded: !room.expanded } : room
                    );
                    return { ...zone, rooms: newRooms }
                }),
                rooms: zoneDataUI.rooms
            }
        })
    }
    return (
        <div className='flex flex-col w-full bg-[#191919] h-full gap-4'>
            <div className='px-[30px] py-[20px] bg-[#421C7F] flex items-center justify-between'>
                <h3 className='font-medium text-xl flex items-center gap-2'>
                    <Image src={"/editzone.svg"} alt={"icon-editzone"} width={20} height={20} />
                    Edit Zone
                </h3>
                <button>
                    <ChevronDown width={32} />
                </button>
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
                    zoneDataUI.zones ? zoneDataUI.zones.map((zone, index) => {
                        return <div key={index} className=''>
                            {
                                zone.expanded ?
                                    <div className='cursor-auto flex flex-col gap-4'>
                                        <div className='px-6 py-3 hover:bg-[rgb(51,51,51)] flex items-center justify-between cursor-pointer'
                                            onClick={() => toggleZoneExpand(index)}
                                        >
                                            <p className='text-sm font-medium text-[#873EFD]'>Zone{index}</p>
                                            <button><ChevronDown size={20} color='#873EFD' className="rotate-180" /></button>
                                        </div>
                                        {
                                            zone.rooms && zone.rooms.map((room, roomIndex) => {
                                                return room.expanded ?
                                                    <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                                        <div className='flex items-center gap-2'>
                                                            <Image src={"/drag.svg"} alt={"drap icon"} width={12} height={12} />
                                                            <div className={`flex items-center gap-2 bg-[#421C7F] p-2 px-3 rounded-lg grow justify-between cursor-pointer hover:bg-[#5725a7]`}
                                                                onClick={() => toggleRoomExpand(zone.id, room.id)}
                                                            >
                                                                <div className='flex flex-col items-start'>
                                                                    <p className={`text-[${zone.color}] text-sm mb-1 font-medium`}>
                                                                        {room.name}
                                                                    </p>
                                                                    <p className={`text-[${zone.color}] text-xs`}>
                                                                        Dimension: {`${room.dimension.length?.feet ? room.dimension.length.feet.toFixed(2) + "ft" : ""} ${room.dimension.length?.inch ? room.dimension.length.inch.toFixed(2) + "in" : ""} x ${room.dimension.breadth?.feet ? room.dimension.breadth.feet.toFixed(2) + "ft" : ""} ${room.dimension.breadth?.inch ? room.dimension.breadth.inch.toFixed(2) + "in" : ""}`}
                                                                    </p>
                                                                    <p className={`text-[${zone.color}] text-xs`}>
                                                                        Area: {`${room.area?.feetSq ? room.area.feetSq.toFixed(2) + "ft2" : ""} ${room.area?.inchSq ? room.area.inchSq + "in2" : ""}`}
                                                                    </p>
                                                                </div>
                                                                <div className='flex items-center gap-2'>
                                                                    <button className='flex items-center gap-1.5 text-xs'>
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
                                                            room.child && room.child.map((item, itemIndex) => {
                                                                return <div key={item.id} className='px-2 flex items-center gap-2'>
                                                                    <Image src={"/drag.svg"} alt={"drap icon"} width={12} height={12} />
                                                                    <div className={`flex items-center gap-2 bg-[#292929] p-3 pl-4 rounded-lg grow justify-between`}>
                                                                        <div className='flex items-center gap-2'>
                                                                            {item.type == "door" ? <DoorOpen size={32} color={zone.color} /> : <Image src="/window-frame.svg" width={32} height={32} color={zone.color} alt='window' />}
                                                                            <div className='flex flex-col items-start'>
                                                                                <p className={`text-[${zone.color}] text-sm mb-1 font-bold`}>
                                                                                    {item.name}
                                                                                </p>
                                                                                <p className={`text-[${zone.color}] text-xs`}>
                                                                                    Dimension: {`${room.dimension.length?.feet ? room.dimension.length.feet + "ft" : ""} ${room.dimension.length?.inch ? room.dimension.length.inch + "in" : ""} x ${room.dimension.breadth?.feet ? room.dimension.breadth.feet + "ft" : ""} ${room.dimension.breadth?.inch ? room.dimension.breadth.inch + "in" : ""}`}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        <div className='flex items-center gap-1.5 text-xs'>
                                                                            <EditIcon size={12} color={zone.color} />
                                                                            Edit
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            })
                                                        }
                                                    </div> : <div key={roomIndex} className='mx-6 hover:bg-[#333333] flex items-center justify-between cursor-pointer bg-[#1F1F1F] px-2 py-2 rounded-lg'
                                                        onClick={() => toggleRoomExpand(zone.id, room.id)}
                                                    >
                                                        <p className='text-sm font-medium '>{room.name}</p>
                                                        <button><ChevronDown size={20} /></button>
                                                    </div>
                                            })
                                        }
                                    </div> : <div className='flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-[#333333]'
                                        onClick={() => toggleZoneExpand(index)}
                                    >
                                        <p className='text-sm font-medium'>Zone{index}</p>
                                        <ChevronDown size={20} />
                                    </div>
                            }
                        </div>
                    }) : <p>No zones</p>
                }
            </div>
            {/* rooms section without parent */}
            <div className='flex flex-col gap-2 w-full mt-2'>
                {
                    zoneDataUI.rooms && zoneDataUI.rooms.map((room, roomIndex) => {
                        return room.expanded ?
                            <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                <div className='flex items-center gap-2'>
                                    <Image src={"/drag.svg"} alt={"drap icon"} width={12} height={12} />
                                    <div className={`flex items-center gap-2 bg-[#421C7F] p-2 px-3 rounded-lg grow justify-between cursor-pointer hover:bg-[#5725a7]`}
                                        onClick={() => toggleRoomExpand(null, room.id)}
                                    >
                                        <div className='flex flex-col items-start'>
                                            <p className={`text-[${'#ffffff'}] text-sm mb-1 font-medium`}>
                                                {room.name}
                                            </p>
                                            <p className={`text-[${'#ffffff'}] text-xs`}>
                                                Dimension: {`${room.dimension.length?.feet ? room.dimension.length.feet.toFixed(2) + "ft" : ""} ${room.dimension.length?.inch ? room.dimension.length.inch.toFixed(2) + "in" : ""} x ${room.dimension.breadth?.feet ? room.dimension.breadth.feet.toFixed(2) + "ft" : ""} ${room.dimension.breadth?.inch ? room.dimension.breadth.inch.toFixed(2) + "in" : ""}`}
                                            </p>
                                            <p className={`text-[${'#ffffff'}] text-xs`}>
                                                Area: {`${room.area?.feetSq ? room.area.feetSq.toFixed(2) + "ft2" : ""} ${room.area?.inchSq ? room.area.inchSq + "in2" : ""}`}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <button className='flex items-center gap-1.5 text-xs'>
                                                <EditIcon size={12} color={'#ffffff'} />
                                                Edit
                                            </button>
                                            <button>
                                                <ChevronDown size={14} color={'#ffffff'} className="rotate-180" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {
                                    room.child && room.child.map((item, itemIndex) => {
                                        return <div key={item.id} className='px-2 flex items-center gap-2'>
                                            <Image src={"/drag.svg"} alt={"drap icon"} width={12} height={12} />
                                            <div className={`flex items-center gap-2 bg-[#292929] p-3 pl-4 rounded-lg grow justify-between`}>
                                                <div className='flex items-center gap-2'>
                                                    {item.type == "door" ? <DoorOpen size={32} color={'#ffffff'} /> : <Image src="/window-frame.svg" width={32} height={32} color={'#ffffff'} alt='window' />}
                                                    <div className='flex flex-col items-start'>
                                                        <p className={`text-[${'#ffffff'}] text-sm mb-1 font-bold`}>
                                                            {item.name}
                                                        </p>
                                                        <p className={`text-[${'#ffffff'}] text-xs`}>
                                                            Dimension: {`${room.dimension.length?.feet ? room.dimension.length.feet + "ft" : ""} ${room.dimension.length?.inch ? room.dimension.length.inch + "in" : ""} x ${room.dimension.breadth?.feet ? room.dimension.breadth.feet + "ft" : ""} ${room.dimension.breadth?.inch ? room.dimension.breadth.inch + "in" : ""}`}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-1.5 text-xs'>
                                                    <EditIcon size={12} color={'#ffffff'} />
                                                    Edit
                                                </div>
                                            </div>
                                        </div>
                                    })
                                }
                            </div> : <div key={roomIndex} className='mx-6 hover:bg-[#333333] flex items-center justify-between cursor-pointer bg-[#1F1F1F] px-2 py-2 rounded-lg'
                                onClick={() => toggleRoomExpand(null, room.id)}
                            >
                                <p className='text-sm font-medium '>{room.name}</p>
                                <button><ChevronDown size={20} /></button>
                            </div>
                    })
                }
            </div>
            <div className='px-6 py-4 bg-[#262626] flex items-center justify-between cursor-pointer'>
                <p className='text-lg font-medium'>Total Area</p>
                <button><ChevronDown size={20} /></button>
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
        </div>
    )
}
