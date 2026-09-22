/**
 * Google / Notion sign-in via Appwrite's OAuth2 providers. The client never
 * holds provider secrets. Web uses the cookie-based createOAuth2Session
 * redirect; native uses createOAuth2Token + expo-web-browser and exchanges
 * userId/secret for a session (createOAuth2Session does not work in RN).
 * Redirect URLs must be allow-listed as platforms in the Appwrite console.
 */
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import type { AuthProvider } from '@/types/api';
import { env } from '@/infrastructure/config/env';
import { account } from './client';

export type OAuthProviderName = Exclude<AuthProvider, 'email'>;
export const OAUTH_PROVIDERS: OAuthProviderName[] = ['google', 'notion'];
export const OAUTH_RETURN_PATH = '/auth/oauth-return';

/** Minimal scopes: identity only. Notion never reads workspace content. */
const SCOPES: Record<OAuthProviderName, string[]> = { google: ['openid', 'email', 'profile'], notion: [] };

export const callbackScheme = (): string => `appwrite-callback-${env.appwriteProjectId}`;

export function oauthReturnUrl(): string {
  if (Platform.OS === 'web') return `${window.location.origin}${OAUTH_RETURN_PATH}`;
  if (Constants.expoConfig?.hostUri) return Linking.createURL(OAUTH_RETURN_PATH);
  return `${callbackScheme()}://auth/oauth-return`;
}

export type OAuthReturnParams = { userId?: string; secret?: string };

export function parseOAuthReturnUrl(raw: string | null | undefined): OAuthReturnParams {
  if (!raw) return {};
  try {
    const url = new URL(raw, 'app://local');
    const userId = url.searchParams.get('userId');
    const secret = url.searchParams.get('secret');
    return userId && secret ? { userId, secret } : {};
  } catch {
    return {};
  }
}

export type OAuthOutcome = { kind: 'redirecting' } | { kind: 'cancelled' } | { kind: 'returned'; params: OAuthReturnParams };

export async function openOAuth(provider: OAuthProviderName): Promise<OAuthOutcome> {
  const success = oauthReturnUrl();
  const params = { provider: provider as never, success, failure: `${success}?error=provider&provider=${provider}`, scopes: SCOPES[provider] };
  if (Platform.OS === 'web') {
    account.createOAuth2Session(params);
    return { kind: 'redirecting' };
  }
  const authorizeUrl = String(await account.createOAuth2Token(params));
  const result = await WebBrowser.openAuthSessionAsync(authorizeUrl, success);
  if (result.type !== 'success') return { kind: 'cancelled' };
  return { kind: 'returned', params: parseOAuthReturnUrl(result.url) };
}
