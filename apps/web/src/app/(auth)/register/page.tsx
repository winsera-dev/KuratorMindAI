"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
    } else {
      // For Magic Link registration, it's the same as login
      window.location.href = "/login?message=Check your email to finish registration";
    }
    setLoading(false);
  };

  return (
    <div className="bg-card border border-border-default rounded-2xl p-8 shadow-xl">
      <form onSubmit={handleRegister} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
            Professional Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              id="email"
              type="email"
              placeholder="kurator@firm.id"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary border border-border-default rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 transition-all"
            />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-accent-blue/5 border border-accent-blue/10 text-xs text-text-secondary flex gap-3">
          <Lock className="w-4 h-4 text-accent-blue shrink-0" />
          <p>
            We use **Magic Links** for maximum security. No password to remember or leak. 
            Access is bound to your firm's email domain.
          </p>
        </div>

        {error && (
          <div className="p-4 rounded-xl text-sm bg-accent-rose/10 text-accent-rose">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent-blue hover:bg-accent-blue-hover text-white font-semibold py-3 rounded-xl transition-all shadow-lg hover:shadow-glow-blue flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Register Firm
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-accent-blue hover:underline font-medium">
          Sign in
        </Link>
      </div>
    </div>
  );
}
