import { SignJWT, jwtVerify } from "jose";

function getSecretBytes(): Uint8Array | null {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) return null;
  return new TextEncoder().encode(s);
}

export async function signSessionToken(userId: string): Promise<string> {
  const secret = getSecretBytes();
  if (!secret) {
    throw new Error("AUTH_SECRET must be set (16+ characters)");
  }
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function verifySessionToken(
  token: string
): Promise<string | null> {
  const secret = getSecretBytes();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
