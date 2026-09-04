import { SignIn, SignOutButton } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  const user = await currentUser();

  if (isAdminUser(user)) {
    redirect("/admin");
  }

  if (user) {
    return (
      <main className="admin-page admin-login">
        <p className="admin-eyebrow">private burrow</p>
        <h1>Wrong Google account.</h1>
        <p>This account is not Clementine’s configured owner account.</p>
        <SignOutButton>
          <button type="button" className="admin-signout">
            Sign out and try again
          </button>
        </SignOutButton>
      </main>
    );
  }

  return (
    <main className="admin-page admin-login">
      <p className="admin-eyebrow">private burrow</p>
      <h1>Clemi control room</h1>
      <p>Continue with Clementine’s Google account.</p>
      <div className="admin-google-signin">
        <SignIn
          routing="hash"
          forceRedirectUrl="/admin"
          signUpForceRedirectUrl="/admin"
        />
      </div>
    </main>
  );
}
