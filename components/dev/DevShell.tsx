"use client";
import { useEffect, useRef, useState, type ReactNode, type FormEvent } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { DEV_EMAIL, watchDevAccess, type DevAccess } from "@/lib/dev/access";
import PanelAppearance from "@/components/ui/PanelAppearance";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import DevNavigation from "./DevNavigation";
import styles from "./dashboard.module.css";
export default function DevShell({ children }: { children: ReactNode }) {
 const [access, setAccess] = useState<DevAccess>("checking"), [email,setEmail] = useState(DEV_EMAIL), [password,setPassword] = useState(""), [busy,setBusy] = useState(false), [error,setError] = useState("");
 const auth = useRef<ReturnType<typeof watchDevAccess> | null>(null);
 useEffect(() => { const watcher = watchDevAccess(setAccess); auth.current = watcher; return () => { watcher.unsubscribe(); auth.current = null; }; }, []);
 async function login(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password }); setPassword(""); if (error) setError("Não foi possível entrar. Confira seu e-mail e senha."); else await auth.current?.retry(); } catch { setError("Não foi possível conectar. Tente novamente."); } finally { setBusy(false); } }
 return <PanelAppearance>{access !== "allowed" ? <div className={styles.login}>{access === "checking" ? <Loader /> : <Card className="w-full max-w-sm"><h1 className="mb-6 text-xl font-semibold">Entrar no dashboard</h1><form className="space-y-4" onSubmit={event => void login(event)}><Input label="E-mail" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /><Input label="Senha" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} />{(error || access === "forbidden" || access === "error") && <p role="alert" className="text-sm text-red-700">{error || (access === "forbidden" ? "Esta conta não tem acesso à administração." : "Não foi possível verificar sua sessão.")}</p>}<Button type="submit" loading={busy} className="w-full">Entrar</Button></form></Card>}</div> : <DevNavigation>{children}</DevNavigation>}</PanelAppearance>;
}
