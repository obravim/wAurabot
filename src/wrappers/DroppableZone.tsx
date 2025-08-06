import { useDroppable } from "@dnd-kit/core";

export default function DroppableZone({ id, children }: { id: string, children: React.ReactNode }) {
    const { setNodeRef } = useDroppable({ id });
    return <div ref={setNodeRef}>{children}</div>;
}