'use client'
import { createContext, useContext, useState } from 'react'

type Length = {
    feet: number | null,
    inch: number | null
}

type WinDoor = {
    id: string,
    name: string,
    type: 'window' | 'door',
    length: Length
}

export type Room = {
    id: string,
    name: string,
    dimension: { length: Length | null, breadth: Length | null },
    child: WinDoor[] | null,
    area: { feetSq: number | null, inchSq: number | null } | null,
    expanded: boolean,
}


export type Zone = {
    id: number
    rooms: Room[],
    expanded: boolean,
    color: string,
}

export type ZoneData = {
    zones: Zone[],
    rooms: Room[]
}

type ZonesContextType = {
    zoneData: ZoneData,
    setZoneData: React.Dispatch<React.SetStateAction<ZoneData>>
};

const ZoneContext = createContext<ZonesContextType | undefined>(undefined);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
    const [zoneData, setZoneData] = useState<ZoneData>({ zones: [], rooms: [] });

    return <ZoneContext.Provider value={{ zoneData, setZoneData }}>
        {children}
    </ZoneContext.Provider>
}

export function useZone() {
    const context = useContext(ZoneContext);
    if (!context) throw new Error('useZone must be used within ZoneProvider');
    return context;
}