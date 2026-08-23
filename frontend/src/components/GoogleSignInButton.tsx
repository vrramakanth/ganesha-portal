"use client";

import { useEffect, useRef, useState } from "react";
import { renderGoogleSignInButton } from "@/lib/googleIdentity";

export default function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    renderGoogleSignInButton(ref.current, onCredential).catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={ref} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
