"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Mail, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.status === 400 || error.message.toLowerCase().includes("invalid")) {
        setMessage({ type: "error", text: "Invalid credentials. If you haven't registered, please create an account first." });
      } else {
        setMessage({ type: "error", text: error.message });
      }
    } else {
      setMessage({ type: "success", text: "Check your email for the magic link!" });
    }
    setLoading(false);
  };

  return (
    <div className="bg-card border border-border-default rounded-2xl p-8 shadow-xl">
      <form onSubmit={handleLogin} className="space-y-6">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              id="email"
              type="email"
              placeholder="name@firm.id"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-secondary border border-border-default rounded-xl py-3 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 transition-all"
            />
          </div>
        </div>

        {message && (
          <div className={`p-4 rounded-xl text-sm ${
            message.type === "success" 
              ? "bg-accent-emerald/10 text-accent-emerald" 
              : "bg-accent-rose/10 text-accent-rose"
          }`}>
            {message.text}
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
              Sign In with Magic Link
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-8 text-center text-sm text-text-muted">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-accent-blue hover:underline font-medium">
          Create one
        </Link>
      </div>
    </div>
  );
}
