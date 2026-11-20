import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  type User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/documents',
] as const;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
for (const scope of WORKSPACE_SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'consent',
});

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export function initWorkspaceAuth(
  onAuthenticated: (user: User, accessToken: string | null) => void,
  onSignedOut: () => void
): () => void {
  return onAuthStateChanged(auth, (user) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthenticated(user, cachedAccessToken);
      } else if (!isSigningIn) {
        onAuthenticated(user, null);
      }
    } else {
      cachedAccessToken = null;
      onSignedOut();
    }
  });
}

export async function signInWithGoogleWorkspace(): Promise<{
  user: User;
  accessToken: string;
}> {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google authorization did not return an OAuth access token.');
    }
    cachedAccessToken = credential.accessToken;
    return {
      user: result.user,
      accessToken: cachedAccessToken,
    };
  } finally {
    isSigningIn = false;
  }
}

export function getWorkspaceAccessToken(): string | null {
  return cachedAccessToken;
}

export async function signOutGoogleWorkspace(): Promise<void> {
  cachedAccessToken = null;
  await auth.signOut();
}
