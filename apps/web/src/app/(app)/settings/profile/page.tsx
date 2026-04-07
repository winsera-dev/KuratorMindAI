"use client";

import React, { useEffect, useState } from "react";
import ProfileForm from "@/components/settings/ProfileForm";
import { getProfile } from "@/lib/api";
import { Profile } from "@/types";
import { Loader2 } from "lucide-react";

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProfile().then(data => {
      setProfile(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent-blue" />
        <p className="text-xs text-text-muted font-bold tracking-widest uppercase">Initializing Identity Node...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="h-64 flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-text-muted">Protocol synchronization failed.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight italic uppercase">Curator Identity</h2>
        <p className="text-text-muted mt-1 text-sm font-medium">
          Manage your forensic persona and verified legal credentials.
        </p>
      </div>
      <ProfileForm initialData={profile} />
    </div>
  );
}
