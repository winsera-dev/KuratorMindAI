import React from "react";
import SecurityForm from "@/components/settings/SecurityForm";

export default function SecuritySettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Security Protocol</h2>
        <p className="text-text-muted mt-1">
          Lock down your workspace with biometric authentication and session monitoring.
        </p>
      </div>
      <SecurityForm />
    </div>
  );
}
