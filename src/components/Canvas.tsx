'use client'

import { Stage, Layer, Text, Rect, Line, Label, Tag, Image as KonvaImage, Circle } from 'react-konva';
import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import Konva from 'konva';
import { useStep } from '@/app/context/StepContext';
import { useCanvas } from '@/app/context/CanvasContext';
import { useZone, ZoneType } from '@/app/context/ZoneContext';
import { randomUUID } from 'crypto';

export type CanvasHandle = {
    zoomStage: (direction: "in" | "out", scaleFactor: number) => void;
    handleDelete: () => void;
    setDimText: (dimText: string) => void
};

type CanvasProps = {
    image: HTMLImageElement | null;
    move: boolean,
    drawRect: 'none' | 'room' | 'door' | 'window',
    setInputModelOpen: ((inputModelOpen: boolean) => void) | null,
    setPixelDist: ((pixelDist: number) => void) | null,
    stageSize: { width: number, height: number },
};

type Point = [number, number]

type RectType = {
    id: string;
    type: 'room' | 'door' | 'window';
    x: number;
    y: number;
    width: number;
    height: number;
    stroke: string;
    selected: boolean,
    zone: number | null
};

type RoomCoord = {
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

function getRectFromCoords(roomCoords: RoomCoord, id: string, type: 'room' | 'door' | 'window') {
    const [x1, y1] = roomCoords.startPoint;
    const [x2, y2] = roomCoords.endPoint;
    const x = Math.min(x1, x2);
    const y = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    return {
        id, x, y, width, type, stroke: roomCoords.color, height, selected: false, zone: null
    }
}

const Canvas = forwardRef<CanvasHandle, CanvasProps>(({ image, move, setInputModelOpen, setPixelDist, stageSize, drawRect }, ref) => {
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
    const isDrawing = useRef(false);
    const [dimText, setDimText] = useState<string>("");
    const { roomCoords, doorCoords, windowCoords } = useCanvas();
    const [rects, setRects] = useState<RectType[]>([]);
    const [newRect, setNewRect] = useState<RoomCoord | null>(null);
    const rectsRef = useRef<RectType[]>([]);
    const { zones, setZones } = useZone();
    const zonesRef = useRef<ZoneType[]>([]);

    useEffect(() => {
        rectsRef.current = rects;
    }, [rects]);

    useEffect(() => {
        zonesRef.current = zones;
    }, [zones]);

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
    }, [stageSize, image]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (step == 1) {
                    if (newLine) {
                        setNewLine(null);
                        setHoverPos(null);
                    }
                }
                if (step == 2) {
                    setNewRect(null);
                    isDrawing.current = false;
                    setRects((rects) => {
                        return rects.map((rect) => {
                            return { ...rect, selected: false };
                        })
                    })
                }
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'g') {
                e.preventDefault();
                if (step != 2) return;
                const selectedRects = rectsRef.current.filter(rect => {
                    return rect.selected && rect.zone == null
                });
                if (selectedRects.length == 0) {
                    alert("No object selected!");
                    return;
                };
                const zones = zonesRef.current
                const zoneRects = selectedRects.map(rect => {

                    return { expanded: false, id: rect.id, type: rect.type, dimension: { length: null, breadth: null }, area: null, child: null }
                })
                const zone: ZoneType = { rects: zoneRects, color: "black", expanded: false };
                setZones([...zones, zone])
                setRects((rects) => {
                    return rects.map(rect => {
                        if (rect.selected && rect.zone == null) {
                            rect.stroke = "black"
                            rect.zone = zones.length;
                        }
                        rect.selected = false;
                        return rect
                    })
                })
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        const rects: RectType[] = [];
        if (roomCoords) roomCoords.forEach((room, index) => {
            const id = randomUUID();
            rects.push(getRectFromCoords({ startPoint: [room.startPoint[0], room.startPoint[1]], endPoint: [room.endPoint[0], room.endPoint[1]], color: room.color }, id, 'room'));
        })
        if (doorCoords) doorCoords.forEach((door, index) => {
            const id = "door" + index;
            rects.push(getRectFromCoords({ startPoint: [door.startPoint[0], door.startPoint[1]], endPoint: [door.endPoint[0], door.endPoint[1]], color: door.color }, id, 'door'));
        })
        if (windowCoords) windowCoords.forEach((window, index) => {
            const id = "window" + index;
            rects.push(getRectFromCoords({ startPoint: [window.startPoint[0], window.startPoint[1]], endPoint: [window.endPoint[0], window.endPoint[1]], color: window.color }, id, 'window'));
        })
        const sortedRects = [...rects].sort((a, b) => {
            // Smaller rectangles on top
            const aSize = Math.abs(a.width) * Math.abs(a.height);
            const bSize = Math.abs(b.width) * Math.abs(b.height);
            return bSize - aSize;
        });
        setRects(sortedRects);
    }, [roomCoords, doorCoords, windowCoords])

    useEffect(() => {
        if (drawRect == 'none') {
            document.body.style.cursor = 'auto';
        }
        else {
            document.body.style.cursor = 'crosshair';
        }
    }, [drawRect])

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
            document.body.style.cursor = 'grabbing';
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
                setHoverPos(null);
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
                    setHoverPos([pointer.x, pointer.y]);
                }
            }
        } else if (step == 2) {
            if (drawRect == 'none') return;
            if (isDrawing.current) return;
            const stage = stageRef.current;
            if (!stage) return;
            const pointer = stage.getRelativePointerPosition();
            if (!pointer || !imgDrawDetails || !(pointer.x >= imgDrawDetails?.startX &&
                pointer.x <= imgDrawDetails?.startX + imgDrawDetails.imgDrawWidth &&
                pointer.y >= imgDrawDetails?.startY &&
                pointer.y <= imgDrawDetails?.startY + imgDrawDetails.imgDrawHeight)) return;

            setNewRect({ startPoint: [pointer.x, pointer.y], endPoint: [pointer.x, pointer.y], color: 'blue' });
            isDrawing.current = true;
        }
    };

    const handleDelete = () => {
        if (step == 1) {
            setLine(null);
            setDimText("");
        }
        else if (step == 2) {
            setRects(rects => {
                return rects.filter(rect => !rect.selected);
            })
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
            document.body.style.cursor = 'grabbing';
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
            setNewRect((prev) =>
                prev ? { ...prev, endPoint: [clampedX, clampedY] } : null
            );
        }
    };

    const handleMouseUp = () => {
        isDragging.current = false;
        lastPos.current = null;
        // document.body.style.cursor = 'auto';
        if (step == 2) {
            if (drawRect != 'none' && newRect) {
                setRects((prev) => [...prev, getRectFromCoords(newRect, drawRect + prev.length, drawRect)]);
                setNewRect(null);
                isDrawing.current = false;
            }
            else {
                if (move || drawRect != 'none') return;
                const stage = stageRef.current;
                if (!stage) return;
                const evtPos = stage.getRelativePointerPosition()!;
                // find topmost rect containing point
                for (let i = rects.length - 1; i >= 0; i--) {
                    const r = rects[i];
                    if (
                        evtPos.x >= r.x && evtPos.x <= r.x + r.width &&
                        evtPos.y >= r.y && evtPos.y <= r.y + r.height
                    ) {
                        // console.log(rectsRef.current[])
                        if (rectsRef.current[i].zone != null) continue;
                        setRects(prev => prev.map((rect, idx) => idx === i ? { ...rect, selected: !rect.selected } : rect));
                        break;
                    }
                }
            }

        }

    };

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
            setHoverPos(null);
        }
    };

    return (
        <div style={{ cursor: drawRect ? drawRect === 'none' ? move ? 'grabbing' : 'auto' : 'crosshair' : move ? 'grabbing' : 'crosshair' }}>
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
                        {rects && rects.map((rect) => {
                            return (
                                <Rect
                                    key={rect.id}
                                    x={rect.x}
                                    y={rect.y}
                                    width={rect.width}
                                    height={rect.height}
                                    stroke={rect.selected ? 'gold' : rect.stroke}
                                    strokeWidth={4}
                                // onClick={() => handleClick(rect.id, index)}
                                // hitStrokeWidth={10}
                                // strokeHitEnabled={true}
                                />
                            );
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
                    </Layer>
                }
            </Stage>
        </div>
    )
});

Canvas.displayName = "Canvas";

export default Canvas;