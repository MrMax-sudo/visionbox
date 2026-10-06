let accessToken: string | null = null;
let onAccessTokenChange: ((token: string | null) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  onAccessTokenChange?.(token);
}

export function getAccessToken() {
  return accessToken;
}

export function subscribeAccessTokenChange(callback: (token: string | null) => void) {
  onAccessTokenChange = callback;
}
