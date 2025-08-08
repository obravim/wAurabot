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
    transformStartState?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

export type Room = {
    id: string,
    name: string,
    pos: { x: number, y: number, length: number, breadth: number }
    stroke: string,
    zoneColor: string | null,
    selected: boolean,
    zone: string | null,
    dimension: { length_ft: number, breadth_ft: number, ceilingHeight_ft: number, area_ft?: number; },
    children: string[],
    expanded: boolean,
    dragStartPos?: DragStartState;
    transformStartState?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

type DragStartState = {
    x: number;
    y: number;
    children: Record<string, { x: number; y: number }>;
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
    setMultiSelect: React.Dispatch<React.SetStateAction<boolean>>,
    multiSelectOrigin: 'zone' | 'view' | null,
    setMultiSelectOrigin: React.Dispatch<React.SetStateAction<'zone' | 'view' | null>>,
};

const ZoneContext = createContext<ZonesContextType | undefined>(undefined);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
    const [zoneData, setZoneData] = useState<ZoneData>({ zones: [], orphanRoomIds: [], rooms: new Map<string, Room>(), windoors: new Map<string, WinDoor>() });
    const [multiSelect, setMultiSelect] = useState<boolean>(false);
    const [multiSelectOrigin, setMultiSelectOrigin] = useState<'zone' | 'view' | null>(null);

    return <ZoneContext.Provider value={{ zoneData, setZoneData, multiSelect, setMultiSelect, multiSelectOrigin, setMultiSelectOrigin }}>
        {children}
    </ZoneContext.Provider>
}

export function useZone() {
    const context = useContext(ZoneContext);
    if (!context) throw new Error('useZone must be used within ZoneProvider');
    return context;
}