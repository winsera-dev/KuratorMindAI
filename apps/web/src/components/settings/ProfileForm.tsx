"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Profile } from "@/types";
import { updateProfile } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Save, User as UserIcon, Award, Briefcase, MapPin } from "lucide-react";

const profileSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  job_title: z.string().optional().nullable(),
  license_number: z.string().optional().nullable(),
  specialization: z.string().optional().nullable(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  initialData: Profile;
}

export default function ProfileForm({ initialData }: ProfileFormProps) {
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: initialData.full_name || "",
      job_title: initialData.job_title || "",
      license_number: initialData.license_number || "",
      specialization: initialData.specialization || "",
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    setLoading(true);
    try {
      await updateProfile(data as any);
      toast.success("Profile updated successfully", {
        description: "Your forensic identity has been synchronized.",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update profile", {
        description: "An error occurred while saving your changes.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 max-w-4xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
            <UserIcon size={14} className="text-accent-blue" />
            Full Name
          </label>
          <input
            {...form.register("full_name")}
            className="w-full bg-secondary/30 border border-border-default/50 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue/50 transition-all placeholder:text-text-muted/50"
            placeholder="e.g. Dr. Budi Santoso, S.H., M.H."
          />
          {form.formState.errors.full_name && (
            <p className="text-accent-rose text-[10px] font-bold uppercase tracking-tight mt-1">{form.formState.errors.full_name.message}</p>
          )}
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <Briefcase size={14} className="text-accent-blue" />
                Job Title
            </label>
            <input
                {...form.register("job_title")}
                className="w-full bg-secondary/30 border border-border-default/50 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue/50 transition-all placeholder:text-text-muted/50"
                placeholder="e.g. Lead Kurator"
            />
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <Award size={14} className="text-accent-blue" />
                License Number
            </label>
            <input
                {...form.register("license_number")}
                className="w-full bg-secondary/30 border border-border-default/50 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue/50 transition-all font-mono placeholder:text-text-muted/50 uppercase"
                placeholder="e.g. AHU-001-2023"
            />
        </div>

        <div className="space-y-2">
            <label className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] flex items-center gap-2">
                <MapPin size={14} className="text-accent-blue" />
                Specialization
            </label>
            <input
                {...form.register("specialization")}
                className="w-full bg-secondary/30 border border-border-default/50 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent-blue/30 focus:border-accent-blue/50 transition-all placeholder:text-text-muted/50"
                placeholder="e.g. Insolvency Litigation"
            />
        </div>
      </div>

      <div className="pt-8 border-t border-border-default/30 flex items-center justify-between">
        <p className="text-[10px] text-text-muted font-medium max-w-sm">
            Updating your forensic identity will standardize your signatures and legal metadata across all generated reports and court filings.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-10 py-4 bg-accent-blue text-white rounded-2xl text-xs font-black hover:bg-accent-blue/90 transition-all shadow-xl shadow-accent-blue/20 uppercase tracking-[0.15em] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />}
          Synchronize Identity
        </button>
      </div>
    </form>
  );
}
