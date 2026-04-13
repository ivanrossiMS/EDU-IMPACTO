import { jwtVerify, SignJWT } from 'jose';

function getEncodedKey() {
  const secretKey = process.env.JWT_SECRET_KEY;
  if (!secretKey) throw new Error('FATAL: JWT_SECRET_KEY environment variable is required. Set it in .env.local');
  return new TextEncoder().encode(secretKey);
}

export async function signJWT(payload: any) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(getEncodedKey());
}

export async function verifyJWT(token: string) {
  try {
    const { payload } = await jwtVerify(token, getEncodedKey(), {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error) {
    console.error('JWT Verification failed:', error);
    return null;
  }
}
