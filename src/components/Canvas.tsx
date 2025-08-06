'use client'

import { Stage, Layer, Text, Rect, Line, Label, Tag, Image as KonvaImage, Circle, Transformer } from 'react-konva';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Konva from 'konva';
import { DEFAULT_WINDOW_BREADTH, getRoomFromCoords, getWinDoorFromCoords, isItNear } from './EditView';
import { useStep } from '@/app/context/StepContext';
import { useCanvas } from '@/app/context/CanvasContext';
import { useZone, Zone, ZoneData, Room, WinDoor } from '@/app/context/ZoneContext';

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

function getRoomAnchors(room: Room) {
    const { x, y, length, breadth } = room.pos;
    return [
        { x: x, y: y, type: 'tl' },                             // top-left
        { x: x + length, y: y, type: 'tr' },                    // top-right
        { x: x, y: y + breadth, type: 'bl' },                   // bottom-left
        { x: x + length, y: y + breadth, type: 'br' },          // bottom-right
    ];
}

function getCursorForAnchor(type: string, defaultCursor: string): string {
    switch (type) {
        case 'tl': return 'nwse-resize';
        case 'tr': return 'nesw-resize';
        case 'bl': return 'nesw-resize';
        case 'br': return 'nwse-resize';
        default: return defaultCursor;
    }
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ image, move, setInputModelOpen, setPixelDist, stageSize, drawRect, setDrawRect }, ref) => {
    const { step } = useStep();
    const [imgDrawDetails, setImgDrawDetails] = useState<ImgDrawDetails>();
    const stageRef = useRef<Konva.Stage>(null);
    const layerRef = useRef<Konva.Layer>(null);
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
    const { scaleFactor } = useCanvas();
    const [newRect, setNewRect] = useState<RectCoord | null>(null);
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const { zoneData, setZoneData, multiSelect } = useZone();
    const zoneDataRef = useRef<ZoneData>({ zones: [], orphanRoomIds: [], rooms: new Map<string, Room>(), windoors: new Map<string, WinDoor>() });
    const [cursor, setCursor] = useState<'grabbing' | 'crosshair' | 'auto'>('auto');

    // useEffect(() => {
    //     if (transformerRef.current && roomNodeRef.current) {
    //         transformerRef.current.nodes([roomNodeRef.current]);
    //         transformerRef.current.getLayer()?.batchDraw();
    //     }
    // }, [selectedRoomId, zoneData]);

    // useEffect(() => {
    //     if (!selectedRoomId) {
    //         roomNodeRef.current = null;
    //         if (!transformerRef.current) return;
    //         transformerRef.current.nodes([]);
    //         transformerRef.current.getLayer()?.batchDraw();
    //     }
    // }, [selectedRoomId]);

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
        setLine(null);
        setDimText("");
        setHoverPos(null);
        setNewLine(null);
        newLineRef.current = null;
        hoverPosRef.current = null;
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

                // Remove from the rooms map
                // roomIdsToDelete.forEach(id => {
                //     newRooms.delete(id);
                // });

                return {
                    ...prev,
                    zones: newZones,
                    orphanRoomIds: newOrphanRoomIds
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
                setNewRect({ startPoint: [pointer.x, pointer.y], endPoint: [pointer.x, pointer.y], color: 'blue' });
                isDrawing.current = true;
            }
            else if (drawRect === 'window' || drawRect === 'door') {
                if (multiSelect || !selectedRoomId) {
                    alert("Select a room(only one)");
                    return;
                }
                const room = zoneDataRef.current.rooms.get(selectedRoomId)
                if (!room) return;
                if (!isItNear(pointer, room)) {
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
            const clampedX = Math.min(Math.max(pointer.x, imgDrawDetails.startX), imgDrawDetails.startX + imgDrawDetails.imgDrawWidth);
            const clampedY = Math.min(Math.max(pointer.y, imgDrawDetails.startY), imgDrawDetails.startY + imgDrawDetails.imgDrawHeight);
            if (drawRect === 'room') {
                setNewRect((prev) =>
                    prev ? { ...prev, endPoint: [clampedX, clampedY] } : null
                );
            }
            else if (drawRect === 'window') {
                setNewRect((prev) => {
                    const startPoint = prev?.startPoint
                    if (!startPoint) return prev
                    let [x1, y1] = startPoint
                    let length = Math.abs(clampedX - x1);
                    let breadth = Math.abs(clampedY - y1);
                    if (length >= breadth) {
                        return prev ? { ...prev, endPoint: [clampedX, y1 + DEFAULT_WINDOW_BREADTH] } : null
                    }
                    else {
                        return prev ? { ...prev, endPoint: [x1 + DEFAULT_WINDOW_BREADTH, clampedY] } : null
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
                    const tempRect = getRoomFromCoords({ roomCoords: newRect, id: drawRect.charAt(0).toUpperCase() + (zoneDataRef.current.rooms.size + 1), display, scaleFactor, selected: false });
                    if (drawRect == 'room') {
                        setZoneData(zoneData => {
                            const rooms = new Map(zoneData.rooms);
                            rooms.set(tempRect.id, tempRect);
                            return { ...zoneData, orphanRoomIds: [...zoneData.orphanRoomIds, tempRect.id], rooms: rooms }
                        })
                    }
                }
                else if (drawRect === 'window') {
                    if (!selectedRoomId) return;
                    const room = zoneDataRef.current.rooms.get(selectedRoomId);
                    if (!room) return;
                    const [x1, y1] = newRect.startPoint;
                    const [x2, y2] = newRect.endPoint;
                    const length = Math.abs(x2 - x1)
                    const breadth = Math.abs(y2 - y1)
                    if (length * breadth < 100) return
                    if (isItNear({ x: x1 + length / 2, y: y1 + breadth / 2 }, room)) {
                        const id = "W" + (zoneDataRef.current.windoors.size + 1);
                        const display = "Window" + (zoneDataRef.current.windoors.size + 1);
                        const tempWindow = getWinDoorFromCoords(newRect, id, display, 'window', scaleFactor)
                        room.children.push(id);
                        setZoneData(zoneData => {
                            const windoors = new Map(zoneData.windoors);
                            const rooms = new Map(zoneData.rooms);
                            windoors.set(id, tempWindow);
                            rooms.set(room.id, room)
                            return { ...zoneData, rooms, windoors }
                        })
                    }
                    else return;
                }
                setNewRect(null);
                isDrawing.current = false;
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

    function updateRoomPosition(id: string, x: number, y: number) {
        setZoneData((prev) => {
            const updated = new Map(prev.rooms);
            const room = updated.get(id);
            if (!room) return prev;

            updated.set(id, { ...room, pos: { ...room.pos, x, y } });
            return { ...prev, rooms: updated };
        });
    }


    function updateRoomTransform(id: string, x: number, y: number, width: number, height: number) {
        setZoneData((prev) => {
            const updated = new Map(prev.rooms);
            const room = updated.get(id);
            if (!room) return prev;

            updated.set(id, {
                ...room,
                pos: { x, y, length: width, breadth: height },
                dimension: {
                    ...room.dimension,
                    length_ft: width / 10,
                    breadth_ft: height / 10,
                },
            });
            return { ...prev, rooms: updated };
        });
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
                            const roomRect = room.pos

                            return <React.Fragment key={room.id}>
                                <Rect
                                    key={room.id}
                                    x={roomRect.x}
                                    y={roomRect.y}
                                    width={roomRect.length}
                                    height={roomRect.breadth}
                                    stroke={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                    strokeWidth={room.selected ? 2 : 3}
                                />
                                <Label key={room.id + "_label"} x={roomRect.x + roomRect.length / 2 - 20} y={roomRect.y + roomRect.breadth / 2 - 20} /*roomRect.y + roomRect.height} */>
                                    <Text
                                        text={room.name}
                                        fontSize={14}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={0}
                                        fontStyle='bold'   // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_dimen"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${room.dimension.length_ft.toFixed(2)} * ${room.dimension.breadth_ft.toFixed(2)} ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 - 10}>
                                    <Text
                                        text={`${room.dimension.length_ft.toFixed(2)} * ${room.dimension.breadth_ft.toFixed(2)} ft`}
                                        fontSize={12}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_area"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)} sq ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 + 2}>
                                    <Text
                                        text={`${(room.dimension.length_ft * room.dimension.breadth_ft).toFixed(2)} sq ft`}
                                        fontSize={12}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                <Label key={room.id + "_height"} x={roomRect.x + roomRect.length / 2 - getWordSize(`${room.dimension.ceilingHeight_ft.toFixed(2)} ft`, 5) / 2} y={roomRect.y + roomRect.breadth / 2 + 14}>
                                    <Text
                                        text={`${room.dimension.ceilingHeight_ft.toFixed(2)} ft`}
                                        fontSize={12}
                                        fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                        padding={4}     // Adjust horizontal alignment if needed
                                    />
                                </Label>
                                {
                                    room.children.map(windoorId => {
                                        const windoor = zoneData.windoors.get(windoorId);
                                        if (!windoor) return null;
                                        return <React.Fragment key={windoor.id} >
                                            <Rect
                                                key={windoor.id}
                                                x={windoor.pos.x}
                                                y={windoor.pos.y}
                                                width={windoor.pos.length}
                                                height={windoor.pos.breadth}
                                                stroke={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
                                                strokeWidth={1}
                                                listening={false}
                                            />
                                            <Label key={windoor.id + "_label"} x={windoor.pos.x + windoor.pos.length / 2 - 6} y={windoor.pos.y + windoor.pos.breadth / 2 - (windoor.type == 'window' ? 4 : 15)} >
                                                <Text
                                                    text={windoor.id}
                                                    fontSize={10}
                                                    fill={room.selected ? 'gold' : room.zone && room.zoneColor ? room.zoneColor : room.stroke}
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
                                                }>
                                                <Text
                                                    text={`${windoor.dimension.length_ft.toFixed(2)} ft x \n ${windoor.dimension.height_ft.toFixed(2)} ft`}
                                                    fontSize={10}
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
                        {/* <Transformer
                            ref={transformerRef}
                            rotateEnabled={false} // or true if needed
                            anchorSize={6}
                            boundBoxFunc={(oldBox, newBox) => {
                                // Optional: prevent shrinking too small
                                if (newBox.width < 10 || newBox.height < 10) return oldBox;
                                return newBox;
                            }}
                        /> */}
                    </Layer>
                }
            </Stage>
        </div >
    )
});

Canvas.displayName = "Canvas";

export default Canvas;