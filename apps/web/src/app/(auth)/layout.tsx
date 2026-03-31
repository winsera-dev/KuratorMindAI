import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden text-text-primary">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-blue/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">
            KuratorMind <span className="text-text-secondary">AI</span>
          </h1>
          <p className="mt-2 text-text-secondary">
            AI-Native Insolvency Forensic Workspace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
