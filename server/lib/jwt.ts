/**
 * JWT helpers for the FlowProof demo.
 * Merchants sign in via /auth/login and receive a token with { role, userId }.
 * Lender tokens are pre-generated in the lender app's auth middleware.
 */
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'flowproof-demo-secret-not-for-production';
const TTL = '24h';

export type TokenPayload = { role: 'merchant'; userId: string } | { role: 'lender' };

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TTL });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, SECRET) as TokenPayload;
}

/** Express middleware: attaches req.user or responds 401. */
import type { Request, Response, NextFunction } from 'express';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ error: 'Missing token' }); return; }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireMerchant(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'merchant') { res.status(403).json({ error: 'Merchant token required' }); return; }
    next();
  });
}

export function requireLender(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'lender') { res.status(403).json({ error: 'Lender token required' }); return; }
    next();
  });
}
