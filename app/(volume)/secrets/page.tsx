import { cookies } from "next/headers";
import { SecretsUnlockForm } from "@/components/SecretsUnlockForm";
import { SECRETS_COOKIE, hasSecretsCookie } from "@/lib/secrets-gate";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Secrets",
  description: "my secrets are behind a simple password.",
};

export default async function SecretsPage() {
  const jar = await cookies();
  const unlocked = await hasSecretsCookie(
    jar.get(SECRETS_COOKIE)?.value,
    process.env.CIA_PASSWORD?.trim(),
  );

  if (unlocked) {
    return (
      <main className={styles.page}>
        <p className={styles.line}>you made it. here is my secret.</p>
        <div className={styles.video}>
          <iframe
            src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0"
            title="my secret"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.line}>
        my secrets are behind a simple password. hack into it and my secrets
        are yours
      </h1>
      <SecretsUnlockForm />
    </main>
  );
}
