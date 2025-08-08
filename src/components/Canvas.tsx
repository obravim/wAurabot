'use client'

import { Stage, Layer, Text, Rect, Line, Label, Tag, Image as KonvaImage, Circle, Transformer } from 'react-konva';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Konva from 'konva';
import { DEFAULT_WINDOW_BREADTH, getRoomFromCoords, getWinDoorFromCoords, isItNear, MAX_DOOR_SIZE, ROOM_COLORS } from './EditView';
import { useStep } from '@/app/context/StepContext';
import { useCanvas } from '@/app/context/CanvasContext';
import { useZone, Zone, ZoneData, Room, WinDoor } from '@/app/context/ZoneContext';
import EditModel, { EditModelDataType, NAME_REGEX } from './EditModel'

export type CanvasHandle = {
    zoomStage: (direction: "in" | "out", scaleFactor: number) => void;
    handleDelete: () => void;
    setDimText: (dimText: string) => void
};

type CanvasProps = {
    image: HTMLImageElement | null;
    move: boolean,
    drawRect: 'none' | 'room' | 'door' | 'window',
    setDrawRect: React.Dispatch<React.SetStateAction<'none' | 'room' | 'door' | 'window'>>,
    setInputModelOpen: ((inputModelOpen: boolean) => void) | null,
    setPixelDist: ((pixelDist: number) => void) | null,
    stageSize: { width: number, height: number },
    setDrawWindoorEnabled: React.Dispatch<React.SetStateAction<boolean>>
};

type Point = [number, number]

export type RectCoord = {
    startPoint: Point;
    endPoint: Point;
    color: string;
};

type Line = {
    points: number[];
}

type ImgDrawDetails = {
    imgDrawWidth: number,
    imgDrawHeight: number,
    startX: number,
    startY: number
}

function getWordSize(text: string, fontSize: number) {
    return text.length * (fontSize);
}

export function unSelectRooms(prev: ZoneData) {
    const updatedRooms = new Map(prev.rooms);
    for (const [id, room] of updatedRooms.entries()) {
        if (room.selected) updatedRooms.set(id, { ...room, selected: false });
    }
    return { ...prev, rooms: updatedRooms };
}

