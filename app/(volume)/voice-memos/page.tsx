import type { Metadata } from "next";
import { VoiceMemosPage } from "@/components/voice-memos/VoiceMemosPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Voice Memos",
  description: "Notes to self and singing, by Clementine Kay Shao.",
};

export default function Page() {
  return <VoiceMemosPage slug={null} />;
}
