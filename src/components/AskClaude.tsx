"use client";

import { SECONDARY_BUTTON } from "@/components/iconButton";

// Opens Claude with `question` ready to send, for Claude to answer through Cadent's connector on the
// owner's own Claude plan. claude.ai's ?q= isn't documented, so the question is copied too: if Claude
// opens with an empty box, paste it.
export function AskClaude({ question }: { question: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={`https://claude.ai/new?q=${encodeURIComponent(question)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => navigator.clipboard?.writeText(question).catch(() => {})}
        className={`${SECONDARY_BUTTON} gap-2 bg-surface`}
      >
        <svg
          aria-hidden="true"
          className="size-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 18l-1 3 3.5-1.5A8.5 8.5 0 1 0 5 18z" />
        </svg>
        Ask Claude
      </a>
      <p className="text-center text-xs text-muted">Your question is copied too, in case Claude opens empty.</p>
    </div>
  );
}
