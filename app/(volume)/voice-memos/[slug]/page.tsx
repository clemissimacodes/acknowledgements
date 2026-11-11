import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VoiceMemosPage } from "@/components/voice-memos/VoiceMemosPage";
import { getRecordingBySlug } from "@/lib/recordings";
import { formatClock, formatRecordingDate } from "@/lib/recording-types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const recording = await getRecordingBySlug(slug).catch(() => null);
  if (!recording) return { title: "Voice Memos" };
  return {
    title: `${recording.title} — Voice Memos`,
    description: `${formatRecordingDate(recording.recordedAt)} · ${formatClock(recording.durationMs)}`,
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const recording = await getRecordingBySlug(slug).catch(() => null);
  if (!recording) notFound();
  return <VoiceMemosPage slug={slug} />;
}
