import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[radial-gradient(circle_at_top,#13294b_0%,#0a192f_45%,#050b16_100%)] p-4 select-none">
      {/* Banner Superior de WeShuttle */}
      <div className="flex flex-col items-center mb-6 text-center">
        <div className="flex items-center justify-center w-14 h-14 bg-white rounded-xl border border-slate-200 shadow-[0_4px_16px_rgba(0,0,0,0.1)] p-2 mb-3 shrink-0 transition-transform duration-300 hover:scale-105">
          <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M 22 34 L 35 75 L 50 45 L 65 75 L 78 34"
              fill="none"
              stroke="#0c59cf"
              strokeWidth="13"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="22" cy="30" r="8.5" fill="#e63946" />
            <circle cx="50" cy="40" r="8.5" fill="#f59e0b" />
            <circle cx="78" cy="30" r="8.5" fill="#10b981" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold italic text-white tracking-tight">
          WeShuttle
        </h1>
        <p className="text-slate-300 text-[14px] mt-1.5 max-w-xs font-medium">
          Iniciá sesión para coordinar tus traslados corporativos
        </p>
      </div>

      <SignIn
        path="/sign-in"
        routing="path"
        appearance={{
          elements: {
            headerTitle: "hidden",
            headerSubtitle: "hidden",
            card: "rounded-[8px] border border-slate-200 shadow-xl",
            formButtonPrimary: "bg-[#0a192f] hover:bg-[#13294b] text-white rounded-[8px] transition-colors text-[14px] font-bold h-11 border-0 shadow-none",
            formFieldInput: "rounded-[8px] border border-slate-200 focus:border-[#0a192f] focus:ring-[#0a192f] transition-all h-10",
            footerActionLink: "text-[#0a192f] hover:text-[#13294b] transition-colors font-bold",
            socialButtonsBlockButton: "rounded-[8px] border border-slate-200 hover:bg-slate-50 transition-colors h-10",
            socialButtonsBlockButtonText: "font-semibold text-slate-600",
          }
        }}
      />
    </div>
  );
}
