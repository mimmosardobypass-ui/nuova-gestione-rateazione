import { useFitToWidth } from "@/hooks/useFitToWidth";
import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const shouldApplyFit = !location.pathname.startsWith('/print');
  
  const fitRef = useFitToWidth<HTMLDivElement>({ 
    minScale: shouldApplyFit ? 0.85 : 1.0,
    maxScale: 1.0, 
    breakpoint: 768 
  });

  return (
    <div ref={fitRef} id="fit-root" className="min-w-0">
      {children}
    </div>
  );
}
