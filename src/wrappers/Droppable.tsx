// components/Droppable.tsx

import React from 'react';
import { useDroppable } from '@dnd-kit/core';

type DroppableProps = {
    id: string;
    children: (props: {
        setNodeRef: (element: HTMLElement | null) => void;
        isOver: boolean;
        droppableProps: Record<string, any>;
    }) => React.ReactNode;
    data?: Record<string, any>;
};

const Droppable: React.FC<DroppableProps> = ({ id, children, data }) => {
    const { setNodeRef, isOver } = useDroppable({
        id,
        data,
    });

    return (
        <>
            {children({
                setNodeRef,
                isOver,
                droppableProps: {},
            })}
        </>
    );
};

export default Droppable;
