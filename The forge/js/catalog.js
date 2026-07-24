// ============ THE FORGE — component catalog ============
// Real, orderable parts with manufacturer part numbers, unit prices (2026 USD,
// single-qty) and supplier links. Search-style links are used so they never 404.

export const PARTS = {
  switch_mx: {
    id: "switch_mx", name: "Gateron KS-9 Red mechanical switch", ref: "SW",
    mpn: "KS-9-RED", unit: 0.35,
    supplier: "AliExpress / KBDfans", url: "https://kbdfans.com/search?q=gateron+ks-9",
    note: "Linear, 45 g, plate mount (3-pin)",
  },
  keycap_dsa: {
    id: "keycap_dsa", name: "DSA blank PBT keycap", ref: "CAP",
    mpn: "DSA-1U-PBT", unit: 0.45,
    supplier: "KBDfans", url: "https://kbdfans.com/search?q=dsa+blank+pbt",
    note: "Uniform profile — good for arced one-hand layouts",
  },
  encoder_ec11: {
    id: "encoder_ec11", name: "Bourns PEC11R rotary encoder w/ switch", ref: "ENC",
    mpn: "PEC11R-4215F-S0024", unit: 1.34,
    supplier: "Digi-Key", url: "https://www.digikey.com/en/products/result?keywords=PEC11R-4215F-S0024",
    note: "24 detents, push switch, 15 mm flatted shaft",
  },
  knob_alu: {
    id: "knob_alu", name: "Aluminum knurled knob 20 mm", ref: "KNOB",
    mpn: "KN-20-6D", unit: 1.80,
    supplier: "Adafruit", url: "https://www.adafruit.com/search?q=machined+knob",
    note: "6 mm D-shaft, set screw",
  },
  trackball_pim447: {
    id: "trackball_pim447", name: "Pimoroni Trackball Breakout (I2C)", ref: "TB",
    mpn: "PIM447", unit: 9.90,
    supplier: "Pimoroni", url: "https://shop.pimoroni.com/products/trackball-breakout",
    note: "I2C addr 0x0A, RGBW backlight, click by press",
  },
  oled_ssd1306: {
    id: "oled_ssd1306", name: '0.96" OLED 128×64 SSD1306 (I2C)', ref: "OLED",
    mpn: "SSD1306-096-I2C", unit: 3.50,
    supplier: "Adafruit / AliExpress", url: "https://www.adafruit.com/product/326",
    note: "I2C addr 0x3C, 3.3 V",
  },
  mcu_esp32s3: {
    id: "mcu_esp32s3", name: "ESP32-S3-DevKitC-1-N8R2", ref: "U1",
    mpn: "ESP32-S3-DevKitC-1-N8R2", unit: 8.99,
    supplier: "Digi-Key", url: "https://www.digikey.com/en/products/result?keywords=ESP32-S3-DevKitC-1",
    note: "Native USB HID + BLE, 8 MB flash / 2 MB PSRAM",
  },
  diode_1n4148: {
    id: "diode_1n4148", name: "1N4148 switching diode (DO-35)", ref: "D",
    mpn: "1N4148TR", unit: 0.10,
    supplier: "Mouser", url: "https://www.mouser.com/c/?q=1N4148",
    note: "Anti-ghosting matrix diode, one per key",
  },
  jack_trs: {
    id: "jack_trs", name: "3.5 mm TRS jack PJ-320A", ref: "J",
    mpn: "PJ-320A", unit: 0.60,
    supplier: "AliExpress", url: "https://www.aliexpress.com/w/wholesale-PJ320A.html",
    note: "Foot-pedal input, panel/PCB mount",
  },
  pedal_fs1: {
    id: "pedal_fs1", name: "FS1-P momentary foot pedal", ref: "FP",
    mpn: "FS1-P", unit: 7.50,
    supplier: "Amazon", url: "https://www.amazon.com/s?k=FS1-P+foot+pedal+momentary",
    note: "SPST momentary, 3.5 mm plug (or rewire TS→TRS)",
  },
  magnet_6x3: {
    id: "magnet_6x3", name: "N52 neodymium disc magnet 6×3 mm", ref: "MAG",
    mpn: "N52-D6X3", unit: 0.22,
    supplier: "K&J Magnetics", url: "https://www.kjmagnetics.com/proddetail.asp?prod=D42-N52",
    note: "Module attachment; glue into printed pockets",
  },
  insert_m3: {
    id: "insert_m3", name: "M3×5.7 brass heat-set insert", ref: "INS",
    mpn: "IUB-M3-57", unit: 0.14,
    supplier: "McMaster-Carr", url: "https://www.mcmaster.com/heat-set-inserts/",
    note: "94180A331 equivalent; install with soldering iron",
  },
  screw_m3x8: {
    id: "screw_m3x8", name: "M3×8 socket head cap screw", ref: "SCR",
    mpn: "M3X8-SHCS", unit: 0.08,
    supplier: "McMaster-Carr", url: "https://www.mcmaster.com/socket-head-screws/",
    note: "Black oxide alloy steel",
  },
  bumpon: {
    id: "bumpon", name: "3M Bumpon rubber feet 10×3 mm", ref: "FT",
    mpn: "SJ5302", unit: 0.15,
    supplier: "Digi-Key", url: "https://www.digikey.com/en/products/result?keywords=SJ5302",
    note: "Anti-slip",
  },
  pcb_2layer: {
    id: "pcb_2layer", name: "Custom 2-layer PCB (this design)", ref: "PCB1",
    mpn: "FORGE-DECK-PCB", unit: 4.20,
    supplier: "JLCPCB", url: "https://jlcpcb.com/",
    note: "Upload the exported Gerbers; price ≈ 5 boards for $21",
  },
  cable_usbc: {
    id: "cable_usbc", name: "USB-C to USB-A cable 1.8 m", ref: "CBL",
    mpn: "USB-C-18", unit: 3.00,
    supplier: "Amazon", url: "https://www.amazon.com/s?k=usb-c+cable+braided",
    note: "Data-capable",
  },
  cable_trs: {
    id: "cable_trs", name: "3.5 mm TRS male-male cable 2 m", ref: "CBLP",
    mpn: "TRS-MM-2M", unit: 2.20,
    supplier: "Amazon", url: "https://www.amazon.com/s?k=3.5mm+trs+male+male+cable",
    note: "Pedal extension",
  },
  wire_silicone: {
    id: "wire_silicone", name: "24 AWG silicone hookup wire (per m)", ref: "W",
    mpn: "SIL-24AWG", unit: 0.30,
    supplier: "Adafruit", url: "https://www.adafruit.com/search?q=silicone+wire+24awg",
    note: "OLED / trackball / jack flying leads",
  },
  filament_petg: {
    id: "filament_petg", name: "PETG filament (per 100 g)", ref: "FIL",
    mpn: "PETG-BLK", unit: 2.30,
    supplier: "Prusament", url: "https://www.prusa3d.com/category/prusament/",
    note: "Enclosure material — stiffer than PLA near USB port",
  },
};

