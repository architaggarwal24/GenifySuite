"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { ProfileAiAssist } from "@/components/profile-ai-assist";
import { ResultReveal } from "@/components/result-reveal";
import { SaveHistoryButton } from "@/components/save-history-button";
import { ToolShell } from "@/components/tool-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { generateFakeProfile, type FakeProfile } from "@/lib/profile";
import { getToolBySlug } from "@/lib/tools-registry";

const tool = getToolBySlug("profile-generator")!;

const FIELD_LABELS: Record<keyof FakeProfile, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email",
  username: "Username",
  phone: "Phone",
  jobTitle: "Job title",
  street: "Street",
  city: "City",
  region: "Region",
  postalCode: "Postal code",
  country: "Country",
  birthDate: "Birth date",
};

export default function ProfileGeneratorPage() {
  const [profile, setProfile] = useState<FakeProfile | null>(null);

  function handleGenerate() {
    setProfile(generateFakeProfile());
  }

  const asJson = profile ? JSON.stringify(profile, null, 2) : "";

  return (
    <ToolShell tool={tool}>
      <Card>
        <Button onClick={handleGenerate}>{profile ? "Generate another" : "Generate profile"}</Button>

        {profile && (
          <ResultReveal revealKey={profile.email}>
            <div className="mt-5">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                {(Object.keys(FIELD_LABELS) as Array<keyof FakeProfile>).map((key) => (
                  <div key={key} className="border-b border-ink-line pb-2">
                    <dt className="text-xs text-paper-faint">{FIELD_LABELS[key]}</dt>
                    <dd className="mt-0.5 font-mono text-sm text-paper">{profile[key]}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <CopyButton value={asJson} />
                <SaveHistoryButton tool="profile-generator" label={profile.fullName} payload={profile} />
              </div>
            </div>
          </ResultReveal>
        )}

        <ProfileAiAssist onProfile={setProfile} />
      </Card>

      <p className="mt-4 text-xs text-paper-faint">
        Every field is generated locally from placeholder word lists — no real person's data is
        looked up or used.
      </p>
    </ToolShell>
  );
}
