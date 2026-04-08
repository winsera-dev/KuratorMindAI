import { ReactNode } from "react";
import Image from "next/image";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 relative overflow-hidden text-text-primary">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-accent-blue/5 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent-cyan/5 blur-[120px]" />
      </div>

      <div className="w-full max-w-4xl relative z-10 px-6">
        <div className="mb-12 flex flex-col items-center text-center">
          <div className="flex items-center mb-2 whitespace-nowrap">
            <span className="text-8xl font-black tracking-tighter text-text-primary leading-none">
              KuratorMind <span className="text-accent-blue">AI</span>
            </span>
          </div>
        </div>
        <div className="max-w-md mx-auto w-full">
          <p className="text-sm text-text-secondary font-bold mb-8 text-center uppercase tracking-[0.3em]">
            AI-Native Insolvency Forensic Workspace
          </p>
          {children}
        </div>
      </div>
    </div>
  );
}
