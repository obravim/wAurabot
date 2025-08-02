

export default function Drag({ color, height, width }: { color: string, width: number, height: number }) {
    return (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
                d="M0.333374 5.09082V3.42415H13.6667V5.09082H0.333374ZM0.333374 1.75749V0.0908203H13.6667V1.75749H0.333374Z"
                fill={color} />
        </svg>
    )
}
