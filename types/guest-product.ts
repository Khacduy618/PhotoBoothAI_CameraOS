export type GuestProductId =
  | "PREMIUM_POSTCARD"
  | "STRIP_2"
  | "STRIP_4"
  | "SHEET_4"
  | "SHEET_6";

export type GuestProductOutputType = "POSTCARD_10X15" | "STRIP_5X15" | "SHEET_10X15";

export interface GuestProductConfig {
  id: GuestProductId;
  name: string;
  requiredShots: number;
  price: number;
  outputType: GuestProductOutputType;
  printSheets: number;
  premium: boolean;
  group: "Premium" | "Photo Strip" | "Photo Sheet";
  description: string;
}

export const GUEST_PRODUCTS: Record<GuestProductId, GuestProductConfig> = {
  PREMIUM_POSTCARD: {
    id: "PREMIUM_POSTCARD",
    name: "Premium Postcard",
    requiredShots: 3,
    price: 70000,
    outputType: "POSTCARD_10X15",
    printSheets: 1,
    premium: true,
    group: "Premium",
    description: "1 × Bưu thiếp 10×15 (Chụp 3 chọn 1 ảnh chính + Vẽ & Viết chữ)",
  },

  STRIP_2: {
    id: "STRIP_2",
    name: "Photo Strip 2 Ô",
    requiredShots: 2,
    price: 70000,
    outputType: "STRIP_5X15",
    printSheets: 1,
    premium: false,
    group: "Photo Strip",
    description: "2 × Dải ảnh 5×15 trên 1 bản in 10×15",
  },

  STRIP_4: {
    id: "STRIP_4",
    name: "Photo Strip 4 Ô",
    requiredShots: 4,
    price: 70000,
    outputType: "STRIP_5X15",
    printSheets: 1,
    premium: false,
    group: "Photo Strip",
    description: "2 × Dải ảnh 5×15 trên 1 bản in 10×15",
  },

  SHEET_4: {
    id: "SHEET_4",
    name: "Photo Sheet 4 Ô",
    requiredShots: 4,
    price: 80000,
    outputType: "SHEET_10X15",
    printSheets: 1,
    premium: false,
    group: "Photo Sheet",
    description: "1 × Trang ảnh 10×15 dọc (4 ô ảnh)",
  },

  SHEET_6: {
    id: "SHEET_6",
    name: "Photo Sheet 6 Ô",
    requiredShots: 6,
    price: 80000,
    outputType: "SHEET_10X15",
    printSheets: 1,
    premium: false,
    group: "Photo Sheet",
    description: "1 × Trang ảnh 10×15 ngang (6 ô ảnh)",
  },
};
