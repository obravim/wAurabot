'use client'
import { createContext, useContext, useState } from 'react'

export type WinDoor = {
    id: string,
    name: string,
    type: 'window' | 'door',
    pos: { x: number, y: number, length: number, breadth: number },
    dimension: { length_ft: number, height_ft: number }
    stroke: string,
    horizontal: boolean,
    roomId: string,
}

export type Room = {
    id: string,
    name: string,
    pos: { x: number, y: number, length: number, breadth: number }
    stroke: string,
    zoneColor: string | null,
    selected: boolean,
    zone: string | null,
    dimension: { length_ft: number, breadth_ft: number, ceilingHeight_ft: number },
    children: string[],
    expanded: boolean,
}

export type Zone = {
    id: string
    roomIds: string[],
    expanded: boolean,
    color: string,
    name: string
}

export type ZoneData = {
    zones: Zone[],
    orphanRoomIds: string[]
    rooms: Map<string, Room>
    windoors: Map<string, WinDoor>
}

type ZonesContextType = {
    zoneData: ZoneData,
    setZoneData: React.Dispatch<React.SetStateAction<ZoneData>>,
    multiSelect: boolean
    setMultiSelect: React.Dispatch<React.SetStateAction<boolean>>
};

const ZoneContext = createContext<ZonesContextType | undefined>(undefined);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
    const [zoneData, setZoneData] = useState<ZoneData>({ zones: [], orphanRoomIds: [], rooms: new Map<string, Room>(), windoors: new Map<string, WinDoor>() });
    const [multiSelect, setMultiSelect] = useState<boolean>(false);

    return <ZoneContext.Provider value={{ zoneData, setZoneData, multiSelect, setMultiSelect }}>
        {children}
    </ZoneContext.Provider>
}

export function useZone() {
    const context = useContext(ZoneContext);
    if (!context) throw new Error('useZone must be used within ZoneProvider');
    return context;
}