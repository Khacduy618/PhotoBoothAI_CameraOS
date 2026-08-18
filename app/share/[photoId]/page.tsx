import { SharePhotoClient } from "@/app/share/[photoId]/share-photo-client";

interface SharePhotoPageProps {
    params: Promise<{
        photoId: string;
    }>;
}

export default async function SharePhotoPage({
    params,
}: SharePhotoPageProps) {
    const { photoId } = await params;

    return <SharePhotoClient photoId={photoId} />;
}
