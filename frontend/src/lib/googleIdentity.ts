"use client";

type CredentialResponse = { credential: string };

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: CredentialResponse) => void;
          }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google Sign-In. Please try again."));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export async function renderGoogleSignInButton(
  container: HTMLElement,
  onCredential: (idToken: string) => void
) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) throw new Error("NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID is not set.");

  await loadGsiScript();
  if (!window.google) throw new Error("Google Sign-In failed to load.");

  window.google.accounts.id.initialize({
    client_id: clientId,
    callback: (response) => onCredential(response.credential),
  });
  window.google.accounts.id.renderButton(container, {
    theme: "outline",
    size: "large",
    text: "signin_with",
    shape: "pill",
  });
}

export function disableGoogleAutoSelect() {
  window.google?.accounts?.id?.disableAutoSelect();
}
