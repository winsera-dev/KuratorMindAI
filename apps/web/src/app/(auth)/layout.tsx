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

      <div className="w-full max-w-md relative z-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image 
            src="/brand/logo-full.svg?v=5" 
            alt="KuratorMind AI" 
            width={180} 
            height={48} 
            priority 
            className="h-12 w-auto mb-2"
          />
          <p className="text-text-secondary">
            AI-Native Insolvency Forensic Workspace
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
