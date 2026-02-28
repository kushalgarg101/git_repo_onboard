export default function AnimatedBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden bg-zinc-950">
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-900/20 blur-[120px] animate-pulse"></div>
            <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-fuchsia-900/10 blur-[150px]"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[40%] rounded-full bg-blue-900/20 blur-[150px]"></div>

            <svg
                className="absolute inset-0 w-full h-full opacity-[0.03]"
                xmlns="http://www.w3.org/2000/svg"
            >
                <filter id="noiseFilter">
                    <feTurbulence
                        type="fractalNoise"
                        baseFrequency="0.8"
                        numOctaves="3"
                        stitchTiles="stitch"
                    />
                </filter>
                <rect width="100%" height="100%" filter="url(#noiseFilter)" />
            </svg>
            {/* Grid overlay for a high-tech feel */}
            <div
                className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
            ></div>
        </div>
    );
}
