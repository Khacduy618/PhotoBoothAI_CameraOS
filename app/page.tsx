import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-black text-white font-sans">
      <main className="flex flex-1 w-full max-w-5xl flex-col items-center justify-center px-8 py-16 text-center">
        <div className="flex flex-col items-center gap-12 max-w-3xl">
          <div className="flex flex-col gap-6">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight leading-tight">
              PhotoBoothAI
            </h1>
            <p className="text-xl md:text-2xl text-zinc-400 font-light">
              AI-powered photo booth experience
            </p>
          </div>

          <p className="text-lg md:text-xl text-zinc-300 leading-relaxed max-w-2xl">
            Capture memorable moments with gesture-controlled photography, 
            instant QR sharing, and AI-assisted booth flow. 
            Built on MomentAI CameraOS for reliable local-first operation.
          </p>

          <Link
            href="/booth"
            className="inline-flex items-center justify-center px-12 py-6 text-2xl font-semibold bg-white text-black rounded-full transition-all hover:bg-zinc-200 hover:scale-105 active:scale-95 mt-8"
          >
            Start Booth Experience
          </Link>

          <div className="mt-12 text-sm text-zinc-500 space-y-2">
            <p>Powered by MomentAI CameraOS</p>
            <p className="text-xs text-zinc-600">
              Local-first • Gesture Recognition • Instant Sharing
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
