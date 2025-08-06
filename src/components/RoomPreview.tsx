import { ZoneData } from "@/app/context/ZoneContext";

export default function RoomPreview({ roomId, zoneData }: { roomId: string, zoneData: ZoneData }) {
    const room = zoneData.rooms.get(roomId);
    if (!room) return null;

    return (
        <div className="p-2 bg-[#1F1F1F] border shadow-md rounded text-sm w-48 text-left" style={{ color: room.stroke }}>
            {room.name}
        </div>
    );
}
