import { jwtVerify, SignJWT } from 'jose';

const secretKey = process.env.JWT_SECRET_KEY || 'impacto-edu-super-secret-key-2026-development-only';
const encodedKey = new TextEncoder().encode(secretKey);

export async function signJWT(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(encodedKey);
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}
