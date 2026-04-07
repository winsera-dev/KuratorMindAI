import React from "react";
import ForensicDefaultsForm from "@/components/settings/ForensicDefaultsForm";

export default function ForensicSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Forensic Algorithms</h2>
        <p className="text-text-muted mt-1">
          Configure high-fidelity analysis thresholds and automated debt mapping logic.
        </p>
      </div>
      <ForensicDefaultsForm />
    </div>
  );
}
