import { NextRequest } from "next/server";
import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal";

export const runtime = "nodejs";

async function toResponseArrayBuffer(
  data: Uint8Array | ArrayBuffer | Blob
): Promise<ArrayBuffer> {
  if (data instanceof ArrayBuffer) return data;
  if (data instanceof Uint8Array) return Uint8Array.from(data).buffer;
  return await data.arrayBuffer();
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return new Response("No file uploaded", { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    // Tier 1: quick removal for white/light backgrounds.
    const processed = await sharp(buffer).png().ensureAlpha().unflatten().toBuffer();
    const body = await toResponseArrayBuffer(processed);

    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Tier 2 fallback for complex backgrounds.
    const result = await removeBackground(buffer);
    const body = await toResponseArrayBuffer(result);

    return new Response(body, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }
}
