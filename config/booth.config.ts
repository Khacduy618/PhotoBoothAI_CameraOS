export const boothConfig = {
    gesture: {
        numberOfHands: 1,

        openPalmConfidence: 0.55,
        closedFistConfidence: 0.7,
        pointingUpConfidence: 0.65,

        openPalmHoldMs: 450,
        closedFistHoldMs: 600,
        pointingUpHoldMs: 700,

        // Cho phép model mất gesture ngắn hạn mà không reset bộ đếm.
        lostGestureGraceMs: 250,

        // Chỉ inference khoảng 15 FPS để giảm tải main thread.
        inferenceIntervalMs: 66,
    },

    countdown: {
        seconds: 3,
    },

    camera: {
        idealWidth: 1280,
        idealHeight: 720,
        idealFrameRate: 30,
    },

    mediapipe: {
        modelUrl: "/models/gesture_recognizer.task",
        wasmUrl: "/mediapipe/wasm",
    },
} as const;