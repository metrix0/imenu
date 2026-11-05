"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Activity, BarChart3, Bell, CreditCard, Headphones, LayoutDashboard, LogOut, Menu, Users } from "lucide-react";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import styles from "./dashboard.module.css";
const sections = [{label:"Dashboard",href:"/dev",icon:LayoutDashboard},{label:"Health",href:"/dev/health",icon:Activity},{label:"CRM",href:"/dev/crm",icon:Users},{label:"Blast",href:"/dev/blast",icon:Bell},{label:"Payouts",href:"/dev/payouts",icon:CreditCard},{label:"Support",href:"/dev/support",icon:Headphones},{label:"Analytics",href:"/dev/analytics",icon:BarChart3}];
export default function DevNavigation() {
 const path=usePathname(),[mobile,setMobile]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const close=()=>{setMobile(false);document.getElementById("dev-menu-toggle")?.focus();};
 useEffect(()=>{setMobile(false)},[path]);
 useEffect(()=>{const media=window.matchMedia("(min-width:1024px)");const update=()=>{if(media.matches)setMobile(false)};media.addEventListener("change",update);return()=>media.removeEventListener("change",update)},[]);
 async function signOut(){setBusy(true);try{const {error}=await supabase.auth.signOut({scope:"local"});if(error)setError("Não foi possível sair.")}catch{setError("Não foi possível sair.")}finally{setBusy(false)}}
 const navigation=<><Link href="/dev" className={styles.brand}>iMenu <span>Admin</span></Link><nav className={styles.navigation} aria-label="Administração iMenu">{sections.map(({label,href,icon:Icon})=><Link key={href} href={href} className={styles.navLink} aria-current={(href==="/dev"?path===href:path===href||path.startsWith(href+"/"))?"page":undefined} onClick={()=>setMobile(false)}><Icon size={18} strokeWidth={1.7}/>{label}</Link>)}</nav><div className={styles.account}><p>Administração iMenu</p><button type="button" disabled={busy} onClick={()=>void signOut()}><LogOut size={15}/>{busy?"Saindo…":"Sair da conta"}</button>{error&&<p role="alert">{error}</p>}</div></>;
 return <><aside className={styles.sidebar}>{navigation}</aside><div className={styles.mobileHeader}><Link href="/dev">iMenu</Link><Button id="dev-menu-toggle" variant="secondary" aria-label="Abrir menu" aria-expanded={mobile} onClick={()=>setMobile(true)}><Menu size={18}/></Button></div><Modal open={mobile} onClose={close} height="100dvh" showCloseButton className={styles.mobileSidebar}>{navigation}</Modal></>;
}
