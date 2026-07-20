import { CameraProvider } from "@/components/camera/camera-provider";
import { BoothExperience } from "@/components/booth/booth-experience";

export default function BoothPage() {
  return (
    <main className="min-h-screen p-6">
      <CameraProvider>
        <BoothExperience />
      </CameraProvider>
    </main>
  );
}

