// Draws a transaction receipt as a PNG (like a screenshot) that can be saved to the phone's photos.
import type { Transaction } from "@/components/kasho/data";
import { getLang, toFrench } from "@/lib/i18n";

const W = 750, PAD = 56;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderReceiptImage(t: Transaction): Promise<Blob> {
  const fr = getLang() === "fr";
  const tr = (s: string) => (fr ? toFrench(s) ?? s : s);
  const rows: [string, string][] = [
    [tr("Reference"), t.id], [tr("Payment method"), t.method], [tr("Merchant / recipient"), t.title],
    [tr("Date & time"), `${new Date(t.createdAt).toLocaleDateString(fr ? "fr-FR" : "en-US", { day: "numeric", month: "short", year: "numeric" })} · ${t.time.split(" · ").pop()}`],
    [tr("Category"), tr(t.category)], [tr("Fee"), `$${t.fee.toFixed(2)}`],
  ];
  const H = 640 + rows.length * 84 + 120;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * scale; canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  const font = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#f4f6f5"; ctx.fillRect(0, 0, W, 190);

  // Brand
  const logo = await loadImage("/brand/kasho-mark.png");
  if (logo) ctx.drawImage(logo, PAD, 52, 84, 84);
  ctx.fillStyle = "#0b1410"; ctx.font = `700 40px ${font}`; ctx.textBaseline = "middle";
  ctx.fillText("Kasho Pay", PAD + 92, 94);
  ctx.fillStyle = "#6b7a73"; ctx.font = `500 24px ${font}`;
  ctx.fillText(tr("Kasho Pay Receipt"), PAD + 94, 132);

  // Status circle
  const state = t.status === "Completed" ? "ok" : t.status === "Pending" ? "wait" : "bad";
  const color = state === "ok" ? "#00b45a" : state === "wait" ? "#f59e0b" : "#ef4444";
  const cx = W / 2, cy = 320;
  ctx.save();
  ctx.shadowColor = state === "ok" ? "rgba(0,180,90,.35)" : state === "bad" ? "rgba(239,68,68,.35)" : "rgba(245,158,11,.35)";
  ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "#fff"; ctx.lineWidth = 14; ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.beginPath();
  if (state === "ok") { ctx.moveTo(cx - 28, cy + 2); ctx.lineTo(cx - 8, cy + 22); ctx.lineTo(cx + 30, cy - 18); }
  else if (state === "bad") { ctx.moveTo(cx - 24, cy - 24); ctx.lineTo(cx + 24, cy + 24); ctx.moveTo(cx + 24, cy - 24); ctx.lineTo(cx - 24, cy + 24); }
  else { ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.moveTo(cx, cy - 16); ctx.lineTo(cx, cy); ctx.lineTo(cx + 12, cy + 8); }
  ctx.stroke();

  // Amount + status
  ctx.textAlign = "center"; ctx.fillStyle = "#0b1410"; ctx.font = `700 76px ${font}`;
  ctx.fillText(`${t.amount > 0 ? "+" : "-"}$${Math.abs(t.amount).toFixed(2)}`, cx, 450);
  ctx.fillStyle = color; ctx.font = `600 30px ${font}`;
  ctx.fillText(tr(t.status), cx, 510);

  // Rows
  ctx.textAlign = "left";
  let y = 580;
  ctx.strokeStyle = "#e5e9e7"; ctx.lineWidth = 2;
  for (const [k, v] of rows) {
    ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
    ctx.fillStyle = "#6b7a73"; ctx.font = `500 26px ${font}`; ctx.textBaseline = "middle";
    ctx.fillText(k, PAD, y + 42);
    ctx.fillStyle = "#0b1410"; ctx.font = `600 28px ${font}`; ctx.textAlign = "right";
    let text = v;
    const max = W - PAD * 2 - 250;
    while (ctx.measureText(text).width > max && text.length > 4) text = text.slice(0, -2);
    if (text !== v) text += "...";
    ctx.fillText(text, W - PAD, y + 42);
    ctx.textAlign = "left";
    y += 84;
  }
  ctx.beginPath(); ctx.moveTo(PAD, y); ctx.lineTo(W - PAD, y); ctx.stroke();
  ctx.fillStyle = "#9aa8a1"; ctx.font = `500 22px ${font}`; ctx.textAlign = "center";
  ctx.fillText("kashopay.com", cx, y + 60);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image"))), "image/png"));
}

/** On phones opens the share sheet (Save Image / Photos); elsewhere downloads the PNG. */
export async function saveReceiptImage(t: Transaction): Promise<"shared" | "downloaded"> {
  const blob = await renderReceiptImage(t);
  const name = `${t.id}-kasho-receipt.png`;
  const file = new File([blob], name, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Kasho Pay" });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "shared"; // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
