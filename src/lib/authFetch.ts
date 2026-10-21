import { auth } from '../firebase';

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const currentUser = auth.currentUser;
  let token: string | null = null;
  
  if (currentUser) {
    try {
      token = await currentUser.getIdToken();
    } catch (tokenErr) {
      console.warn('Failed to get Firebase ID token:', tokenErr);
    }
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
