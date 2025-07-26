'use client'
import { createContext, useContext, useState } from 'react'

type Length = {
    feet: number | null,
    inch: number | null
}

type WinDoor = {
    id: string,
    type: 'window' | 'door',
    length: Length
}

type Rect = {
    id: string,
    dimension: { length: Length | null, breadth: Length | null },
    child: WinDoor[] | null,
    area: { feetSq: number | null, inchSq: number | null } | null,
    expanded: boolean,
    type: 'room' | 'door' | 'window'
}


export type ZoneType = {
    rects: Rect[],
    expanded: boolean,
    color: string,
}

type ZoneContextType = {
    zones: ZoneType[],
    setZones: (zones: ZoneType[]) => void
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined);

export function ZoneProvider({ children }: { children: React.ReactNode }) {
    const [zones, setZones] = useState<ZoneType[]>([]);

    return <ZoneContext.Provider value={{ zones, setZones }}>
        {children}
    </ZoneContext.Provider>
}

export function useZone() {
    const context = useContext(ZoneContext);
    if (!context) throw new Error('useCanvas must be used within ZoneProvider');
    return context;
}