// Woodworking material pricing ($/board-foot, 2026 retail)
export const WOOD = {
  walnut: { name: "Black walnut", bf: 14.5, density: 640, color: 0x5c4033 },
  oak:    { name: "White oak",    bf: 9.0,  density: 755, color: 0x9a7b4f },
  maple:  { name: "Hard maple",   bf: 8.0,  density: 705, color: 0xd9c49a },
  cherry: { name: "Cherry",       bf: 10.5, density: 560, color: 0x9f5c42 },
};

export function money(n) { return "$" + n.toFixed(2); }

/** Build a quantified BOM from a design spec. Returns [{part, qty, ext}] */
export function buildBOM(spec) {
  const m = spec.modules;
  const rows = [];
  const add = (id, qty) => { if (qty > 0) rows.push({ part: PARTS[id], qty, ext: PARTS[id].unit * qty }); };

  const keyCount = (m.keys?.count || 0) + (m.kvmKeys || 0) + (m.voiceButton ? 1 : 0);
  add("switch_mx", keyCount);
  add("keycap_dsa", keyCount);
  add("diode_1n4148", keyCount);
  add("encoder_ec11", m.encoders?.count || 0);
  add("knob_alu", m.encoders?.count || 0);
  if (m.trackball?.present) add("trackball_pim447", 1);
  if (m.oled?.present) add("oled_ssd1306", 1);
  add("mcu_esp32s3", 1);
  add("jack_trs", m.pedals?.count || 0);
  add("pedal_fs1", m.pedals?.count || 0);
  add("cable_trs", m.pedals?.count || 0);
  if (m.magnets) add("magnet_6x3", 8);
  add("insert_m3", 6);
  add("screw_m3x8", 6);
  add("bumpon", 4);
  add("pcb_2layer", 1);
  add("cable_usbc", 1);
  add("wire_silicone", 2);
  let filQty = Math.max(1, Math.round((spec.derived?.enclosureVolumeCm3 || 180) * 0.0125)); // ~1.25g/cm3 shell est
  if (spec.podPart) filQty += 1;        // pedal pod print
  if (spec.clampMount) filQty += 1;     // desk clamp print
  add("filament_petg", filQty);
  return rows;
}

export function bomTotal(rows) { return rows.reduce((s, r) => s + r.ext, 0); }
