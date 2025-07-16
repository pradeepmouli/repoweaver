import type { TOKEN_TYPE } from '@octokit/auth-app/dist-types/types';
import { Octokit } from '@octokit/rest';
import { NextFunction, Request, Response } from 'express';
import { Database } from './database';

export interface AuthenticatedUser {
	id: number;
	login: string;
	name: string;
	email: string;
	avatarUrl: string;
	installationId?: number;
}

export interface AuthenticatedRequest extends Request {
	user?: AuthenticatedUser;
}

export class AuthManager {
	private clientId: string;
	private clientSecret: string;
	private database: Database;

	constructor(clientId: string, clientSecret: string, database: Database) {
		this.clientId = clientId;
		this.clientSecret = clientSecret;
		this.database = database;
	}

	getAuthorizationUrl(state?: string): string {
		const params = new URLSearchParams({
			client_id: this.clientId,
			redirect_uri: `${process.env.APP_URL}/auth/callback`,
			scope: 'user:email',
			state: state || '',
		});

		return `https://github.com/login/oauth/authorize?${params}`;
	}

	async handleCallback(code: string, state?: string): Promise<AuthenticatedUser> {
		try {
			// Exchange code for access token
			const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					client_id: this.clientId,
					client_secret: this.clientSecret,
					code,
					redirect_uri: `${process.env.APP_URL}/auth/callback`,
				}),
			});

			const tokenData = (await tokenResponse.json()) as { access_token: string; error?: string; error_description?: string };

			if (tokenData.error) {
				throw new Error(`OAuth error: ${tokenData.error_description}`);
			}

			// Get user information
			const octokit = new Octokit({
				auth: tokenData.access_token,
			});

			const userResponse = await octokit.rest.users.getAuthenticated();
			const user = userResponse.data;

			// Check if user has any installations
			const installationsResponse = await octokit.rest.apps.listInstallationsForAuthenticatedUser({
				per_page: 100,
			});

			const installations = installationsResponse.data.installations;
			let installationId: number | undefined;

			if (installations.length > 0) {
				// For simplicity, use the first installation
				// In a real app, you might want to let the user choose
				installationId = installations[0].id;
			}

			const authenticatedUser: AuthenticatedUser = {
				id: user.id,
				login: user.login,
				name: user.name || user.login,
				email: user.email || '',
				avatarUrl: user.avatar_url,
				installationId,
			};

			// Store user session
			await this.database.createUserSession({
				userId: user.id,
				login: user.login,
				accessToken: tokenData.access_token,
				installationId,
				createdAt: new Date(),
			});

			return authenticatedUser;
		} catch (error) {
			throw new Error(`Authentication failed: ${error}`);
		}
	}

	async authenticateMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
		try {
			const authHeader = req.headers.authorization;
			if (!authHeader || !authHeader.startsWith('Bearer ')) {
				res.status(401).json({ error: 'No valid authorization header' });
				return;
			}

			const token = authHeader.substring(7);
			const session = await this.database.getUserSessionByToken(token);

			if (!session) {
				res.status(401).json({ error: 'Invalid token' });
				return;
			}

			// Verify token is still valid with GitHub
			const octokit = new Octokit({
				auth: session.accessToken,
			});

			const userResponse = await octokit.rest.users.getAuthenticated();
			const user = userResponse.data;

			req.user = {
				id: user.id,
				login: user.login,
				name: user.name || user.login,
				email: user.email || '',
				avatarUrl: user.avatar_url,
				installationId: session.installationId,
			};

			next();
		} catch (error) {
			res.status(401).json({ error: 'Authentication failed' });
		}
	}

	async requireInstallation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
		if (!req.user?.installationId) {
			res.status(403).json({
				error: 'GitHub App installation required',
				message: 'Please install the RepoWeaver app to your GitHub account or organization',
			});
			return;
		}

		next();
	}

	async logout(userId: number): Promise<void> {
		await this.database.deleteUserSession(userId);
	}

	async getInstallationRepositories(installationId: number): Promise<any[]> {
		try {
			const octokit = new Octokit({
				auth: `Bearer ${process.env.GITHUB_ACCESS_TOKEN}`,
			});

			const response = await octokit.rest.apps.listReposAccessibleToInstallation({
				installation_id: installationId,
				per_page: 100,
			});

			return response.data.repositories;
		} catch (error) {
			console.error('Failed to get installation repositories:', error);
			return [];
		}
	}
}

export class SessionManager {
	private sessions: Map<string, AuthenticatedUser> = new Map();

	generateSessionToken(): string {
		return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
	}

	createSession(user: AuthenticatedUser): string {
		const token = this.generateSessionToken();
		this.sessions.set(token, user);
		return token;
	}

	getSession(token: string): AuthenticatedUser | undefined {
		return this.sessions.get(token);
	}

	deleteSession(token: string): void {
		this.sessions.delete(token);
	}

	cleanup(): void {
		// In a real implementation, you'd clean up expired sessions
		// For now, we'll just log the session count
		console.log(`Active sessions: ${this.sessions.size}`);
	}
}
