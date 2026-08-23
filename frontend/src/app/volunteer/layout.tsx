"use client";

import VolunteerNav from "@/components/VolunteerNav";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { VolunteerAuthProvider, useVolunteerAuth } from "@/lib/VolunteerAuthContext";

function VolunteerGate({ children }: { children: React.ReactNode }) {
  const { status, volunteer, error, handleCredential, signOut } = useVolunteerAuth();

  if (status === "checking") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted">Checking sign-in…</p>
      </main>
    );
  }

  if (status !== "signed-in" || !volunteer) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-4 px-5 text-center">
        <h1 className="text-xl font-bold">Volunteer Sign-In</h1>
        <p className="text-sm text-muted max-w-xs">
          Sign in with the Google account your admin registered for volunteer access.
        </p>
        <GoogleSignInButton onCredential={handleCredential} />
        {process.env.NEXT_PUBLIC_TEST_MODE === "true" && (
          <button
            onClick={() => handleCredential("TEST_TOKEN")}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-maroon"
          >
            Sign in as Test Volunteer
          </button>
        )}
        {error && <p className="text-sm text-red-600 max-w-xs">{error}</p>}
      </main>
    );
  }

  return (
    <>
      <div className="w-full max-w-lg mx-auto flex items-center justify-between px-5 pt-3 text-xs text-muted">
        <span>{volunteer.email}</span>
        <button onClick={signOut} className="font-semibold text-maroon">
          Sign out
        </button>
      </div>
      <main className="flex-1 w-full max-w-lg mx-auto pb-20">{children}</main>
      <VolunteerNav />
    </>
  );
}

export default function VolunteerLayout({ children }: { children: React.ReactNode }) {
  return (
    <VolunteerAuthProvider>
      <VolunteerGate>{children}</VolunteerGate>
    </VolunteerAuthProvider>
  );
}
