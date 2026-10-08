"use client";

import { useState } from "react";
import { AiAssistSection } from "@/components/ai-assist-section";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAiRun } from "@/hooks/use-ai-run";
import { type FakeProfile } from "@/lib/profile";

export function ProfileAiAssist({ onProfile }: { onProfile: (profile: FakeProfile) => void }) {
  const { run, loading, error } = useAiRun();
  const [description, setDescription] = useState("");

  return (
    <AiAssistSection title="Describe who you need">
      {(selection) => (
        <div>
          <Label htmlFor="profile-steer">Plain-English description</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="profile-steer"
              placeholder="e.g. a 60-year-old retired teacher in rural Japan"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button
              disabled={!selection || loading || !description.trim()}
              onClick={async () => {
                const result = await run<{ profile: FakeProfile }>("profile", { description }, selection);
                if (result) onProfile(result.profile);
              }}
            >
              {loading ? "Generating…" : "Generate with AI"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-sm text-rust">
              {error}
            </p>
          )}
          <p className="mt-2 text-xs text-paper-faint">
            The result replaces the profile above. Names and details are fictional and use example.com-style emails.
          </p>
        </div>
      )}
    </AiAssistSection>
  );
}
