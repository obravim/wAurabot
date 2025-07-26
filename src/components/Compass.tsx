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
                                className="absolute cursor-pointer text-[10px] z-20 text-gray-400 hover:text-white transition"
                                style={{
                                    transform: `translate(${x}px, ${y}px)`
                                }}
                                onClick={() => handleSelect(dir)}
                            >
                                {dir}
                            </div>
                        );
                    })}
                </div>

                <div className="w-15 h-15 rounded-full bg-[#14141b] border-4 border-[#333] flex items-center justify-center">
                    <span className="text-white text-lg font-bold">{selected}</span>
                </div>

                {/* Marker dot */}
                {selected && (
                    <div
                        className="absolute w-6 h-6 border-2 border-[#9B87F5] rounded-full z-10"
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
