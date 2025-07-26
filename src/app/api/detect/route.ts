import { NextRequest, NextResponse } from 'next/server';
// import fs from 'fs';
// import { writeFile } from 'fs/promises';
// import path from 'path';
// import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest) {
    const reqData = await req.json();
    // Convert to ArrayBuffer → Buffer
    // const bytes = await file.arrayBuffer();
    // const buffer = Buffer.from(bytes);

    // // Create a unique filename
    // const fileId = uuid();
    // const ext = file.name.split('.').pop();
    // const fileName = `${fileId}.${ext}`;

    // // Save to public/uploads/
    // if (!fs.existsSync('public/uploads')) {
    //   fs.mkdirSync('public/uploads', { recursive: true });
    // }
    // const uploadPath = path.join(process.cwd(), 'public', 'uploads', fileName);
    // await writeFile(uploadPath, buffer);

    // const fileUrl = `/uploads/${fileName}`; // public path
    const response = {
        // fileUrl,
        scaleFacter: 0.3179235808186732,
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
        ]
    };

    return NextResponse.json({ response });
}
