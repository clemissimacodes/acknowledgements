import Link from "next/link";
import { PostiesForm } from "@/components/posties/PostiesForm";

export const metadata = {
  title: "Sunday Posties",
  description: "Sign up for a doodle or caboodle from Clementine.",
};

export default function SundayPostiesPage() {
  return (
    <main className="unlock-page posties-page">
      <p className="poetry-kicker">
        <Link href="/">Clementine Kay Shao</Link>
      </p>
      <h1>Sunday Posties</h1>
      <p className="posties-lede">
        Sundays are for writing posties to families and friendlies. Sometimes
        it be a doodle, sometimes it be a caboodle. The 1 rule to Sunday
        Posties is you must doodle or caboodle back.
      </p>
      <p className="posties-privacy">
        Your mailing address stays private. Your social profile is only so I
        know I am sending mail to a real friendly, not a weirdie.
      </p>
      <PostiesForm />
    </main>
  );
}
