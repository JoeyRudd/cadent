import { iconImage } from "@/lib/icon";

// The icons manifest.ts lists. Their URLs are fixed, which icon.tsx's generated ones aren't.
const SIZES: Record<string, [number, boolean]> = { "192": [192, false], "512": [512, false], maskable: [512, true] };

export function generateStaticParams() {
  return Object.keys(SIZES).map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: RouteContext<"/pwa-icon/[size]">) {
  const { size } = await params;
  const icon = SIZES[size];
  return icon ? iconImage(...icon) : new Response(null, { status: 404 });
}
