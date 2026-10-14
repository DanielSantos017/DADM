import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-gray-50 dark:bg-[#121315]">
        <Sidebar />
        <main className="min-w-0 flex-1 md:ml-56 ml-0 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 flex flex-col min-h-screen print:ml-0 print:bg-white overflow-x-hidden overflow-y-auto p-4 md:p-8 bg-gray-50 dark:bg-[#121315]">
          <Header />
          <div className="max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 w-full">
            {children}
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}


