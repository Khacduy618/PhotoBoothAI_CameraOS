export type SupportedGesture =
    | "Open_Palm"
    | "Closed_Fist"
    | "Pointing_Up"
    | "None"
    | "Unknown";

export interface GestureResult {
    name: SupportedGesture;
    confidence: number;
    heldDurationMs: number;
}