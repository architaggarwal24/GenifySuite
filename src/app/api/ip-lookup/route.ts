import { NextResponse } from "next/server";

const IP_V4_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_REGEX = /^[0-9a-fA-F:]+$/;

function isValidIp(value: string): boolean {
  if (IP_V4_REGEX.test(value)) {
    return value.split(".").every((part) => Number(part) <= 255);
  }
  return IP_V6_REGEX.test(value) && value.includes(":");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let ip = searchParams.get("ip")?.trim();

  if (!ip) {
    // Fall back to the caller's own address (useful for "what's my IP").
    const forwardedFor = request.headers.get("x-forwarded-for");
    ip = forwardedFor?.split(",")[0]?.trim();
  }

  if (!ip || !isValidIp(ip)) {
    return NextResponse.json({ error: "Enter a valid IPv4 or IPv6 address." }, { status: 400 });
  }

  // ip-api.com's free tier is HTTP-only; this call happens server-side so
  // there's no browser mixed-content restriction.
  const upstream = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,query,country,regionName,city,zip,lat,lon,timezone,isp,org,as`,
    { cache: "no-store" }
  ).catch(() => null);

  if (!upstream || !upstream.ok) {
    return NextResponse.json({ error: "The lookup service is unavailable right now." }, { status: 502 });
  }

  const data = await upstream.json();

  if (data.status === "fail") {
    return NextResponse.json({ error: data.message ?? "Lookup failed." }, { status: 400 });
  }

  return NextResponse.json({ result: data });
}
