import "server-only";
import QRCode from "qrcode";

/** QR code en SVG (encre sur papier, correction d'erreur moyenne). */
export async function qrSvg(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#1c1815", light: "#fbf8f1" },
  });
}
