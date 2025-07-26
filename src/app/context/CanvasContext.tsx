'use client'
import { createContext, useContext, useState } from 'react'

type RectCoordsType = { startPoint: number[], endPoint: number[], color: string }[];

export type CanvasContextType = {
    file: File | null,
    setCanvasFile: (file: File) => void;
    scaleFactor: number,
    setScaleFactor: (scaleFactor: number) => void;
    roomCoords: RectCoordsType;
    setRoomCoords: (roomCoords: RectCoordsType) => void
    windowCoords: RectCoordsType;
    setWindowCoords: (windowCoords: RectCoordsType) => void
    doorCoords: RectCoordsType;
    setDoorCoords: (doorCoords: RectCoordsType) => void
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function CanvasProvider({ children }: { children: React.ReactNode }) {
    const [file, setFile] = useState<File | null>(null);
    const [scaleFactor, setScaleFactor] = useState(1);
    const [roomCoords, setRoomCoords] = useState<RectCoordsType>([]);
    const [doorCoords, setDoorCoords] = useState<RectCoordsType>([]);
    const [windowCoords, setWindowCoords] = useState<RectCoordsType>([]);

    return <CanvasContext.Provider value={{ file: file, setCanvasFile: setFile, scaleFactor: scaleFactor, setScaleFactor: setScaleFactor, roomCoords, setRoomCoords: setRoomCoords, windowCoords, setWindowCoords: setWindowCoords, doorCoords, setDoorCoords: setDoorCoords }}>
        {children}
    </CanvasContext.Provider>
}

export function useCanvas() {
    const context = useContext(CanvasContext);
    if (!context) throw new Error('useCanvas must be used within CanvasProvider');
    return context;
}