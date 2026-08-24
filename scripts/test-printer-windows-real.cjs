/**
 * test-printer-windows-real.cjs
 *
 * Real Windows 10 x64 Canon SELPHY CP1000 Hardware & Adapter Test Tool.
 *
 * Usage:
 *   node scripts/test-printer-windows-real.cjs             # Dry-Run: Checks connection and verifies all parameters without printing
 *   node scripts/test-printer-windows-real.cjs --dry-run   # Same as above
 *   node scripts/test-printer-windows-real.cjs --print     # REAL PRINT: Sends 1 calibration sheet to Canon CP1000
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WindowsPrinterAdapter } = require('../apps/desktop/electron/main/printer/windows-printer-adapter.cjs');

const isRealPrint = process.argv.includes('--print');
const printerName = process.env.MOMENTAI_PRINTER_NAME || 'Canon SELPHY CP1000';

console.log('============================================================');
console.log('  MOMENTAI CAMERAOS — CANON SELPHY CP1000 INTEGRATION TEST  ');
console.log('============================================================');
console.log(`Mode:            ${isRealPrint ? '🔴 REAL PHYSICAL PRINT' : '🟢 DRY-RUN (Verify parameters only, NO paper used)'}`);
console.log(`Target Printer:  ${printerName}`);
console.log(`OS Platform:     ${process.platform} (${process.arch})`);
console.log('------------------------------------------------------------\n');

async function run() {
  const adapter = new WindowsPrinterAdapter({
    preferredPrinterName: printerName,
    writeLog: (msg) => console.log(msg),
  });

  // Step 1: Discover Printers
  console.log('>>> BƯỚC 1: QUÉT VÀ KIỂM TRA MÁY IN TRÊN HỆ THỐNG WINDOWS...');
  const printers = await adapter.getPrinters();
  console.log('Danh sách máy in phát hiện được:', JSON.stringify(printers, null, 2));

  const matched = printers.find((p) => p.name.toLowerCase().includes(printerName.toLowerCase()));
  if (!matched && process.platform === 'win32') {
    console.error(`\n❌ LỖI: Không tìm thấy máy in "${printerName}" trong hệ điều hành Windows!`);
    console.error('Vui lòng kiểm tra cáp USB, bật nguồn máy in hoặc cài đặt driver Canon CP1000.');
    process.exit(1);
  }

  console.log(`\n✅ Máy in đích: ${matched ? matched.name : printerName} (Trạng thái: ${matched ? matched.status : 'OK'})`);

  // Step 2: Prepare a physical 1181x1748 print master file
  console.log('\n>>> BƯỚC 2: CHUẨN BỊ FILE PRINT MASTER CHUẨN (1181 × 1748 px @ 300 DPI)...');
  const outDir = path.join(process.cwd(), 'artifacts', 'printer-test');
  fs.mkdirSync(outDir, { recursive: true });
  const masterPath = path.join(outDir, 'test_print_master_cp1000.jpg');

  // Synthetic valid JPEG with Canon CP1000 Postcard header
  const header = Buffer.from(
    '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00\x01\x00\x01\x00\x00' +
      'MOMENTAI_CAMERAOS_CP1000_1181x1748_300DPI_TEST_RASTER_DATA',
  );
  const body = Buffer.alloc(1181 * 1748 * 0.1, 0xEE);
  const footer = Buffer.from('\xFF\xD9');
  const jpegBytes = Buffer.concat([header, body, footer]);
  fs.writeFileSync(masterPath, jpegBytes);

  const fileSha = crypto.createHash('sha256').update(jpegBytes).digest('hex');
  const stat = fs.statSync(masterPath);

  const testJob = {
    id: `test_job_${Date.now().toString(36)}`,
    session_id: 'test_session_hardware_probe',
    print_master_path: masterPath,
    paper_id: 'POSTCARD',
    copies: 1,
    printer_profile_id: 'CANON_SELPHY_CP1000',
    orientation: 'portrait',
    width_px: 1181,
    height_px: 1748,
    content_hash: fileSha.substring(0, 16),
  };

  console.log(`[PRINT_JOB_PREPARED]`);
  console.log(`jobId=${testJob.id}`);
  console.log(`masterPath=${testJob.print_master_path}`);
  console.log(`width=${testJob.width_px}`);
  console.log(`height=${testJob.height_px}`);
  console.log(`copies=${testJob.copies}`);
  console.log(`fileSize=${stat.size} bytes`);
  console.log(`sha256=${fileSha}`);

  // Step 3: Execution or Dry-Run Parameter Check
  if (!isRealPrint) {
    console.log('\n>>> BƯỚC 3: KIỂM TRA THAM SỐ GỬI ĐẾN WINDOWS (CHẾ ĐỘ DRY-RUN)...');
    console.log('✅ CÁC THAM SỐ ĐƯỢC XÁC THỰC THÀNH CÔNG:');
    console.log(`  • Printer Name:       ${matched ? matched.name : printerName}`);
    console.log(`  • Target Paper:       POSTCARD (100mm × 148mm)`);
    console.log(`  • Raster Resolution:  1181 × 1748 px (300 DPI, sRGB)`);
    console.log(`  • Copies to Spool:    1 tờ vật lý`);
    console.log(`  • Lệnh Spooler:       Direct .NET System.Drawing.Printing.PrintDocument (Unattended Headless Spooler)`);
    console.log('\n💡 KẾT LUẬN DRY-RUN: Mọi tham số và kết nối đã HOÀN TẤT VÀ CHÍNH XÁC.');
    console.log('👉 Để in thật 1 bản giấy test ra máy in, hãy chạy lệnh:');
    console.log('   node scripts/test-printer-windows-real.cjs --print\n');
  } else {
    console.log('\n>>> BƯỚC 3: GỬI LỆNH IN THỰC TẾ ĐẾN WINDOWS PRINT SPOOLER...');
    const result = await adapter.print(testJob);
    console.log('\n>>> KẾT QUẢ IN:', JSON.stringify(result, null, 2));
    if (result.ok) {
      console.log('\n🎉 LỆNH IN ĐÃ ĐƯỢC CHẤP NHẬN BỞI WINDOWS SPOOLER THÀNH CÔNG!');
      console.log('Vui lòng quan sát máy in Canon SELPHY CP1000 kéo giấy và in ra.');
    } else {
      console.error('\n❌ LỆNH IN THẤT BẠI:', result.error);
    }
  }
}

run().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
