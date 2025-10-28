import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { Octokit } from '@octokit/rest';
import { DatabaseManager, UserSession } from './database';
import { OAuthState } from './types';

// ============================================================================
// Encryption Utilities (AES-256-GCM)
// ============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment variable
 * Key must be 32 bytes (64 hex characters)
 */
function getEncryptionKey(): Buffer {
	const key = process.env.ENCRYPTION_KEY;
	if (!key) {
		throw new Error('ENCRYPTION_KEY environment variable is required');
	}
	if (key.length !== 64) {
		throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
	}
	return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns: base64(iv + authTag + ciphertext)
 */
export function encrypt(plaintext: string): string {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);

	let ciphertext = cipher.update(plaintext, 'utf8');
	ciphertext = Buffer.concat([ciphertext, cipher.final()]);

	const authTag = cipher.getAuthTag();

	// Combine iv + authTag + ciphertext
	const combined = Buffer.concat([iv, authTag, ciphertext]);

	return combined.toString('base64');
}

/**
 * Decrypt a string encrypted with encrypt()
 * Input: base64(iv + authTag + ciphertext)
 */
export function decrypt(encrypted: string): string {
	const combined = Buffer.from(encrypted, 'base64');

	// Extract components
	const iv = combined.subarray(0, IV_LENGTH);
	const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
	const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

	const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
	decipher.setAuthTag(authTag);

	let plaintext = decipher.update(ciphertext);
	plaintext = Buffer.concat([plaintext, decipher.final()]);

	return plaintext.toString('utf8');
}

// ============================================================================
// Session Token Generation
// ============================================================================

/**
 * Generate a cryptographically secure session token
 */
export function generateSessionToken(): string {
	return randomBytes(32).toString('base64url');
}

/**
 * Generate a cryptographically secure nonce for OAuth state
 */
export function generateNonce(): string {
	return randomBytes(16).toString('base64url');
}

// ============================================================================
// OAuth Flow Types
// ============================================================================

export interface AuthenticatedRequest extends Request {
	user?: {
		id: number;
		login: string;
		session_token: string;
	};
	session?: UserSession;
}

// ============================================================================
// Session Management
// ============================================================================

/**
 * Middleware to validate session token from cookie
 */
export function requireAuth(db: DatabaseManager) {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		const sessionToken = req.cookies?.session_token;

		if (!sessionToken) {
			res.status(401).json({ error: 'Not authenticated' });
			return;
		}

		const session = db.getUserSessionByToken(sessionToken);

		if (!session) {
			res.status(401).json({ error: 'Invalid session' });
			return;
		}

		// Check if session is expired
		if (session.expires_at < Date.now()) {
			db.deleteUserSession(sessionToken);
			res.status(401).json({ error: 'Session expired' });
			return;
		}

		// Attach user and session to request
		req.session = session;
		req.user = {
			id: session.github_user_id,
			login: '', // Will be populated from GitHub if needed
			session_token: sessionToken,
		};

		next();
	};
}

/**
 * Optional authentication middleware - doesn't fail if not authenticated
 */
export function optionalAuth(db: DatabaseManager) {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
		const sessionToken = req.cookies?.session_token;

		if (sessionToken) {
			const session = db.getUserSessionByToken(sessionToken);

			if (session && session.expires_at >= Date.now()) {
				req.session = session;
				req.user = {
					id: session.github_user_id,
					login: '',
					session_token: sessionToken,
				};
			}
		}

		next();
	};
}

/**
 * Create a new user session
 */
export function createSession(db: DatabaseManager, githubUserId: number, accessToken: string, expiresInSeconds: number = 7 * 24 * 60 * 60): UserSession {
	const sessionToken = generateSessionToken();
	const now = Date.now();
	const expiresAt = now + expiresInSeconds * 1000;

	// Encrypt the access token before storing
	const encryptedToken = encrypt(accessToken);

	return db.createUserSession({
		session_token: sessionToken,
		github_user_id: githubUserId,
		access_token: encryptedToken,
		expires_at: expiresAt,
	});
}

/**
 * Get decrypted access token from session
 */
export function getAccessToken(session: UserSession): string {
	return decrypt(session.access_token);
}

/**
 * Destroy a session
 */
export function destroySession(db: DatabaseManager, sessionToken: string): void {
	db.deleteUserSession(sessionToken);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(db: DatabaseManager): void {
	db.deleteExpiredSessions();
}
