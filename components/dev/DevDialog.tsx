"use client";
import type { ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import styles from "./dashboard.module.css";
export default function DevDialog({open,onClose,title,description,footer,children,wide=false}:{open:boolean;onClose:()=>void;title:string;description?:ReactNode;footer?:ReactNode;children:ReactNode;wide?:boolean}) { return <Modal open={open} onClose={onClose} height="86dvh" showCloseButton className={`${styles.dialog} ${wide ? styles.crmDialog : ""}`} bodyClassName={styles.dialogLayout}><header className={styles.dialogHeader}><h2>{title}</h2>{description&&<p>{description}</p>}</header><div className={styles.dialogBody}>{children}</div>{footer&&<footer className={styles.dialogFooter}>{footer}</footer>}</Modal>; }
