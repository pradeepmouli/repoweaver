import { Router, Request, Response } from 'express';
import { Octokit } from '@octokit/rest';
import { DatabaseManager } from '../database';
import { generateSessionToken, generateNonce, encrypt, createSession } from '../auth';
import { OAuthState } from '../types';

export function createOAuthRouter(db: DatabaseManager): Router {
	const router = Router();

	const clientId = process.env.GITHUB_CLIENT_ID;
	const clientSecret = process.env.GITHUB_CLIENT_SECRET;
	const publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000';

	if (!clientId || !clientSecret) {
		throw new Error('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are required');
	}

	/**
	 * GET /auth/github
	 * Initiate GitHub OAuth flow
	 */
	router.get('/github', (req: Request, res: Response) => {
		const returnUrl = (req.query.return_url as string) || '/';
		
		// Generate OAuth state with nonce
		const state: OAuthState = {
			nonce: generateNonce(),
			return_url: returnUrl,
			created_at: Date.now(),
		};

		const stateString = Buffer.from(JSON.stringify(state)).toString('base64url');

		const authUrl = new URL('https://github.com/login/oauth/authorize');
		authUrl.searchParams.set('client_id', clientId);
		authUrl.searchParams.set('redirect_uri', `${publicUrl}/auth/github/callback`);
		authUrl.searchParams.set('state', stateString);
		authUrl.searchParams.set('scope', 'user:email');

		res.redirect(authUrl.toString());
	});

	/**
	 * GET /auth/github/callback
	 * Handle GitHub OAuth callback
	 */
	router.get('/github/callback', async (req: Request, res: Response) => {
		const { code, state: stateString } = req.query;

		if (!code || typeof code !== 'string') {
			return res.status(400).json({ error: 'Missing authorization code' });
		}

		if (!stateString || typeof stateString !== 'string') {
			return res.status(400).json({ error: 'Missing state parameter' });
		}

		try {
			// Decode and validate state
			const state: OAuthState = JSON.parse(Buffer.from(stateString, 'base64url').toString('utf8'));

			// Check state age (should be < 10 minutes old)
			const stateAge = Date.now() - state.created_at;
			if (stateAge > 10 * 60 * 1000) {
				return res.status(400).json({ error: 'OAuth state expired' });
			}

			// Exchange code for access token
			const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client_id: clientId,
					client_secret: clientSecret,
					code,
					redirect_uri: `${publicUrl}/auth/github/callback`,
				}),
			});

			const tokenData = (await tokenResponse.json()) as {
				access_token?: string;
				error?: string;
				error_description?: string;
			};

			if (tokenData.error || !tokenData.access_token) {
				return res.status(400).json({
					error: 'OAuth authorization failed',
					details: tokenData.error_description || tokenData.error,
				});
			}

			// Get user information
			const octokit = new Octokit({
				auth: tokenData.access_token,
			});

			const userResponse = await octokit.rest.users.getAuthenticated();
			const user = userResponse.data;

			// Create session (token will be encrypted)
			const session = createSession(db, user.id, tokenData.access_token);

			// Set session cookie
			res.cookie('session_token', session.session_token, {
				httpOnly: true,
				secure: process.env.NODE_ENV === 'production',
				sameSite: 'lax',
				maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
			});

			// Redirect to return URL or home
			const returnUrl = state.return_url || '/';
			res.redirect(returnUrl);
		} catch (error) {
			console.error('OAuth callback error:', error);
			return res.status(500).json({
				error: 'Authentication failed',
				details: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	});

	/**
	 * POST /auth/logout
	 * Destroy user session
	 */
	router.post('/logout', (req: Request, res: Response) => {
		const sessionToken = req.cookies?.session_token;

		if (sessionToken) {
			db.deleteUserSession(sessionToken);
		}

		res.clearCookie('session_token');
		res.json({ success: true, message: 'Logged out successfully' });
	});

	return router;
}
