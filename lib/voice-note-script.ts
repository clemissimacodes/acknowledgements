/* Soft, universal voice-note script — short enough to say in one breath. */

export function voiceNoteScript(nickname: string) {
  const name = nickname.trim() || "you";
  return `Hey ${name}.

Happy Thanksgiving — I just wanted you to hear me say it:
I'm so glad you're in my life. Thank you for being you.

I love you.`;
}

export function voiceNoteScriptHint(nickname: string) {
  const name = nickname.trim() || "them";
  return `Say it like a present, not a speech. One take is perfect. Speak to ${name}.`;
}
