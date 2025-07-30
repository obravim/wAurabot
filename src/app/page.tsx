'use client';
import { useEffect, useState } from 'react';
import UploadView from '@/components/UploadView';
import ScaleView from '@/components/ScaleView';
import { useStep } from './context/StepContext';
import { ZoneProvider } from './context/ZoneContext';
import EditView from '@/components/EditView';
import Nav from "@/components/Nav";
import { useCanvas } from './context/CanvasContext';
import EditZone from '@/components/EditZone';


async function getFileFromUrl(url: string, fileName: string, mimeType?: string): Promise<File> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new File([blob], fileName, { type: mimeType || blob.type });
}

const response = {
  // fileUrl,
  scaleFactor: 0.3179235808186732,
  roomCoords: [
    {
      startPoint: [79.72, 309.92],
      endPoint: [282.47, 514.69],
      color: "red"
    },
    {
      startPoint: [361.44, 308.81],
      endPoint: [578.84, 513.71],
      color: "blue"
    },
    {
      startPoint: [76.62, 99.87],
      endPoint: [296.72, 307.18],
      color: "green"
    },
    {
      startPoint: [286.43, 356.25],
      endPoint: [357.48, 515.31],
      color: "orange"
    },
    {
      startPoint: [465.05, 309.37],
      endPoint: [578.01, 345.34],
      color: "purple"
    },
    {
      startPoint: [334.35, 99.76],
      endPoint: [578.51, 305.74],
      color: "cyan"
    },
    {
      startPoint: [71.56, 104.02],
      endPoint: [637.41, 570.62],
      color: "magenta"
    },
    {
      startPoint: [198.20, 309.47],
      endPoint: [282.06, 349.01],
      color: "red"
    },
    {
      startPoint: [286.98, 267.18],
      endPoint: [357.89, 351.60],
      color: "blue"
    },
  ],
  windowsCoords: [
    {
      startPoint: [462.60, 93.19],
      endPoint: [532.91, 104.65],
      color: "cyan"
    },
    {
      startPoint: [153.14, 93.59],
      endPoint: [223.26, 105.56],
      color: "cyan"
    },
    {
      startPoint: [301.46, 513.92],
      endPoint: [344.20, 521.79],
      color: "cyan"
    },
    {
      startPoint: [346.26, 93.14],
      endPoint: [416.40, 104.09],
      color: "cyan"
    },
    {
      startPoint: [435.06, 512.57],
      endPoint: [505.05, 522.00],
      color: "cyan"
    },
  ],
  doorCoords: [
    {
      startPoint: [315.43, 351.53],
      endPoint: [356.40, 395.82],
      color: "purple"
    },
    {
      startPoint: [244.42, 311.22],
      endPoint: [287.67, 351.01],
      color: "purple"
    },
    {
      startPoint: [356.44, 311.23],
      endPoint: [400.54, 350.45],
      color: "purple"
    },
    {
      startPoint: [257.94, 264.28],
      endPoint: [303.47, 302.64],
      color: "purple"
    },
  ]
};

export default function Home() {
  const { step, setStep } = useStep();
  // const [scaleResult, setScaleResult] = useState<{ scaleFactor: number, roomCoords: { startPoint: number[], endPoint: number[], color: string }[] } | null>(null);
  // const { setCanvasFile, setRoomCoords, setScaleFactor, setDoorCoords, setWindowCoords } = useCanvas();

  // useEffect(() => {
  //   getFileFromUrl("/floor-plan.png", "floor-plan.png").then(file => {
  //     setRoomCoords(response.roomCoords);
  //     setDoorCoords(response.doorCoords);
  //     setWindowCoords(response.windowsCoords);
  //     setScaleFactor(response.scaleFactor);
  //     setCanvasFile(file);
  //     setStep(2)
  //   })
  // }, [setCanvasFile, setRoomCoords, setScaleFactor, setStep])


  return <main className='grow flex relative' >
    <ZoneProvider>
      <div className={`grow ${step == 2 ? "pl-[100px]" : "px-[100px]"} flex flex-col`}>
        <Nav />
        {step === 0 && <UploadView />}
        {step === 1 && <ScaleView />}
        {step == 2 && <EditView />}
      </div>
      {
        step == 2 && <div className='w-[350px] bg-[#191919] sticky top-0 h-screen right-0 overflow-y-auto'>
          <EditZone />
        </div>
      }
    </ZoneProvider>


  </main>;
}
