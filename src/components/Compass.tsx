import React, { useState } from "react";

const directions = [
    "N", "NE", "E", "SE", "S", "SW", "W", "NW"
];

const Compass = () => {
    const [selected, setSelected] = useState("N");

    const handleSelect = (dir: string) => {
        setSelected(dir);
    };

    return (
        <div className="w-[120px] flex mx-6 flex-col items-center">
            <h2 className="text-white mb-6 whitespace-nowrap text-xs text-left">SELECT ORIENTATION:</h2>
            <div className="relative w-[120px] h-[120px] rounded-full bg-gradient-to-br from-[#1e1e28] to-[#191922] flex items-center justify-center shadow-inner">
                <div className="absolute w-full h-full flex items-center justify-center">
                    {directions.map((dir, index) => {
                        const angle = (index * 45) - 90;
                        const radius = 50;
                        const x = radius * Math.cos((angle * Math.PI) / 180);
                        const y = radius * Math.sin((angle * Math.PI) / 180);

                        return (
                            <div
                                key={dir}
                                className="absolute cursor-pointer text-[10px] z-20 text-gray-400 hover:text-white transition "
                                style={{
                                    transform: `translate(${x}px, ${y}px)`
                                }}
                                onClick={() => handleSelect(dir)}
                            >
                                {
                                    dir == selected ? <span className="z-40 text-white font-bold flex mb-0.5">N</span> : <div className="w-6 h-6 flex items-center justify-center">
                                        <span className="w-[1px] h-4 block bg-[#9B87F5]"
                                            style={{
                                                transform: `rotate(${angle + 90}deg)`
                                            }}
                                        >
                                        </span>

                                    </div>
                                }
                                {
                                    directions.indexOf(selected) == index &&
                                    <div
                                        className="absolute top-[50%] left-[50%]"
                                        style={{
                                            transform: `translate(-50%, -50%) rotate(${angle - 90}deg) translateY(24px)`,
                                            transformOrigin: 'center',
                                        }}
                                    >
                                        {/* Arrow shaft */}
                                        <div className="w-[2px] h-[14px] bg-white mx-auto" />

                                        {/* Arrowhead */}
                                        <div
                                            className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-white mx-auto rotate-180"
                                        />
                                    </div>
                                }
                            </div>
                        );
                    })}
                </div>

                <div className="w-15 h-15 rounded-full bg-[#14141b] border-4 border-[#333] flex items-center justify-center">
                    <span className="text-white text-lg font-bold">N</span>
                </div>

                {/* Marker dot */}
                {selected && (
                    <div
                        className="absolute w-6 h-6 border-2 border-[#9B87F5] bg-[#9B87F5] rounded-full"
                        style={(() => {
                            const index = directions.indexOf(selected);
                            const angle = (index * 45) - 90;
                            const radius = 50;
                            const x = radius * Math.cos((angle * Math.PI) / 180);
                            const y = radius * Math.sin((angle * Math.PI) / 180);
                            return {
                                transform: `translate(${x}px, ${y}px)`
                            };
                        })()}
                    ></div>
                )}
            </div>
        </div>
    );
};

export default Compass;
