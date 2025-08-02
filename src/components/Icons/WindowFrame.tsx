

export default function WindowFrame({ color, height, width }: { color: string, width: number, height: number }) {
    return (
        <svg width={width} height={height} viewBox="0 0 14 18" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6.99996 1.70117C3.77829 1.70117 1.16663 4.42784 1.16663 7.53451V15.8678C1.16663 16.0889 1.25442 16.3008 1.4107 16.4571C1.56698 16.6134 1.77895 16.7012 1.99996 16.7012H12C12.221 16.7012 12.4329 16.6134 12.5892 16.4571C12.7455 16.3008 12.8333 16.0889 12.8333 15.8678V7.53451C12.8333 4.42784 10.2216 1.70117 6.99996 1.70117ZM6.99996 1.70117V16.7012M1.16663 10.0345H12.8333" stroke={color} strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    )
}
