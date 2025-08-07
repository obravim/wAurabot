import React, { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import Drag from './Icons/Drag'
import WindowFrame from './Icons/WindowFrame'
import { ChevronDown, DoorOpen, EditIcon, Search, Plus, Check, Delete, DeleteIcon, Trash, Cross, CrossIcon, X } from 'lucide-react'
import { useZone, ZoneData, Zone } from '@/app/context/ZoneContext'
import EditModel, { EditModelDataType, NAME_REGEX } from './EditModel'
import { unSelectRooms } from "./Canvas"
import { useCanvas } from '@/app/context/CanvasContext'
import {
    DndContext,
    closestCenter,
    useDroppable,
    useDraggable,
    DragEndEvent,
    DragOverlay,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DraggableRoom from '@/wrappers/DraggableRoom'
import DroppableZone from '@/wrappers/DroppableZone'
import RoomPreview from './RoomPreview'
import { MAX_DOOR_SIZE } from './EditView'
import Droppable from '@/wrappers/Droppable'

function calculateTotalRoomArea(zoneData: ZoneData): number {
    let total = 0;

    zoneData.rooms.forEach((room) => {
        total += room.dimension.length_ft * room.dimension.breadth_ft;
    });
    return total;
}

const COLORS = [
    "#8B5CF6", // Violet
    "#F43F5E", // Rose
    "#06B6D4", // Cyan
    "#64748B", // Slate Gray
    "#F59E0B", // Amber
    "#14B8A6", // Teal
];

export default function EditZone() {
    const { zoneData, setZoneData, multiSelect, setMultiSelect } = useZone();
    const { scaleFactor, resizeFactor } = useCanvas();
    const [editModelOpen, setEditModelOpen] = useState(false);
    const editModelData = useRef<EditModelDataType>({ itemId: "", breadth: 0, height: 0, length: 0, isRoom: true, name: "Input", isZone: false })
    const [isTotalAreaOpen, setIsTotalAreaOpen] = useState(false)
    const [activeId, setActiveId] = useState<string | null>(null);
    const searchStringRef = useRef<HTMLInputElement>(null);
    const [searchString, setSearchString] = useState<string>("");
    const [searchResults, setSearchResults] = useState<ZoneData | null>(null);

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
                id: "zone" + (zoneData.zones.length + 1),
                roomIds: selectedRoomIds,
                color: COLORS[zoneData.zones.length % COLORS.length],
                expanded: false,
                name: "Zone" + (zoneData.zones.length + 1)
            };

            setZoneData(prev => {
                const updatedRooms = new Map(prev.rooms);
                const updatedOrphans = prev.orphanRoomIds.filter(id => !selectedRoomIds.includes(id));

                // update zone reference inside each room
                selectedRoomIds.forEach(id => {
                    const room = updatedRooms.get(id);
                    if (room) {
                        updatedRooms.set(id, { ...room, zoneColor: newZone.color, zone: newZone.id });
                    }
                });

                updatedRooms.forEach(room => {
                    updatedRooms.set(room.id, { ...room, selected: false })
                })

                return {
                    ...prev,
                    zones: [...prev.zones, newZone],
                    rooms: updatedRooms,
                    orphanRoomIds: updatedOrphans,
                };
            });
        }
    }, [multiSelect])

    useEffect(() => {
        handleSearchChange(searchString)
    }, [zoneData])

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
            } else if (data.isRoom) {
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
                        length: data.length * 12 / (scaleFactor * resizeFactor),
                        breadth: data.breadth ? data.breadth * 12 / (scaleFactor * resizeFactor) : room.pos.breadth
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
                const room = prev.rooms.get(windoor.roomId)
                if (!room) return prev;
                let length = Math.round(data.length * 12 / (scaleFactor * resizeFactor));
                let breadth = Math.round(data.length * 12 / (scaleFactor * resizeFactor));
                if (windoor.type === 'window') {
                    if (windoor.horizontal) {
                        let maxLength = room.pos.x + room.pos.length - windoor.pos.x
                        length = Math.min(maxLength, length);
                        breadth = windoor.pos.breadth
                    } else {
                        let maxLength = room.pos.y + room.pos.breadth - windoor.pos.y
                        breadth = Math.min(maxLength, length);
                        length = windoor.pos.length
                    }
                } else {
                    if (windoor.horizontal) {
                        let maxLength = room.pos.x + room.pos.length - windoor.pos.x
                        maxLength = Math.min(maxLength, MAX_DOOR_SIZE)
                        length = Math.min(maxLength, length);
                        breadth = length
                    } else {
                        let maxLength = room.pos.y + room.pos.breadth - windoor.pos.y
                        maxLength = Math.min(maxLength, MAX_DOOR_SIZE)
                        breadth = Math.min(maxLength, length);
                        length = breadth
                    }
                }
                updatedWindoors.set(data.itemId, {
                    ...windoor,
                    name: data.name,
                    dimension: {
                        length_ft: parseFloat((windoor.horizontal ? (length * scaleFactor * resizeFactor / 12) : (breadth * scaleFactor * resizeFactor / 12)).toPrecision(2)),
                        height_ft: data.height,
                    },
                    pos: {
                        ...windoor.pos,
                        length: length,
                        breadth: breadth
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
            const updatedRooms = new Map(prev.rooms)

            const deletedZone = prev.zones.find(zone => zone.id === zoneId);
            if (!deletedZone) return prev;

            const orphanedRoomsIds = deletedZone.roomIds;

            orphanedRoomsIds.forEach(roomId => {
                const tempRoom = updatedRooms.get(roomId);
                if (!tempRoom) return;
                updatedRooms.set(roomId, { ...tempRoom, zone: null, zoneColor: null })
            })

            const updatedOrphans = [...prev.orphanRoomIds, ...orphanedRoomsIds];
            const sortedOrphanIds = updatedOrphans
                .filter(id => prev.rooms.has(id))
                .sort((a, b) => {
                    const roomA = prev.rooms.get(a);
                    const roomB = prev.rooms.get(b);
                    if (!roomA || !roomB) return 0;
                    return roomA.name.localeCompare(roomB.name, undefined, { numeric: true });
                });

            return {
                ...prev,
                zones: updatedZones,
                orphanRoomIds: sortedOrphanIds,
                rooms: updatedRooms
            };
        });
    }

    function handleDragEnd(event: DragEndEvent) {
        const activeId = event.active.id;
        const overId = event.over?.id;
        if (!overId || activeId === overId) return;

        const activeRoomId = String(activeId).replace("room:", "");
        const overRoomId = String(overId).startsWith("room:") ? String(overId).replace("room:", "") : null;

        const activeInZone = zoneData.zones.find(z => z.roomIds.includes(activeRoomId));
        const overInZone = zoneData.zones.find(z => z.roomIds.includes(overRoomId || ""));

        const activeZoneId = activeInZone?.id ?? null;
        const overZoneId = overInZone?.id ?? null;

        setZoneData(prev => {
            const rooms = new Map(prev.rooms);
            const room = rooms.get(activeRoomId);
            if (!room) return prev;

            const zones = prev.zones.map(zone => {
                let roomIds = [...zone.roomIds];

                // Remove from source zone
                if (zone.id === activeZoneId) {
                    roomIds = roomIds.filter(id => id !== activeRoomId);
                }

                // Add to target zone
                if (zone.id === overZoneId) {
                    roomIds = roomIds.filter(id => id !== activeRoomId); // Avoid duplicates

                    if (overRoomId) {
                        const index = roomIds.indexOf(overRoomId);
                        if (index !== -1) {
                            roomIds.splice(index, 0, activeRoomId);
                        } else {
                            roomIds.push(activeRoomId);
                        }
                    } else {
                        roomIds.push(activeRoomId);
                    }
                }

                return { ...zone, roomIds };
            });

            // Orphan logic
            let orphanRoomIds = [...prev.orphanRoomIds];
            orphanRoomIds = orphanRoomIds.filter(id => id !== activeRoomId);

            if (!overZoneId) {
                if (overRoomId) {
                    const index = orphanRoomIds.indexOf(overRoomId);
                    if (index !== -1) {
                        orphanRoomIds.splice(index, 0, activeRoomId);
                    } else {
                        orphanRoomIds.push(activeRoomId);
                    }
                } else {
                    orphanRoomIds.push(activeRoomId);
                }
            }

            // Update room stroke color based on location
            const updatedRoom = {
                ...room,
                zoneColor: overZoneId
                    ? zones.find(z => z.id === overZoneId)?.color ?? null
                    : null,
                zone: overZoneId
            };
            rooms.set(activeRoomId, updatedRoom);

            return {
                ...prev,
                zones,
                orphanRoomIds,
                rooms,
            };
        });
    }

    function handleSearchChange(searchString: string) {
        // const searchInput = searchStringRef.current
        // if (!searchInput) return;
        // const searchString = searchInput.value.trim();
        searchString = searchString.trim().toLowerCase();
        if (!searchString.match(NAME_REGEX)) {
            setSearchResults(null);
            return
        }

        // Match zones by name
        const matchedZones = zoneData.zones
            .filter(zone => zone.name.toLowerCase().includes(searchString))
            .map(zone => ({
                ...zone,
                roomIds: [...zone.roomIds] // include all rooms if zone matched
            }));

        const matchedZoneRoomIds = new Set<string>();
        const matchedZonesByRoom = zoneData.zones
            .map(zone => {
                const matchingRoomIds = zone.roomIds.filter(roomId => {
                    const room = zoneData.rooms.get(roomId);
                    return room && room.name.toLowerCase().includes(searchString.toLowerCase());
                });

                matchingRoomIds.forEach(id => matchedZoneRoomIds.add(id));

                return matchingRoomIds.length
                    ? { ...zone, roomIds: matchingRoomIds }
                    : null;
            })
            .filter(Boolean) as Zone[];

        // Combine matched zones by name and zones with matching rooms
        const allMatchedZones = [...matchedZones, ...matchedZonesByRoom]
            .reduce((acc, curr) => {
                const existing = acc.find(z => z.id === curr.id);
                if (!existing) return [...acc, curr];
                // merge roomIds if same zone
                existing.roomIds = Array.from(new Set([...existing.roomIds, ...curr.roomIds]));
                return acc;
            }, [] as Zone[]);

        // Match orphan rooms
        const matchedOrphans = zoneData.orphanRoomIds.filter(roomId => {
            const room = zoneData.rooms.get(roomId);
            return room && room.name.toLowerCase().includes(searchString.toLowerCase());
        });

        if (allMatchedZones.length === 0 && matchedOrphans.length === 0) {
            setSearchResults(null);
            return;
        }
        setSearchResults({
            zones: allMatchedZones,
            orphanRoomIds: matchedOrphans,
            rooms: zoneData.rooms,
            windoors: zoneData.windoors
        });
    }
    const dataToRender = searchResults ?? zoneData;
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
                    <input className='grow focus:ring-0 focus:outline-0 [appearance:textfield] 
                             [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                        type="text" name="search" id="search" placeholder='Search' value={searchString}
                        onChange={(e) => {
                            setSearchString(e.target.value);
                            handleSearchChange(e.target.value); // pass the new value
                        }} />
                    {
                        searchString.length > 0 &&
                        <X size={16} color='#7C7C7C' className='cursor-pointer' onClick={() => {
                            setSearchString("");
                            setSearchResults(null);
                        }} />
                    }
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
            {
                searchResults == null && searchString.trim().length > 0 ? <p className='mx-6 mb-1 text-sm text-white'>No room or zone found!</p> :
                    <DndContext
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        onDragStart={({ active }) => setActiveId(active.id.toString())}
                    >
                        <DragOverlay>
                            {activeId && (
                                <RoomPreview roomId={activeId.replace('room:', '')} zoneData={dataToRender} />
                            )}
                        </DragOverlay>
                        {/* zone section */}
                        <div className='flex flex-col gap-2 w-full mt-2'>
                            {
                                dataToRender.zones ? dataToRender.zones.map((zone, index) => {
                                    return <DroppableZone key={zone.id} id={`zone:${zone.id}`}>
                                        <div key={index} className=''>
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
                                                                const room = dataToRender.rooms.get(roomId);
                                                                if (!room) return null;
                                                                return <Droppable key={room.id} id={`room:${room.id}`} data={{ type: "room" }}>
                                                                    {(provided) => (
                                                                        <div ref={provided.setNodeRef} {...provided.droppableProps}>
                                                                            {room.expanded ?
                                                                                <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                                                                    <DraggableRoom key={room.id} id={`room:${room.id}`} color={zone.color}>
                                                                                        {/* <Drag color={zone.color} width={16} height={16} /> */}
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
                                                                                    </DraggableRoom>
                                                                                    {
                                                                                        room.children && room.children.map((itemId) => {
                                                                                            const item = dataToRender.windoors.get(itemId)
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
                                                                            }</div>
                                                                    )}
                                                                </Droppable>
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
                                    </DroppableZone>
                                }) : <p>No zones</p>
                            }
                        </div>
                        {/* rooms section without parent */}
                        <DroppableZone id="orphan">
                            <div className='flex flex-col gap-2 w-full'>
                                {
                                    dataToRender.orphanRoomIds && dataToRender.zones.length > 0 && <p className='mx-6 mb-1 text-sm text-white'>Rest of the house</p>
                                }
                                {
                                    dataToRender.orphanRoomIds && dataToRender.orphanRoomIds.map((roomId, roomIndex) => {
                                        const room = dataToRender.rooms.get(roomId);
                                        if (!room) return null;
                                        return (
                                            <Droppable key={room.id} id={`room:${room.id}`} data={{ type: "room" }}>
                                                {(provided) => (
                                                    <div ref={provided.setNodeRef} {...provided.droppableProps}>
                                                        {room.expanded ?
                                                            <div key={room.id} className='flex flex-col w-full px-2 gap-4'>
                                                                <DraggableRoom key={room.id} id={`room:${room.id}`} color={room.stroke}>
                                                                    {/* <Drag color={room.stroke} width={12} height={12} /> */}
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
                                                                </DraggableRoom>
                                                                {
                                                                    room.children && room.children.map((itemId) => {
                                                                        const item = dataToRender.windoors.get(itemId)
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
                                                            </div>
                                                            : <div key={roomIndex} className='mx-6 hover:bg-[#333333] flex items-center justify-between cursor-pointer bg-[#1F1F1F] px-2 py-2 rounded-lg'
                                                                onClick={() => toggleRoomExpand(room.id)}
                                                            >
                                                                <p style={{ color: room.stroke }} className='text-sm font-medium '>{room.name}</p>
                                                                <button><ChevronDown size={20} color={room.stroke} /></button>
                                                            </div>}</div>
                                                )}
                                            </Droppable>
                                        )
                                    })
                                }
                            </div>
                        </DroppableZone>
                    </DndContext>
            }
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
