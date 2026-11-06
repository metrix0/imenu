import { type ReactNode } from "react";
import "@/app/painel/essencial.css";
import DevShell from "@/components/dev/DevShell";
export default function DevLayout({ children }: { children: ReactNode }) { return <DevShell>{children}</DevShell>; }