function distancePoints(pointA: Point, pointB: Point) {
    return Math.sqrt(
        Math.pow(pointA[0] - pointB[0], 2) +
        Math.pow(pointA[1] - pointB[1], 2)
    );
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ image, move, setInputModelOpen, setPixelDist, stageSize, drawRect, setDrawRect, setDrawWindoorEnabled }, ref) => {
    const { step } = useStep();
    const [imgDrawDetails, setImgDrawDetails] = useState<ImgDrawDetails>();
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
    const transformerRef = useRef<Konva.Transformer>(null);
    const windoorTransformerRef = useRef<Konva.Transformer>(null);
    const roomNodeRefs = useRef<Map<string, Konva.Rect>>(new Map());
    const windoorNodeRefs = useRef<Map<string, Konva.Rect>>(new Map());
    const isDragging = useRef(false);
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const lastDist = useRef<number | null>(null);
    const [line, setLine] = useState<Line | null>();
    const [newLine, setNewLine] = useState<Point | null>(null);
    const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
    const newLineRef = useRef<number[] | null>(null);
    const hoverPosRef = useRef<number[] | null>(null);
    const [dimText, setDimText] = useState<string>("");
    const isDrawing = useRef(false);
    const { scaleFactor, resizeFactor, setResizeFactor } = useCanvas();
    const [newRect, setNewRect] = useState<RectCoord | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [selectedWindoorId, setSelectedWindoorId] = useState<string | null>(null);
    const { zoneData, setZoneData, multiSelect } = useZone();
    const zoneDataRef = useRef<ZoneData>({ zones: [], orphanRoomIds: [], rooms: new Map<string, Room>(), windoors: new Map<string, WinDoor>() });
    const [cursor, setCursor] = useState<'grabbing' | 'crosshair' | 'auto'>('auto');
    const [windoorEnabledAnchors, setWindoorEnabledAnchors] = useState<string[]>(['middle-left', 'middle-right']);
    const windoorDragStartRef = useRef<Map<string, { x: number; y: number; wall: 'top' | 'bottom' | 'left' | 'right' }>>(new Map());

    // Helpers for windoor interactions
    function getRoomForWindoor(windoorId: string) {
        const windoor = zoneDataRef.current.windoors.get(windoorId);
        if (!windoor) return null;
        const room = zoneDataRef.current.rooms.get(windoor.roomId);
        return room || null;
    }

    function getAnchoredWallForWindoor(windoorId: string): 'top' | 'bottom' | 'left' | 'right' {
        const windoor = zoneDataRef.current.windoors.get(windoorId);
        if (!windoor) return 'top';
        const room = getRoomForWindoor(windoorId);
        if (!room) return 'top';
        const r = room.pos;
        const w = windoor.pos;
        if (windoor.horizontal) {
            const distTop = Math.abs(w.y - r.y);
            const distBottom = Math.abs((w.y + w.breadth) - (r.y + r.breadth));
            return distTop <= distBottom ? 'top' : 'bottom';
        } else {
            const distLeft = Math.abs(w.x - r.x);
            const distRight = Math.abs((w.x + w.length) - (r.x + r.length));
            return distLeft <= distRight ? 'left' : 'right';
        }
    }

    function clampWindoorPosToRoom(_windoorId: string, desired: { x: number; y: number }): { x: number; y: number } {
        // Border restrictions removed: allow free movement (overlap prevention handled elsewhere)
        return desired;
    }

    function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
        return !(
            a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y
        );
    }

    function wouldOverlapSiblings(windoorId: string, next: { x: number; y: number; length: number; breadth: number }) {
        const windoor = zoneDataRef.current.windoors.get(windoorId);
        const room = windoor ? zoneDataRef.current.rooms.get(windoor.roomId) : null;
        if (!windoor || !room) return false;
        const siblings = room.children.filter(id => id !== windoorId);
        const nextRect = { x: next.x, y: next.y, w: next.length, h: next.breadth };
        for (const sibId of siblings) {
            const sib = zoneDataRef.current.windoors.get(sibId);
            if (!sib) continue;
            const sibRect = { x: sib.pos.x, y: sib.pos.y, w: sib.pos.length, h: sib.pos.breadth };
            if (rectsOverlap(nextRect, sibRect)) return true;
        }
        return false;
    }

    useEffect(() => {
        // Attach room transformer to selected rooms
        if (transformerRef.current) {
            const selectedRooms = Array.from(zoneData.rooms.values()).filter(r => r.selected);
            const selectedRoomNodes = selectedRooms
                .map(room => roomNodeRefs.current.get(room.id))
                .filter(Boolean) as Konva.Rect[];

            transformerRef.current.nodes(selectedRoomNodes);
            transformerRef.current.getLayer()?.batchDraw();

            // Keep windoors of selected rooms above the room rects for hit testing
            selectedRooms.forEach(room => {
                room.children.forEach(childId => {
                    const childNode = windoorNodeRefs.current.get(childId);
                    childNode?.moveToTop();
                });
            });
            layerRef.current?.batchDraw();
        }

        // Attach windoor transformer when a windoor is selected
        if (windoorTransformerRef.current) {
            const node = selectedWindoorId ? windoorNodeRefs.current.get(selectedWindoorId) : null;
            if (node) {
                windoorTransformerRef.current.nodes([node]);
                node.moveToTop();
                layerRef.current?.batchDraw();
            } else {
                windoorTransformerRef.current.nodes([]);
            }
            windoorTransformerRef.current.getLayer()?.batchDraw();
        }
    }, [zoneData.rooms, selectedRoomId, multiSelect, selectedWindoorId]);

    useEffect(() => {
        if (multiSelect) {
            setSelectedRoomId(null);
            setSelectedWindoorId(null);
            setDrawWindoorEnabled(false);
            setCursor('auto')
            setDrawRect('none')
        }
        else {
            setDrawWindoorEnabled(selectedRoomId != null)
        }
    }, [multiSelect, selectedRoomId])

    useEffect(() => {
        if (!selectedWindoorId) {
            setWindoorEnabledAnchors(['middle-left', 'middle-right']);
            return;
        }
        const wd = zoneDataRef.current.windoors.get(selectedWindoorId);
        if (!wd) return;
        if (wd.horizontal) setWindoorEnabledAnchors(['middle-left', 'middle-right']);
        else setWindoorEnabledAnchors(['top-center', 'bottom-center']);
    }, [selectedWindoorId]);

    useEffect(() => {
        zoneDataRef.current = zoneData;
    }, [zoneData]);

    useEffect(() => {
        if (!(image?.width) || !(image?.height)) {
            return;
        }
        const imgDrawWidth = image?.width > image?.height ? stageSize.width : stageSize.width * image?.width / image?.height;
        const imgDrawHeight = image?.height > image?.width ? stageSize.height : image?.height * stageSize.height / image?.width;
        const startX = stageSize.width / 2 - (imgDrawWidth / 2);
        const startY = stageSize.height / 2 - (imgDrawHeight / 2);
        setImgDrawDetails({ imgDrawHeight, imgDrawWidth, startX, startY })
        setResizeFactor(image.width / imgDrawWidth)
        setLine(null);
        setDimText("");
        setHoverPos(null);
        setNewLine(null);
        setSelectedRoomId(null)
        setSelectedWindoorId(null)
        setCursor('auto')
        setDrawRect('none')
        newLineRef.current = null;
        hoverPosRef.current = null;
        isDrawing.current = false;
        isDragging.current = false;
    }, [image]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (step == 1) {
                    if (newLineRef.current) {
                        setNewLine(null);
                        newLineRef.current = null;
                        setHoverPos(null);
                        hoverPosRef.current = null;
                    }
                }
                if (step == 2) {
                    setNewRect(null);
                    isDrawing.current = false;
                    setZoneData(unSelectRooms);
                    setDrawRect('none')
                    setSelectedRoomId(null);
                }
            }
            // if (e.ctrlKey && e.key.toLowerCase() === 'g') {
            //     e.preventDefault();
            //     if (step != 2) return;
            //     const selectedRoomIds = Array.from(zoneDataRef.current.rooms.values())
            //         .filter(room => room.selected && room.zone == null)
            //         .map(room => room.id);

            //     if (selectedRoomIds.length === 0) {
            //         alert("No object selected!");
            //         return;
            //     }

            //     const newZone: Zone = {
            //         id: "zone" + zoneData.zones.length,
            //         roomIds: selectedRoomIds,
            //         color: "black",
            //         expanded: false,
            //         name: "Zone" + zoneData.zones.length
            //     };

            //     setZoneData(prev => {
            //         const updatedRooms = new Map(prev.rooms);
            //         const updatedOrphans = prev.orphanRoomIds.filter(id => !selectedRoomIds.includes(id));

            //         // update zone reference inside each room
            //         selectedRoomIds.forEach(id => {
            //             const room = updatedRooms.get(id);
            //             if (room) {
            //                 updatedRooms.set(id, { ...room, zone: newZone.id, selected: false, stroke: newZone.color });
            //             }
            //         });

            //         return {
            //             ...prev,
            //             zones: [...prev.zones, newZone],
            //             rooms: updatedRooms,
            //             orphanRoomIds: updatedOrphans,
            //         };
            //     });
            // }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (move) {
            setCursor('grabbing')
        }
        else if (step == 1) {
            setCursor('crosshair')
        }
        else if (drawRect == 'none') {
            setCursor('auto')
        }
        else {
            setCursor('crosshair')
        }
    }, [move, drawRect])

    const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
        if (newLine) return;
        if (!e.evt.ctrlKey) return;
        else {
            e.evt.preventDefault();
        }
        const scaleBy = 1.05;
        const stage = stageRef.current;
        if (!stage) return;
        const oldScale = stage.scaleX();
        const pointer = stage.getRelativePointerPosition();

        if (oldScale == undefined || pointer == undefined) {
            return;
        }

        const direction = e.evt.deltaY > 0 ? -1 : 1;
        zoomStage(direction > 0 ? "in" : "out", scaleBy)
    };

    const zoomStage = (direction: 'in' | 'out', scaleFactor: number) => {
        const stage = stageRef.current;
        if (!stage) return;

        const oldScale = stage.scaleX();
        const scaleBy = direction === 'in' ? scaleFactor : 1 / scaleFactor;

        const center = {
            x: stage.width() / 2,
            y: stage.height() / 2,
        };

        const mousePointTo = {
            x: (center.x - stage.x()) / oldScale,
            y: (center.y - stage.y()) / oldScale,
        };

        const newScale = oldScale * scaleBy;
        stage.scale({ x: newScale, y: newScale });

        const newPos = {
            x: center.x - mousePointTo.x * newScale,
            y: center.y - mousePointTo.y * newScale,
        };

        stage.position(newPos);
        stage.batchDraw();
    };

    useImperativeHandle(ref, () => ({
        zoomStage,
        handleDelete,
        setDimText
    }));

    const handleDelete = () => {
        if (step == 1) {
            setLine(null);
            setDimText("");
        }
        else if (step == 2) {
            const roomIdsToDelete = Array.from(zoneDataRef.current.rooms.values())
                .filter(room => room.selected)
                .map(room => room.id);

            setZoneData(prev => {
                const newZones = prev.zones.map(zone => ({
                    ...zone,
                    roomIds: zone.roomIds.filter(id => !roomIdsToDelete.includes(id))
                }));
                const newOrphanRoomIds = prev.orphanRoomIds.filter(id => !roomIdsToDelete.includes(id));
                const rooms = new Map(prev.rooms);
                for (const [id, room] of rooms.entries()) {
                    if (room.selected) rooms.set(id, { ...room, selected: false });
                }

                // Remove from the rooms map
                // roomIdsToDelete.forEach(id => {
                //     newRooms.delete(id);
                // });

                return {
                    ...prev,
                    zones: newZones,
                    orphanRoomIds: newOrphanRoomIds,
                    rooms: rooms
                };
            });
            // const selectedRoomIds = rectsRef.current.filter(rect => {
            //     return rect.selected
            // }).map(rect => rect.id);
            // const selectedSet = new Set(selectedRoomIds);
            // setRoomRects(roomRects => {
            //     return roomRects.filter(rect => !rect.selected);
            // })
            // setZoneData(zoneData => {
            //     return {
            //         zones: zoneData.zones.map(zone => ({
            //             ...zone,
            //             rooms: zone.rooms.filter(room => !selectedSet.has(room.id))
            //         })),
            //         rooms: zoneData.rooms.filter(room => !selectedSet.has(room.id))
            //     };
            // });
        }
    };

    const handleMouseDown = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (e.target instanceof Konva.Rect) {
            // For multi-select, we want to track the initial positions of all selected rooms
            if (multiSelect) {
                setZoneData(prev => {
                    const newRooms = new Map(prev.rooms);
                    const selectedRooms = Array.from(prev.rooms.values())
                        .filter(room => room.selected);

                    selectedRooms.forEach(room => {
                        // Prepare children positions
                        const childrenPositions: Record<string, { x: number; y: number }> = {};
                        room.children.forEach(childId => {
                            const child = prev.windoors.get(childId);
                            if (child) {
                                childrenPositions[childId] = {
                                    x: child.pos.x,
                                    y: child.pos.y
                                };
                            }
                        });

                        newRooms.set(room.id, {
                            ...room,
                            dragStartPos: {
                                x: room.pos.x,
                                y: room.pos.y,
                                children: childrenPositions
                            }
                        });
                    });

                    return { ...prev, rooms: newRooms };
                });
            }
            return;
        }
        if (move) {
            isDragging.current = true;
            let clientX = 0;
            let clientY = 0;

            if ('touches' in e.evt) {
                // TouchEvent
                clientX = e.evt.touches[0].clientX;
                clientY = e.evt.touches[0].clientY;
            } else {
                // MouseEvent
                clientX = e.evt.clientX;
                clientY = e.evt.clientY;
            }
            lastPos.current = {
                x: clientX,
                y: clientY,
            };
        } // don’t interfere with zoom
        else if (step == 1) {
            if (line) {
                return;
            }
            const stage = e.target.getStage();
            if (stage == null) {
                return;
            }
            const pointer = stage.getRelativePointerPosition();
            if (!pointer) return;
            if (!imgDrawDetails) {
                return;
            }

            if (newLine) {
                // Finish line
                if (
                    !(pointer.x >= imgDrawDetails?.startX &&
                        pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                        pointer.y >= imgDrawDetails?.startY &&
                        pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight)
                ) {
                    return
                }
                setLine({ points: [...newLine, pointer.x, pointer.y] });

                const dist = Math.sqrt(
                    Math.pow(newLine[0] - pointer.x, 2) +
                    Math.pow(newLine[1] - pointer.y, 2)
                );

                if (image?.width != undefined && imgDrawDetails?.imgDrawWidth != undefined) {
                    const manualScale = image?.width / imgDrawDetails?.imgDrawWidth
                    if (setPixelDist) setPixelDist(manualScale * dist)
                }

                if (setInputModelOpen) setInputModelOpen(true)
                setNewLine(null);
                newLineRef.current = null;
                setHoverPos(null);
                hoverPosRef.current = null;
            } else {
                // Start line

                if (
                    pointer.x >= imgDrawDetails?.startX &&
                    pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                    pointer.y >= imgDrawDetails?.startY &&
                    pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight
                ) {
                    // Proceed with drawing
                    setNewLine([pointer.x, pointer.y]);
                    newLineRef.current = [pointer.x, pointer.y]
                    setHoverPos([pointer.x, pointer.y]);
                    hoverPosRef.current = [pointer.x, pointer.y]
                }
            }
        } else if (step == 2) {
            if (drawRect === 'none') return
            if (isDrawing.current) return;
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getRelativePointerPosition();
            if (!pointer) return;
            if (!pointer || !imgDrawDetails || !(pointer.x >= imgDrawDetails?.startX &&
                pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                pointer.y >= imgDrawDetails?.startY &&
                pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight)) return;
            if (drawRect == 'room') {
                setNewRect({ startPoint: [pointer.x, pointer.y], endPoint: [pointer.x, pointer.y], color: ROOM_COLORS[zoneDataRef.current.rooms.size % ROOM_COLORS.length] });
                isDrawing.current = true;
            }
            else if (drawRect === 'window' || drawRect === 'door') {
                if (multiSelect || !selectedRoomId) {
                    alert("Select a room(only one)");
                    return;
                }
                const room = zoneDataRef.current.rooms.get(selectedRoomId)
                if (!room) return;
                console.log(selectedRoomId);
                if (!isItNear(pointer, room, drawRect === 'door' ? 30 : 20)) {
                    alert("Draw near the room's wall!");
                    return;
                }
                setNewRect({ startPoint: [pointer.x, pointer.y], endPoint: [pointer.x, pointer.y], color: room.stroke });
                isDrawing.current = true;
            }
        }
    };

    const handleMouseMove = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
        if (move) {
            if (!isDragging.current || !lastPos.current) return;

            const stage = stageRef.current;
            if (!stage) return;

            let clientX = 0;
            let clientY = 0;

            if ('touches' in e.evt) {
                // TouchEvent
                clientX = e.evt.touches[0].clientX;
                clientY = e.evt.touches[0].clientY;
            } else {
                // MouseEvent
                clientX = e.evt.clientX;
                clientY = e.evt.clientY;
            }

            const dx = clientX - lastPos.current.x;
            const dy = clientY - lastPos.current.y;

            stage.x(stage.x() + dx);
            stage.y(stage.y() + dy);
            stage.batchDraw();

            lastPos.current = {
                x: clientX,
                y: clientY,
            };
        }
        else if (step == 1) {

            if (!newLine) return;
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getRelativePointerPosition();
            if (!pointer) {
                return;
            }
            if (
                imgDrawDetails &&
                pointer.x >= imgDrawDetails?.startX &&
                pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                pointer.y >= imgDrawDetails?.startY &&
                pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight
            ) {
                setHoverPos([pointer.x, pointer.y])
            }
        }
        else if (step == 2) {
            if (drawRect == 'none') return;
            if (!isDrawing.current || !newRect || !imgDrawDetails) return;
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getRelativePointerPosition();
            if (!pointer) return;
            let clampedX = Math.min(Math.max(pointer.x, imgDrawDetails.startX), imgDrawDetails.startX + imgDrawDetails.imgDrawWidth);
            let clampedY = Math.min(Math.max(pointer.y, imgDrawDetails.startY), imgDrawDetails.startY + imgDrawDetails.imgDrawHeight);
            if (drawRect === 'room') {
                setNewRect((prev) =>
                    prev ? { ...prev, endPoint: [clampedX, clampedY] } : null
                );
            }
            else if (drawRect === 'window' || drawRect === 'door') {
                if (!selectedRoomId) return
                setNewRect((prev) => {
                    const startPoint = prev?.startPoint
                    if (!startPoint) return prev
                    let [x1, y1] = startPoint
                    let length = Math.abs(clampedX - x1);
                    let breadth = Math.abs(clampedY - y1);
                    const room = zoneDataRef.current.rooms.get(selectedRoomId)
                    if (!room) return prev
                    const wall = isItNear({ x: clampedX, y: clampedY }, room, 20)
                    if (wall == null) return prev
                    if (wall == 'h') {
                        clampedX = Math.max(room.pos.x, Math.min(clampedX, room.pos.x + room.pos.length))
                        length = Math.abs(clampedX - x1);
                        breadth = Math.abs(clampedY - y1);
                        if (drawRect === 'window') {
                            return prev ? { ...prev, endPoint: [clampedX, y1 + DEFAULT_WINDOW_BREADTH] } : null
                        }
                        else {
                            const max = Math.min(length > breadth ? length : breadth, MAX_DOOR_SIZE);
                            length = clampedX > x1 ? max : -max
                            breadth = clampedY > y1 ? max : -max
                            return prev ? { ...prev, endPoint: [x1 + length, y1 + breadth] } : null
                        }
                    } else {
                        clampedY = Math.max(room.pos.y, Math.min(clampedY, room.pos.y + room.pos.breadth))
                        length = Math.abs(clampedX - x1);
                        breadth = Math.abs(clampedY - y1);
                        if (drawRect === 'window') {
                            return prev ? { ...prev, endPoint: [x1 + DEFAULT_WINDOW_BREADTH, clampedY] } : null
                        }
                        else {
                            const max = Math.min(length > breadth ? length : breadth, MAX_DOOR_SIZE);
                            length = clampedX > x1 ? max : -max
                            breadth = clampedY > y1 ? max : -max
                            return prev ? { ...prev, endPoint: [x1 + length, y1 + breadth] } : null
                        }
                    }
                })
            }
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        lastPos.current = null;
        if (step == 2) {
            if (drawRect != 'none' && newRect) {
                if (drawRect === 'room') {
                    if (distancePoints(newRect.startPoint, newRect.endPoint) <= 5) return
                    const display = drawRect.charAt(0).toUpperCase() + drawRect.substring(1) + (zoneDataRef.current.rooms.size + 1)
                    const tempRect = getRoomFromCoords({ roomCoords: newRect, id: drawRect.charAt(0).toUpperCase() + (zoneDataRef.current.rooms.size + 1), display, scaleFactor, selected: false, resizeFactor });
                    if (drawRect == 'room') {
                        setZoneData(zoneData => {
                            const rooms = new Map(zoneData.rooms);
                            rooms.set(tempRect.id, tempRect);
                            return { ...zoneData, orphanRoomIds: [...zoneData.orphanRoomIds, tempRect.id], rooms: rooms }
                        })
                    }
                }
                else if (drawRect === 'window' || drawRect === 'door') {
                    if (!selectedRoomId) return;
                    const room = zoneDataRef.current.rooms.get(selectedRoomId);
                    if (!room) return;
                    const [x1, y1] = newRect.startPoint;
                    const [x2, y2] = newRect.endPoint;
                    const length = Math.abs(x2 - x1)
                    const breadth = Math.abs(y2 - y1)
                    if (length * breadth < 100) return
                    const wall = isItNear({ x: x1 + length / 2, y: y1 + breadth / 2 }, room, drawRect === 'window' ? 20 : 30)
                    if (wall) {
                        const id = drawRect.charAt(0).toUpperCase() + (zoneDataRef.current.windoors.size + 1);
                        const display = drawRect.charAt(0).toUpperCase() + drawRect.substring(1) + (zoneDataRef.current.windoors.size + 1);
                        const tempWindoor = getWinDoorFromCoords(newRect, id, display, drawRect, scaleFactor, resizeFactor)
                        tempWindoor.roomId = room.id
                        tempWindoor.horizontal = wall == 'h'
                        room.children.push(id);
                        setZoneData(zoneData => {
                            const windoors = new Map(zoneData.windoors);
                            const rooms = new Map(zoneData.rooms);
                            windoors.set(id, tempWindoor);
                            rooms.set(room.id, room)
                            return { ...zoneData, rooms, windoors }
                        })
                    }
                    else return;
                }
                setNewRect(null);
                isDrawing.current = false;
                setSelectedRoomId(null)
                setZoneData(unSelectRooms)
                setDrawRect('none')
            }
            else {
                if (move || drawRect != 'none') return;
                const stage = stageRef.current;
                if (!stage) return;
                const evtPos = stage.getRelativePointerPosition()!;
                const sortedRoomList = [
                    // Rooms inside zones
                    ...zoneData.zones.flatMap(zone => zone.roomIds),
                    // Orphan rooms
                    ...zoneData.orphanRoomIds
                ].sort((a, b) => {
                    const roomA = zoneData.rooms.get(a);
                    const roomB = zoneData.rooms.get(b);
                    if (!roomA || !roomB) return 0;
                    if (roomA.selected && !roomB.selected) return -1;
                    if (!roomA.selected && roomB.selected) return 1;
                    // Smaller rectangles on top
                    const aSize = Math.abs(roomA.pos.length) * Math.abs(roomA.pos.breadth);
                    const bSize = Math.abs(roomB.pos.length) * Math.abs(roomB.pos.breadth);
                    return aSize - bSize;
                })
                // find topmost rect containing point
                for (const roomId of sortedRoomList) {
                    const r = zoneData.rooms.get(roomId);
                    if (!r) continue;

                    const isInside =
                        evtPos.x >= r.pos.x &&
                        evtPos.x <= r.pos.x + r.pos.length &&
                        evtPos.y >= r.pos.y &&
                        evtPos.y <= r.pos.y + r.pos.breadth;

                    if (!isInside) continue;

                    const newRooms = new Map(zoneData.rooms);

                    // Unselect the previously selected room (if any)
                    if (!multiSelect && selectedRoomId && selectedRoomId !== r.id) {
                        const prev = newRooms.get(selectedRoomId);
                        if (prev) {
                            newRooms.set(selectedRoomId, { ...prev, selected: false });
                        }
                    }
                    multiSelect && selectedRoomId && setSelectedRoomId(null);

                    const wasSelected = r.selected;
                    const shouldSelect = !wasSelected;

                    // Update clicked room's selection
                    newRooms.set(r.id, { ...r, selected: shouldSelect });

                    setZoneData((prev) => ({ ...prev, rooms: newRooms }));

                    // Update selectedRoomId state accordingly
                    !multiSelect && setSelectedRoomId(shouldSelect ? r.id : null);
                    break;
                }

            }
        }
    }

    const handleTouchStart = () => {
        if (step == 1) {

            if (line) {
                return;
            }
            isDrawing.current = true;
            const stage = stageRef.current?.getStage();
            if (!stage) { // Defensive check
                return;
            }
            const pointer = stage?.getRelativePointerPosition();
            if (!pointer) { // Defensive check
                return;
            }
            if (imgDrawDetails && (pointer.x >= imgDrawDetails?.startX &&
                pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                pointer.y >= imgDrawDetails?.startY &&
                pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight)) {

                setNewLine([pointer.x, pointer.y]);
                newLineRef.current = [pointer.x, pointer.y]
            }
        }
    };

    // Touch: pinch zoom and drag
    const handleTouchMove = (e: Konva.KonvaEventObject<TouchEvent>) => {
        const stage = stageRef.current;
        if (!stage || e.evt.touches.length === 0) return;
        const pointer = stage.getRelativePointerPosition();
        if (!pointer) return;
        e.evt.preventDefault();
        if (move) {
            if (!stage || e.evt.touches.length === 0) return;
            if (e.evt.touches.length === 2) {
                e.evt.preventDefault();

                const touch1 = e.evt.touches[0];
                const touch2 = e.evt.touches[1];

                const dist = Math.sqrt(
                    Math.pow(touch1.clientX - touch2.clientX, 2) +
                    Math.pow(touch1.clientY - touch2.clientY, 2)
                );

                if (lastDist.current === null) {
                    lastDist.current = dist;
                    return;
                }

                const scaleBy = dist / lastDist.current;
                const oldScale = stage.scaleX();
                const newScale = oldScale * scaleBy;

                const pointer = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2,
                };

                const mousePointTo = {
                    x: (pointer.x - stage.x()) / oldScale,
                    y: (pointer.y - stage.y()) / oldScale,
                };

                stage.scale({ x: newScale, y: newScale });

                const newPos = {
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                };

                stage.position(newPos);
                stage.batchDraw();

                lastDist.current = dist;
            } else if (e.evt.touches.length === 1) {
                const touch = e.evt.touches[0];

                if (!lastPos.current) {
                    lastPos.current = { x: touch.clientX, y: touch.clientY };
                    return;
                }

                const dx = touch.clientX - lastPos.current.x;
                const dy = touch.clientY - lastPos.current.y;

                stage.x(stage.x() + dx);
                stage.y(stage.y() + dy);
                stage.batchDraw();

                lastPos.current = { x: touch.clientX, y: touch.clientY };
            }
        }
        else if (step == 1) {
            if (!isDrawing.current) {
                return;
            }
            if (!newLine) {
                return;
            }
            if (!(imgDrawDetails && (pointer.x >= imgDrawDetails?.startX &&
                pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                pointer.y >= imgDrawDetails?.startY &&
                pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight))) {
                return;
            }
            setLine({ points: [...newLine, pointer.x, pointer.y] });
            const dist = Math.sqrt(
                Math.pow(newLine[0] - pointer.x, 2) +
                Math.pow(newLine[1] - pointer.y, 2)
            );

            if (image?.width != undefined && imgDrawDetails?.imgDrawWidth != undefined) {
                const manualScale = image?.width / imgDrawDetails?.imgDrawWidth
                if (setPixelDist) setPixelDist(manualScale * dist)
            }
        }
    };

    const handleTouchEnd = () => {
        if (move) {
            lastDist.current = null;
            lastPos.current = null;
            return;
        }
        else if (step == 1) {
            isDrawing.current = false;
            if (setInputModelOpen) setInputModelOpen(true)
            setNewLine(null);
            newLineRef.current = null
            setHoverPos(null);
            hoverPosRef.current = null;
        }
    };

    const [editModelOpen, setEditModelOpen] = useState(false);
    const editModelData = useRef<EditModelDataType>({ itemId: "", breadth: 0, height: 0, length: 0, isRoom: true, name: "Input", isZone: false })

    function openModel(data: EditModelDataType) {
            console.log("Opening edit model for:", data); // Debug log
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
    
    return (
        <div style={{ cursor: cursor }}>
            <Stage
                width={stageSize.width}
                height={stageSize.height}
                ref={stageRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                <Layer ref={layerRef}>
                    {image && <KonvaImage image={image} x={imgDrawDetails?.startX} y={imgDrawDetails?.startY} width={imgDrawDetails?.imgDrawWidth} height={imgDrawDetails?.imgDrawHeight} />}
                    {step == 2 && <Rect
                        x={imgDrawDetails?.startX} y={imgDrawDetails?.startY} width={imgDrawDetails?.imgDrawWidth} height={imgDrawDetails?.imgDrawHeight}
                        fill="black"
                        opacity={0.4} // adjust to control darkness
                        listening={false} // makes it non-interactive
                    />}
                </Layer>
                {step == 1 &&
                    <Layer>
                        {
                            line && <Line
                                points={line?.points}
                                strokeWidth={4}
                                stroke={"red"}
                            />
                        }

                        {
                            line && dimText &&
                            <Label x={(line.points[0] + line.points[2]) / 2} y={((line.points[1] + line.points[3]) / 2) - 30} >
                                <Tag
                                    fill="white"        // Background color
                                    stroke="black"      // Border color
                                    strokeWidth={1}
                                    cornerRadius={4}
                                />
                                <Text
                                    text={dimText}
                                    fontSize={20}
                                    fill="black"
                                    padding={4}     // Adjust horizontal alignment if needed
                                />
                            </Label>

                        }

                        {newLine && hoverPos && (
                            <Line
                                points={[...newLine, ...hoverPos]}
                                stroke="gray"
                                dash={[6, 4]}
                                strokeWidth={4}
                                listening={false} // avoid interference
                            />
                        )}

                        {newLine && (
                            <Circle
                                x={newLine[0]}
                                y={newLine[1]}
                                radius={6}
                                fill="white"
                                stroke="black"
                            />
                        )}
                    </Layer>
                }
                {
                    step == 2 &&
                    <Layer>
                        {[
                            // Rooms inside zones
                            ...zoneData.zones.flatMap(zone => zone.roomIds),
                            // Orphan rooms
                            ...zoneData.orphanRoomIds
                        ].sort((a, b) => {
                            const roomA = zoneData.rooms.get(a);
                            const roomB = zoneData.rooms.get(b);
                            if (!roomA || !roomB) return 0;
                            if (roomA.selected && !roomB.selected) return -1;
                            if (!roomA.selected && roomB.selected) return 1;
                            // Smaller rectangles on top
                            const aSize = Math.abs(roomA.pos.length) * Math.abs(roomA.pos.breadth);
                            const bSize = Math.abs(roomB.pos.length) * Math.abs(roomB.pos.breadth);
                            return bSize - aSize;
                        }).map(roomId => {
                            const room = zoneData.rooms.get(roomId);
                            if (!room) return null;
                            const anySelected = Array.from(zoneData.rooms.values()).some(r => r.selected);
                            const childSelected = !!selectedWindoorId;
                            const parentIdOfSelectedChild = childSelected ? zoneData.windoors.get(selectedWindoorId!)?.roomId : null;
                            const roomOpacity = childSelected
                                ? (room.id === parentIdOfSelectedChild ? 1 : 0.5)
                                : (anySelected ? (room.selected ? 1 : 0.5) : 1);
                            const roomRect = room.pos

                            return <React.Fragment key={room.id}>
                                <Rect
                                    key={room.id}
                                    ref={(node) => {
                                        if (node) {
                                            roomNodeRefs.current.set(room.id, node);
                                        } else {
                                            roomNodeRefs.current.delete(room.id);
                                        }
                                    }}
                                    x={roomRect.x}
                                    y={roomRect.y}
                                    width={roomRect.length}
                                    height={roomRect.breadth}
                                    opacity={roomOpacity}
                                    stroke={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                    strokeWidth={room.selected ? 3 : 2}
                                    draggable={room.selected}
                                    listening={true}
                                    onContextMenu={(e) => {
                                        const stage = e.target.getStage();
                                        if (stage) {
                                            // Prevent default browser context menu
                                            e.evt.preventDefault();
                                            // Stop event from bubbling up
                                            e.evt.stopPropagation();
                                            openModel({
                                                itemId: room.id,
                                                name: room.name,
                                                isZone: false,
                                                isRoom: true,
                                                length: room.dimension.length_ft,
                                                breadth: room.dimension.breadth_ft,
                                                height: room.dimension.ceilingHeight_ft
                                            });
                                        }
                                    }}
                                    // onDragStart={() => {               
                                    //     // Bring to front when dragging starts
                                    //     const node = roomNodeRefs.current.get(room.id);
                                    //     if (node) {
                                    //         node.moveToTop();
                                    //         layerRef.current?.batchDraw();
                                    //     }
                                    //     room.dragStartPos = { x: roomRect.x, y: roomRect.y };
                                    // }}
                                    // onDragMove={(e) => {
                                    //     const node = e.target;
                                    //     const dx = node.x() - room.dragStartPos!.x;
                                    //     const dy = node.y() - room.dragStartPos!.y;
                                        
                                    //     // Update children positions in real-time during drag
                                    //     const updatedRoom = { ...room };
                                    //     updatedRoom.pos.x = node.x();
                                    //     updatedRoom.pos.y = node.y();
                                        
                                    //     // Update children positions
                                    //     updatedRoom.children.forEach(childId => {
                                    //         const child = zoneDataRef.current.windoors.get(childId);
                                    //         if (child) {
                                    //             child.pos.x += dx;
                                    //             child.pos.y += dy;
                                    //         }
                                    //     });
                                        
                                    //     // Update the room's position reference
                                    //     room.dragStartPos = { x: node.x(), y: node.y() };
                                    // }}
                                    // onDragEnd={(e) => {
                                    //     const node = e.target;
                                    //     const dx = node.x() - room.dragStartPos!.x;
                                    //     const dy = node.y() - room.dragStartPos!.y;
                                        
                                    //     setZoneData(prev => {
                                    //         const newRooms = new Map(prev.rooms);
                                    //         const newWindoors = new Map(prev.windoors);
                                            
                                    //         // Update room position
                                    //         const updatedRoom = { 
                                    //             ...room,
                                    //             selected: true,
                                    //             pos: {
                                    //                 ...room.pos,
                                    //                 x: node.x(),
                                    //                 y: node.y()
                                    //             }
                                    //         };
                                    //         newRooms.set(room.id, updatedRoom);
                                            
                                    //         // Update all children positions
                                    //         room.children.forEach(childId => {
                                    //             const child = newWindoors.get(childId);
                                    //             if (child) {
                                    //                 newWindoors.set(childId, {
                                    //                     ...child,
                                    //                     pos: {
                                    //                         ...child.pos,
                                    //                         x: child.pos.x + dx,
                                    //                         y: child.pos.y + dy
                                    //                     }
                                    //                 });
                                    //             }
                                    //         });
                                            
                                    //         return {
                                    //             ...prev,
                                    //             rooms: newRooms,
                                    //             windoors: newWindoors
                                    //         };
                                    //     });
                                    //     // Force update transformer after drag
                                    //     setTimeout(() => {
                                    //         if (transformerRef.current && roomNodeRefs.current.has(room.id)) {
                                    //             transformerRef.current.nodes([roomNodeRefs.current.get(room.id)!]);
                                    //             transformerRef.current.getLayer()?.batchDraw();
                                    //         }
                                    //     }, 0);
                                    // }}
                                    onDragStart={() => {
                                        const node = roomNodeRefs.current.get(room.id);
                                        if (node) {
                                            node.moveToTop();
                                            layerRef.current?.batchDraw();
                                        }
                                        
                                        setZoneData(prev => {
                                            const newRooms = new Map(prev.rooms);
                                            const currentRoom = newRooms.get(room.id);
                                            if (!currentRoom) return prev;

                                            // Prepare children positions
                                            const childrenPositions: Record<string, { x: number; y: number }> = {};
                                            currentRoom.children.forEach(childId => {
                                                const child = prev.windoors.get(childId);
                                                if (child) {
                                                    childrenPositions[childId] = {
                                                        x: child.pos.x,
                                                        y: child.pos.y
                                                    };
                                                }
                                            });

                                            newRooms.set(currentRoom.id, {
                                                ...currentRoom,
                                                dragStartPos: {
                                                    x: currentRoom.pos.x,
                                                    y: currentRoom.pos.y,
                                                    children: childrenPositions
                                                }
                                            });
                                            
                                            return { ...prev, rooms: newRooms };
                                        });
                                    }}
                                    onDragMove={(e) => {
                                        const node = e.target;
                                        const currentRoom = zoneDataRef.current.rooms.get(room.id);
                                        if (!currentRoom?.dragStartPos) return;

                                        const dx = node.x() - currentRoom.dragStartPos.x;
                                        const dy = node.y() - currentRoom.dragStartPos.y;

                                        setZoneData(prev => {
                                            const newRooms = new Map(prev.rooms);
                                            const newWindoors = new Map(prev.windoors);

                                            // Update room position
                                            newRooms.set(currentRoom.id, {
                                                ...currentRoom,
                                                pos: {
                                                    ...currentRoom.pos,
                                                    x: node.x(),
                                                    y: node.y()
                                                }
                                            });

                                            // Update children positions
                                            if (currentRoom.dragStartPos) {
                                                Object.entries(currentRoom.dragStartPos.children).forEach(([childId, startPos]) => {
                                                    const child = newWindoors.get(childId);
                                                    if (child) {
                                                        newWindoors.set(childId, {
                                                            ...child,
                                                            pos: {
                                                                ...child.pos,
                                                                x: startPos.x + dx,
                                                                y: startPos.y + dy
                                                            }
                                                        });
                                                    }
                                                });
                                            }

                                            return { ...prev, rooms: newRooms, windoors: newWindoors };
                                        });
                                    }}
                                    onDragEnd={(e) => {
                                        const node = e.target;
                                        const currentRoom = zoneDataRef.current.rooms.get(room.id);
                                        if (!currentRoom?.dragStartPos) return;

                                        const dx = node.x() - currentRoom.dragStartPos.x;
                                        const dy = node.y() - currentRoom.dragStartPos.y;

                                        setZoneData(prev => {
                                            const newRooms = new Map(prev.rooms);
                                            const newWindoors = new Map(prev.windoors);

                                            // Update room position
                                            newRooms.set(currentRoom.id, {
                                                ...currentRoom,
                                                selected: true,
                                                pos: {
                                                    ...currentRoom.pos,
                                                    x: node.x(),
                                                    y: node.y()
                                                },
                                                dragStartPos: undefined
                                            });

                                            // Update children positions
                                            if (currentRoom.dragStartPos) {
                                                Object.entries(currentRoom.dragStartPos.children).forEach(([childId, startPos]) => {
                                                    const child = newWindoors.get(childId);
                                                    if (child) {
                                                        newWindoors.set(childId, {
                                                            ...child,
                                                            pos: {
                                                                ...child.pos,
                                                                x: startPos.x + dx,
                                                                y: startPos.y + dy
                                                            }
                                                        });
                                                    }
                                                });
                                            }

                                            return { ...prev, rooms: newRooms, windoors: newWindoors };
                                        });

                                        // Reset node position
                                        node.x(currentRoom.pos.x);
                                        node.y(currentRoom.pos.y);
                                    }}
                                    onMouseDown={(e) => {
                                        e.cancelBubble = true;
                                        if (!multiSelect && !room.selected) {
                                            setZoneData(unSelectRooms);
                                        }
                                        setSelectedRoomId(room.id);
                                        setSelectedWindoorId(null);
                                        const node = e.target as Konva.Rect;
                                        node.moveToTop();
                                        // ensure children stay above the room rect
                                        room.children.forEach(childId => {
                                            const childNode = windoorNodeRefs.current.get(childId);
                                            childNode?.moveToTop();
                                        });
                                        layerRef.current?.batchDraw();
                                    }}
                                    onTransformEnd={(e) => {
                                        const node = e.target;
                                        const scaleX = node.scaleX();
                                        const scaleY = node.scaleY();

                                        // --- OLD room values (before transform) from your state object ---
                                        const oldX = room.pos.x;
                                        const oldY = room.pos.y;
                                        const oldWidth = room.pos.length;   // px
                                        const oldHeight = room.pos.breadth; // px

                                        const oldCenterX = oldX + oldWidth / 2;
                                        const oldCenterY = oldY + oldHeight / 2;

                                        // Get new pixel size (minimum constraint)
                                        const newWidthPx = Math.max(10, node.width() * scaleX);
                                        const newHeightPx = Math.max(10, node.height() * scaleY);

                                        // Convert to feet
                                        const newWidthFt = newWidthPx * (scaleFactor * resizeFactor) / 12;
                                        const newHeightFt = newHeightPx * (scaleFactor * resizeFactor) / 12;

                                        // Store new top-left position
                                        const newX = node.x();
                                        const newY = node.y();

                                        // Room center BEFORE resetting scale
                                        const newCenterX = newX + newWidthPx / 2;
                                        const newCenterY  = newY + newHeightPx / 2;

                                        // Reset scale (we bake dimensions into width/height)
                                        node.scaleX(1);
                                        node.scaleY(1);

                                        setZoneData(prev => {
                                            const newRooms = new Map(prev.rooms);
                                            const newWindoors = new Map(prev.windoors);

                                            // Update room data
                                            const updatedRoom = { 
                                                ...room,
                                                selected: true,
                                                pos: {
                                                    x: newX,
                                                    y: newY,
                                                    length: newWidthPx,
                                                    breadth: newHeightPx
                                                },
                                                dimension: {
                                                    ...room.dimension,
                                                    length_ft: newWidthFt,
                                                    breadth_ft: newHeightFt,
                                                    ceilingHeight_ft: room.dimension.ceilingHeight_ft,
                                                    area_ft: newWidthFt * newHeightFt
                                                }
                                            };
                                            newRooms.set(room.id, updatedRoom);

                                            // Update children (scale position & dimensions)
                                            room.children.forEach(childId => {
                                                const child = newWindoors.get(childId);
                                                if (child) {
                                                    // Position relative to old room center
                                                    const relX = child.pos.x - oldCenterX;
                                                    const relY = child.pos.y - oldCenterY;

                                                    // Apply scaling
                                                    const scaledRelX = relX * scaleX;
                                                    const scaledRelY = relY * scaleY;

                                                    // New absolute position
                                                    const newChildX = newCenterX + scaledRelX;
                                                    const newChildY = newCenterY + scaledRelY;

                                                    // Scale dimensions (optional)
                                                    const newChildWidthFt = (child.dimension?.length_ft ?? 0) * scaleX;

                                                    newWindoors.set(childId, {
                                                        ...child,
                                                        pos: {
                                                            ...child.pos,
                                                            x: newChildX,
                                                            y: newChildY
                                                        },
                                                        dimension: {
                                                            ...child.dimension,
                                                            length_ft: newChildWidthFt
                                                        }
                                                    });
                                                }
                                            });

                                            return {
                                                ...prev,
                                                rooms: newRooms,
                                                windoors: newWindoors
                                            };
                                        });

                                        // Force update transformer
                                        setTimeout(() => {
                                            if (transformerRef.current && roomNodeRefs.current.has(room.id)) {
                                                transformerRef.current.nodes([roomNodeRefs.current.get(room.id)!]);
                                                transformerRef.current.getLayer()?.batchDraw();
                                            }
                                        }, 0);
                                    }}
                                />
                                <Label key={room.id + "_label"} x={roomRect.x + roomRect.length / 2 - 20} y={roomRect.y + roomRect.breadth / 2 - 20} listening={false} /*roomRect.y + roomRect.height} */>
                                    <Text
                                        text={room.name}
                                        fontSize={14}
                                        opacity={roomOpacity}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={0}
                                        fontStyle='bold'   // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_dimen"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${room.dimension.length_ft.toFixed(2)} * ${room.dimension.breadth_ft.toFixed(2)} ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 - 10} listening={false}>
                                    <Text
                                        text={`${room.dimension.length_ft.toFixed(2)} * ${room.dimension.breadth_ft.toFixed(2)} ft`}
                                        fontSize={12}
                                        opacity={roomOpacity}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_area"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)} sq ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 + 2} listening={false}>
                                    <Text
                                        text={`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)} sq ft`}
                                        fontSize={12}
                                        opacity={roomOpacity}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_height"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${room.dimension.ceilingHeight_ft.toFixed(2)} ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 + 14} listening={false}>
                                    <Text
                                        text={`${room.dimension.ceilingHeight_ft.toFixed(2)} ft`}
                                        fontSize={12}
                                        opacity={roomOpacity}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                {
                                    room.children.map(windoorId => {
                                        const windoor = zoneData.windoors.get(windoorId);
                                        if (!windoor) return null;
                                        const windoorOpacity = !!selectedWindoorId
                                            ? (windoor.roomId === parentIdOfSelectedChild ? 1 : 0.5)
                                            : (anySelected ? (room.selected ? 1 : 0.5) : 1);
                                        return <React.Fragment key={windoor.id} >
                                            <Rect
                                                key={windoor.id}
                                                id={windoor.id}
                                                ref={(node) => {
                                                    if (node) windoorNodeRefs.current.set(windoor.id, node);
                                                    else windoorNodeRefs.current.delete(windoor.id);
                                                }}
                                                x={windoor.pos.x}
                                                y={windoor.pos.y}
                                                width={windoor.pos.length}
                                                height={windoor.pos.breadth}
                                                 hitStrokeWidth={20}
                                                fill={(selectedWindoorId === windoor.id) ? 'gold' : (room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke)}
                                                opacity={windoorOpacity}
                                                stroke={(selectedWindoorId === windoor.id) ? 'gold' : (room.selected ? 'gold' : 'black')}
                                                strokeWidth={1}
                                                listening={true}
                                                draggable={true}
                                                dragBoundFunc={(pos) => {
                                                    // Constrain movement to wall axis and room bounds; prevent overlap
                                                    const clamped = clampWindoorPosToRoom(windoor.id, pos);
                                                    const next = { x: clamped.x, y: clamped.y, length: windoor.pos.length, breadth: windoor.pos.breadth };
                                                    if (wouldOverlapSiblings(windoor.id, next)) {
                                                        // Reject overlap by staying at current state position
                                                        return { x: windoor.pos.x, y: windoor.pos.y };
                                                    }
                                                    return clamped;
                                                }}
                                                onDragStart={(e) => {
                                                    e.cancelBubble = true;
                                                    setSelectedWindoorId(windoor.id);
                                                    // Store wall used during this drag
                                                    windoorDragStartRef.current.set(windoor.id, {
                                                        x: windoor.pos.x,
                                                        y: windoor.pos.y,
                                                        wall: getAnchoredWallForWindoor(windoor.id)
                                                    });
                                                    // bring to top
                                                    const node = windoorNodeRefs.current.get(windoor.id);
                                                    node?.moveToTop();
                                                    layerRef.current?.batchDraw();
                                                }}
                                                onDragMove={(e) => {
                                                    e.cancelBubble = true;
                                                    const node = e.target as Konva.Rect;
                                                    const clamped = clampWindoorPosToRoom(windoor.id, { x: node.x(), y: node.y() });
                                                    const next = { x: clamped.x, y: clamped.y, length: windoor.pos.length, breadth: windoor.pos.breadth };
                                                    if (wouldOverlapSiblings(windoor.id, next)) {
                                                        // Restore node to previous state visual
                                                        node.x(windoor.pos.x);
                                                        node.y(windoor.pos.y);
                                                        return;
                                                    }
                                                    // Update state live for better feedback
                                                    setZoneData(prev => {
                                                        const wd = prev.windoors.get(windoor.id);
                                                        if (!wd) return prev;
                                                        const newWindoors = new Map(prev.windoors);
                                                        newWindoors.set(windoor.id, { ...wd, pos: { ...wd.pos, x: clamped.x, y: clamped.y } });
                                                        return { ...prev, windoors: newWindoors };
                                                    });
                                                }}
                                                onDragEnd={(e) => {
                                                    e.cancelBubble = true;
                                                    const node = e.target as Konva.Rect;
                                                    const clamped = clampWindoorPosToRoom(windoor.id, { x: node.x(), y: node.y() });
                                                    const next = { x: clamped.x, y: clamped.y, length: windoor.pos.length, breadth: windoor.pos.breadth };
                                                    if (wouldOverlapSiblings(windoor.id, next)) {
                                                        // Revert to prior
                                                        node.x(windoor.pos.x);
                                                        node.y(windoor.pos.y);
                                                        return;
                                                    }
                                                    setZoneData(prev => {
                                                        const wd = prev.windoors.get(windoor.id);
                                                        if (!wd) return prev;
                                                        const newWindoors = new Map(prev.windoors);
                                                        newWindoors.set(windoor.id, { ...wd, pos: { ...wd.pos, x: clamped.x, y: clamped.y } });
                                                        return { ...prev, windoors: newWindoors };
                                                    });
                                                    // ensure selected node stays bound to transformer
                                                    const selected = windoorNodeRefs.current.get(windoor.id);
                                                    if (selected && windoorTransformerRef.current) {
                                                        windoorTransformerRef.current.nodes([selected]);
                                                        selected.moveToTop();
                                                        layerRef.current?.batchDraw();
                                                    }
                                                }}
                                                onMouseDown={(e) => {
                                                    e.cancelBubble = true;
                                                    // Selecting a windoor deselects rooms for transformer clarity
                                                    setZoneData(unSelectRooms);
                                                    setSelectedRoomId(null);
                                                    setSelectedWindoorId(windoor.id);
                                                     const node = windoorNodeRefs.current.get(windoor.id);
                                                     if (node && windoorTransformerRef.current) {
                                                         windoorTransformerRef.current.nodes([node]);
                                                         node.moveToTop();
                                                         layerRef.current?.batchDraw();
                                                     }
                                                }}
                                                 onClick={(e) => {
                                                     e.cancelBubble = true;
                                                     setZoneData(unSelectRooms);
                                                     setSelectedRoomId(null);
                                                     setSelectedWindoorId(windoor.id);
                                                 }}
                                                 onTap={(e) => {
                                                     e.cancelBubble = true;
                                                     setZoneData(unSelectRooms);
                                                     setSelectedRoomId(null);
                                                     setSelectedWindoorId(windoor.id);
                                                 }}
                                                onContextMenu={(e) => {
                                                    const stage = e.target.getStage();
                                                    if (stage) {
                                                        e.evt.preventDefault();
                                                        e.evt.stopPropagation();
                                                        setSelectedWindoorId(windoor.id);
                                                        openModel({
                                                            itemId: windoor.id,
                                                            name: windoor.name,
                                                            isZone: false,
                                                            isRoom: false,
                                                            length: windoor.dimension.length_ft,
                                                            breadth: 0,
                                                            height: windoor.dimension.height_ft
                                                        });
                                                    }
                                                }}
                                            />
                                            <Label key={windoor.id + "_label"} x={windoor.pos.x + windoor.pos.length / 2 - 6} y={windoor.pos.y + windoor.pos.breadth / 2 - (windoor.type == 'window' ? 4 : 15)} listening={false}>
                                                <Text
                                                    text={windoor.id}
                                                    fontSize={10}
                                                    opacity={windoorOpacity}
                                                    fill={room.selected ? 'black' : room.zone && room.zoneColor ? 'black' : 'black'}
                                                    padding={0}
                                                    fontStyle='bold'   // Adjust horizontal alignment if needed
                                                />
                                            </Label>
                                            <Label key={windoor.id + "_dimen"}
                                                x={windoor.type == 'window' ? windoor.horizontal ? windoor.pos.x + windoor.pos.length / 2 - 10 : windoor.pos.x + windoor.pos.length + 2
                                                    : windoor.pos.x + windoor.pos.length / 2 - 20
                                                }
                                                y={windoor.type == 'window' ? windoor.horizontal ? windoor.pos.y + windoor.pos.breadth + 2 : windoor.pos.y + windoor.pos.breadth / 2 - 10
                                                    : windoor.pos.y + windoor.pos.breadth / 2 - 5
                                                }
                                                listening={false}>
                                                <Text
                                                    text={`${windoor.dimension.length_ft.toFixed(2)} ft x \n ${windoor.dimension.height_ft.toFixed(2)} ft`}
                                                    fontSize={10}
                                                    opacity={windoorOpacity}
                                                    fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                                    padding={0}
                                                    fontStyle='bold'   // Adjust horizontal alignment if needed
                                                />
                                            </Label>
                                        </React.Fragment>
                                    })
                                }
                                {/* {
                                    room.selected &&
                                    getRoomAnchors(room).map((anchor, idx) => (
                                        <Circle
                                            key={room.id + "_anchor_" + anchor.type}
                                            x={anchor.x}
                                            y={anchor.y}
                                            radius={4}
                                            fill="white"
                                            stroke="black"
                                            strokeWidth={1}
                                            draggable
                                            dragOnTop
                                            onDragMove={(e) =>
                                                handleAnchorDrag(room.id, anchor.type, e.target.x(), e.target.y())
                                            }
                                            hitStrokeWidth={20}
                                        // onMouseEnter={(e) => {
                                        //     const container = stageRef.current?.container();
                                        //     if (container) {
                                        //         container.style.cursor = getCursorForAnchor(anchor.type, cursor);
                                        //     }
                                        // }}
                                        // onMouseLeave={(e) => {
                                        //     const container = stageRef.current?.container();
                                        //     if (container) {
                                        //         container.style.cursor = cursor;
                                        //     }
                                        // }}
                                        // onDragEnd={(e) => {
                                        //     const container = stageRef.current?.container();
                                        //     if (container) {
                                        //         container.style.cursor = cursor; // ✅ Reset cursor here
                                        //     }
                                        // }}
                                        />
                                    ))
                                } */}
                            </React.Fragment>;
                        })}
                        {newRect && (
                            <Rect
                                x={Math.min(newRect.startPoint[0], newRect.endPoint[0])}
                                y={Math.min(newRect.startPoint[1], newRect.endPoint[1])}
                                width={Math.abs(newRect.endPoint[0] - newRect.startPoint[0])}
                                height={Math.abs(newRect.endPoint[1] - newRect.startPoint[1])}
                                dash={[4, 4]}
                                stroke='grey'
                                strokeWidth={2}
                                listening={false}
                            />
                        )}
                        <Transformer
                            ref={transformerRef}
                            rotateEnabled={false}
                            anchorSize={6}
                            boundBoxFunc={(oldBox, newBox) => {
                                // Prevent shrinking too small
                                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                                return newBox;
                            }}
                            onTransformStart={() => {
                                if (!multiSelect) return;
                                
                                // Store initial positions and dimensions for all selected rooms
                                const selectedRooms = Array.from(zoneDataRef.current.rooms.values())
                                    .filter(room => room.selected);
                                    
                                selectedRooms.forEach(room => {
                                    room.transformStartState = {
                                        x: room.pos.x,
                                        y: room.pos.y,
                                        width: room.pos.length,
                                        height: room.pos.breadth
                                    };
                                });
                            }}
                            onTransform={(e) => {
                                if (!multiSelect) return;
                                
                                const nodes = transformerRef.current?.nodes();
                                if (!nodes || nodes.length === 0) return;
                                
                                // Calculate average scale from all selected rooms
                                let avgScaleX = 0;
                                let avgScaleY = 0;
                                nodes.forEach(node => {
                                    avgScaleX += node.scaleX();
                                    avgScaleY += node.scaleY();
                                });
                                avgScaleX /= nodes.length;
                                avgScaleY /= nodes.length;
                                
                                // Update all selected rooms in real-time during transform
                                const updatedRooms = new Map(zoneDataRef.current.rooms);
                                const updatedWindoors = new Map(zoneDataRef.current.windoors);
                                
                                nodes.forEach(node => {
                                    const roomId = node.id();
                                    const room = updatedRooms.get(roomId);
                                    if (!room || !room.transformStartState) return;
                                    
                                    // Calculate new position and dimensions
                                    const newX = room.transformStartState.x * avgScaleX;
                                    const newY = room.transformStartState.y * avgScaleY;
                                    const newWidth = room.transformStartState.width * avgScaleX;
                                    const newHeight = room.transformStartState.height * avgScaleY;
                                    
                                    // Update room
                                    updatedRooms.set(roomId, {
                                        ...room,
                                        pos: {
                                            x: newX,
                                            y: newY,
                                            length: newWidth,
                                            breadth: newHeight
                                        },
                                        dimension: {
                                            ...room.dimension,
                                            length_ft: (newWidth * (scaleFactor * resizeFactor)) / 12,
                                            breadth_ft: (newHeight * (scaleFactor * resizeFactor)) / 12,
                                            area_ft: (newWidth * newHeight * Math.pow(scaleFactor * resizeFactor, 2)) / 144
                                        }
                                    });
                                    
                                    // Update children (windows/doors)
                                    room.children.forEach(childId => {
                                        const child = updatedWindoors.get(childId);
                                        if (child && child.transformStartState) {
                                            const childScaleX = child.transformStartState.width / newWidth;
                                            const childScaleY = child.transformStartState.height / newHeight;
                                            
                                            updatedWindoors.set(childId, {
                                                ...child,
                                                pos: {
                                                    x: newX + (child.transformStartState.x - room.transformStartState!.x) * childScaleX,
                                                    y: newY + (child.transformStartState.y - room.transformStartState!.y) * childScaleY,
                                                    length: child.transformStartState.width * childScaleX,
                                                    breadth: child.transformStartState.height * childScaleY
                                                },
                                                dimension: {
                                                    ...child.dimension,
                                                    length_ft: (child.transformStartState.width * childScaleX * (scaleFactor * resizeFactor)) / 12,
                                                    height_ft: (child.transformStartState.height * childScaleY * (scaleFactor * resizeFactor)) / 12
                                                }
                                            });
                                        }
                                    });
                                });
                                
                                // Apply updates
                                setZoneData(prev => ({
                                    ...prev,
                                    rooms: updatedRooms,
                                    windoors: updatedWindoors
                                }));
                            }}
                            onTransformEnd={(e) => {
                                e.cancelBubble = true;
                                
                                const nodes = transformerRef.current?.nodes();
                                if (!nodes) return;
                                
                                if (multiSelect) {
                                    // Finalize transform for all selected rooms
                                    const updatedRooms = new Map(zoneDataRef.current.rooms);
                                    const updatedWindoors = new Map(zoneDataRef.current.windoors);
                                    
                                    nodes.forEach(node => {
                                        const roomId = node.id();
                                        const room = updatedRooms.get(roomId);
                                        if (!room || !room.transformStartState) return;
                                        
                                        // Reset scale after transform
                                        node.scaleX(1);
                                        node.scaleY(1);
                                        
                                        // Update room dimensions
                                        const newWidth = node.width();
                                        const newHeight = node.height();
                                        
                                        updatedRooms.set(roomId, {
                                            ...room,
                                            pos: {
                                                x: node.x(),
                                                y: node.y(),
                                                length: newWidth,
                                                breadth: newHeight
                                            },
                                            dimension: {
                                                ...room.dimension,
                                                length_ft: (newWidth * (scaleFactor * resizeFactor)) / 12,
                                                breadth_ft: (newHeight * (scaleFactor * resizeFactor)) / 12,
                                                area_ft: (newWidth * newHeight * Math.pow(scaleFactor * resizeFactor, 2)) / 144
                                            }
                                        });
                                        
                                        // Update children
                                        room.children.forEach(childId => {
                                            const child = updatedWindoors.get(childId);
                                            if (child) {
                                                updatedWindoors.set(childId, {
                                                    ...child,
                                                    pos: {
                                                        ...child.pos,
                                                        x: child.pos.x + (node.x() - room.transformStartState!.x),
                                                        y: child.pos.y + (node.y() - room.transformStartState!.y)
                                                    }
                                                });
                                            }
                                        });
                                    });
                                    
                                    setZoneData(prev => ({
                                        ...prev,
                                        rooms: updatedRooms,
                                        windoors: updatedWindoors
                                    }));
                                } else {
                                    // Single room transform (original behavior)
                                    const node = nodes[0];
                                    const roomId = node.id();
                                    const room = zoneDataRef.current.rooms.get(roomId);
                                    if (!room) return;
                                    
                                    const scaleX = node.scaleX();
                                    const scaleY = node.scaleY();
                                    
                                    // ... (keep your existing single-room transform logic here)
                                }
                                
                                // Update transformer
                                setTimeout(() => {
                                    if (transformerRef.current) {
                                        const selectedNodes = Array.from(zoneData.rooms.values())
                                            .filter(room => room.selected)
                                            .map(room => roomNodeRefs.current.get(room.id))
                                            .filter(Boolean) as Konva.Rect[];
                                        
                                        transformerRef.current.nodes(selectedNodes);
                                        transformerRef.current.getLayer()?.batchDraw();
                                    }
                                }, 0);
                            }}
                        />
                        {/* Transformer for windoors */}
                        <Transformer
                            ref={windoorTransformerRef}
                            rotateEnabled={false}
                            anchorSize={6}
                            enabledAnchors={windoorEnabledAnchors}
                            ignoreStroke={true}
                            boundBoxFunc={(oldBox, newBox) => {
                                const id = selectedWindoorId || (windoorTransformerRef.current?.nodes()[0]?.id?.() as string | undefined);
                                if (!id) return oldBox;
                                const wd = zoneDataRef.current.windoors.get(id);
                                if (!wd) return oldBox;
                                const room = getRoomForWindoor(id);
                                if (!room) return oldBox;

                                // Minimum size
                                let width = Math.max(6, newBox.width);
                                let height = Math.max(6, newBox.height);
                                let x = newBox.x;
                                let y = newBox.y;

                                if (wd.type === 'window') {
                                    if (wd.horizontal) {
                                        height = wd.pos.breadth;
                                        // remove border lock: keep proposed y
                                    } else {
                                        width = wd.pos.length;
                                        // remove border lock: keep proposed x
                                    }
                                } else {
                                    const sizePx = Math.min(Math.max(width, height), MAX_DOOR_SIZE);
                                    width = sizePx;
                                    height = sizePx;
                                    // remove border lock: keep proposed x/y
                                }

                                // Border restrictions removed: do not clamp to room

                                const proposed = { x, y, length: width, breadth: height };
                                if (wouldOverlapSiblings(id, proposed)) return oldBox;
                                return { ...newBox, x, y, width, height };
                            }}
                            onTransformEnd={() => {
                                const node = windoorTransformerRef.current?.nodes()[0] as Konva.Rect | undefined;
                                if (!node) return;
                                const id = node.id() as string;
                                const wd = zoneDataRef.current.windoors.get(id);
                                const room = wd ? zoneDataRef.current.rooms.get(wd.roomId) : null;
                                if (!wd || !room) return;

                                let newW = Math.max(6, node.width() * node.scaleX());
                                let newH = Math.max(6, node.height() * node.scaleY());
                                let newX = node.x();
                                let newY = node.y();

                                if (wd.type === 'window') {
                                    if (wd.horizontal) {
                                        newH = wd.pos.breadth;
                                    } else {
                                        newW = wd.pos.length;
                                    }
                                } else {
                                    const sizePx = Math.min(Math.max(newW, newH), MAX_DOOR_SIZE);
                                    newW = sizePx;
                                    newH = sizePx;
                                    // remove border lock: keep proposed x/y
                                }

                                // Border restrictions removed: do not clamp to room

                                const proposed = { x: newX, y: newY, length: newW, breadth: newH };
                                if (wouldOverlapSiblings(id, proposed)) {
                                    node.scaleX(1); node.scaleY(1);
                                    return;
                                }

                                setZoneData(prev => {
                                    const wdPrev = prev.windoors.get(id);
                                    if (!wdPrev) return prev;
                                    const newWindoors = new Map(prev.windoors);
                                    newWindoors.set(id, {
                                        ...wdPrev,
                                        pos: { ...wdPrev.pos, x: newX, y: newY, length: newW, breadth: newH },
                                        dimension: {
                                            ...wdPrev.dimension,
                                            length_ft: (wdPrev.horizontal ? (newW * (scaleFactor * resizeFactor) / 12) : (newH * (scaleFactor * resizeFactor) / 12))
                                        }
                                    });
                                    return { ...prev, windoors: newWindoors };
                                });

                                node.scaleX(1); node.scaleY(1);
                            }}
                        />
                    </Layer>
                }
            </Stage>
            <EditModel open={editModelOpen} data={editModelData.current} onClose={closeModel} onSave={editValues} />
        </div >
    )
});

Canvas.displayName = "Canvas";

export default Canvas;