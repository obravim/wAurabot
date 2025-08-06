import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Drag from '@/components/Icons/Drag'


export default function DraggableRoom({
  id,
  color,
  children,
}: {
  id: string,
  color: string,
  children: React.ReactNode,
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} className='flex items-center gap-2 touch-none'>
      <div {...listeners} className="drag-handle touch-none py-3 px-1">
        <Drag color={color} width={16} height={16} />
      </div>
      {children}
    </div>
  );
}
