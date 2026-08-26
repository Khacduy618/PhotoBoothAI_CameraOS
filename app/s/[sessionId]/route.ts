import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getLocalSharePayload } from "@/services/momentai-guest-session/momentai-guest-session-orchestrator.service";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    const rawIdentifier = (await params).sessionId;
    const queryToken = request.nextUrl.searchParams.get("token");

    const storageRootDir = path.resolve(process.env.MOMENTAI_STORAGE_DIR || path.join(process.cwd(), "artifacts", "windowmini-storage"));
    const dbFile = path.join(storageRootDir, "cameraos-storage.sqlite");

    let resolvedSessionId: string | null = null;
    let isAuthorized = false;

    // 1. Check if rawIdentifier is a direct publicToken (/s/<publicToken>)
    if (fs.existsSync(dbFile)) {
        try {
            const db = new Database(dbFile);
            const tokenRow = db.prepare("SELECT session_id FROM public_session_tokens WHERE public_token = ?").get(rawIdentifier) as { session_id?: string } | undefined;
            if (tokenRow?.session_id) {
                resolvedSessionId = tokenRow.session_id;
                isAuthorized = true;
            }
            if (typeof (db as unknown as { close?: () => void }).close === 'function') {
                (db as unknown as { close: () => void }).close();
            }
        } catch {}
    }

    // 2. If not matched as publicToken, check if rawIdentifier is a sessionId with valid queryToken
    if (!resolvedSessionId) {
        resolvedSessionId = rawIdentifier;
        const orchestratorResult = getLocalSharePayload(resolvedSessionId, queryToken);
        if (orchestratorResult.ok) {
            isAuthorized = true;
        } else if (queryToken && fs.existsSync(dbFile)) {
            try {
                const db = new Database(dbFile);
                const row = db.prepare("SELECT public_token FROM public_session_tokens WHERE session_id = ?").get(resolvedSessionId) as { public_token?: string } | undefined;
                if (row && row.public_token === queryToken) {
                    isAuthorized = true;
                }
                if (typeof (db as unknown as { close?: () => void }).close === 'function') {
                    (db as unknown as { close: () => void }).close();
                }
            } catch {}
        }

        if (!isAuthorized && !orchestratorResult.ok && orchestratorResult.status === 404) {
            return NextResponse.json(
                { ok: false, error: orchestratorResult.error },
                { status: 404 },
            );
        }
    }

    if (!isAuthorized || !resolvedSessionId) {
        return NextResponse.json(
            { ok: false, error: "INVALID_SHARE_TOKEN" },
            { status: 403 },
        );
    }

    // 3. Resolve Media Files for authorized sessionId
    const outputsDir = path.join(storageRootDir, "sessions", resolvedSessionId, "outputs");
    const shareImagePath = path.join(outputsDir, "final-share.jpg");
    const videoPath = path.join(outputsDir, "final-video.mp4");

    const hasImage = fs.existsSync(shareImagePath);
    const hasVideo = fs.existsSync(videoPath);

    const orchestratorResult = getLocalSharePayload(resolvedSessionId, queryToken);
    let finalShareDataUrl: string | undefined = orchestratorResult.ok ? orchestratorResult.dataUrl : undefined;

    if (!finalShareDataUrl && hasImage) {
        const buf = fs.readFileSync(shareImagePath);
        finalShareDataUrl = `data:image/jpeg;base64,${buf.toString("base64")}`;
    }

    let finalVideoUrl: string | undefined;
    if (hasVideo) {
        const vidBuffer = fs.readFileSync(videoPath);
        finalVideoUrl = `data:video/mp4;base64,${vidBuffer.toString("base64")}`;
    }

    if (!finalShareDataUrl && !finalVideoUrl) {
        return NextResponse.json(
            { ok: false, error: "SHARE_OUTPUT_NOT_FOUND" },
            { status: 404 },
        );
    }

    const payload: Record<string, unknown> = {
        ok: true,
        sessionId: resolvedSessionId,
    };
    if (finalShareDataUrl) payload.finalShare = finalShareDataUrl;
    if (finalVideoUrl) payload.finalVideoUrl = finalVideoUrl;

    const acceptHeader = request.headers.get("accept") || "";
    if (acceptHeader.includes("text/html")) {
        const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Khoảnh Khắc PhotoBoothAI</title>
  <style>
    body { margin: 0; background: #111; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; justify-content: space-between; }
    header { text-align: center; padding: 24px 16px 8px; }
    h1 { margin: 8px 0; font-size: 24px; color: #E6C687; }
    p { margin: 0; font-size: 13px; color: #888; }
    .media-container { width: 90%; max-width: 480px; margin: 16px auto; display: flex; flex-direction: column; gap: 16px; align-items: center; }
    video, img { width: 100%; max-height: 60vh; border-radius: 12px; border: 1px solid #333; object-fit: contain; background: #000; }
    .btn { display: block; width: 100%; box-sizing: border-box; text-align: center; background: #E6C687; color: #111; font-weight: bold; padding: 14px; border-radius: 10px; text-decoration: none; text-transform: uppercase; font-size: 13px; letter-spacing: 1px; }
    .btn-secondary { background: #333; color: #fff; }
    footer { text-align: center; padding: 20px; font-size: 11px; color: #555; }
  </style>
</head>
<body>
  <header>
    <p>PhotoBoothAI Di Sản</p>
    <h1>Khoảnh Khắc Của Bạn</h1>
    <p>Lưu ảnh & video chuyển động chất lượng cao</p>
  </header>
  <div class="media-container">
    ${finalVideoUrl ? `<video src="${finalVideoUrl}" autoplay loop muted playsinline controls></video><a href="${finalVideoUrl}" download="photobooth_${resolvedSessionId}.mp4" class="btn">Tải Video Chuyển Động (.mp4)</a>` : ''}
    ${finalShareDataUrl ? `<img src="${finalShareDataUrl}" alt="Photobooth Photo"/><a href="${finalShareDataUrl}" download="photobooth_${resolvedSessionId}.jpg" class="btn ${finalVideoUrl ? 'btn-secondary' : ''}">Tải Ảnh Thành Phẩm (.jpg)</a>` : ''}
  </div>
  <footer>MomentAI CameraOS Platform</footer>
</body>
</html>`;
        return new NextResponse(html, {
            status: 200,
            headers: { "Content-Type": "text/html; charset=utf-8" },
        });
    }

    return NextResponse.json(payload);
}
