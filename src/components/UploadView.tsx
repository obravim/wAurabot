"use client"

import { Upload } from "lucide-react";
import { useCanvas } from "@/app/context/CanvasContext";
import { useStep } from "@/app/context/StepContext";


function UploadView() {
    const { file, setCanvasFile, setScaleFactor, setRoomCoords, setDoorCoords, setWindowCoords } = useCanvas();
    const { setStep } = useStep();

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setCanvasFile(e.target.files[0]);
        }

        const formData = new FormData();
        formData.append('image', file as Blob);

        fetch('/api/scale', {
            method: 'POST',
            body: formData,
        }).then(res => res.json()).then(data => {
            const resp = data.response;
            setScaleFactor(resp.scaleFactor);
            setRoomCoords(resp.roomCoords);
            setDoorCoords(resp.doorCoords);
            setWindowCoords(resp.windowsCoords);
            setStep(1);
        });

        // const data = await res.json();
        // console.log(data);
    };

    return (
        <div className="flex justify-center grow items-center">
            <div className="bg-[#242229] outline-4 outline-dashed outline-[#454446] -outline-offset-24 rounded-lg w-[600px] p-10 text-center flex flex-col h-[280px]">
                <div className="h-full flex justify-center items-end p-4">
                    <h2 className="text-3xl mb-2 font-semibold">UPLOAD IMAGE or PDF</h2>
                </div>
                <div className="h-full p-4 flex flex-col justify-between items-center">
                    <label
                        htmlFor="file-upload"
                        className="cursor-pointer px-5 py-2 hover:bg-[#6930c4] text-white rounded bg-[#421c7f] transition inline-flex gap-1 items-center "
                    >
                        <Upload size={16} />
                        Upload Image
                        <input
                            id="file-upload"
                            type="file"
                            accept=".jpg,.jpeg,.png,.heic,.avif"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </label>
                    <p className="text-xs text-gray-400 mt-4">
                        *Supported formats: Jpg, Png, Heic, Avif
                    </p>
                </div>

            </div>
        </div>
    );
}

export default UploadView