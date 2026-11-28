"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import { PageLoader } from "@/components/ui/Loader";
import { devJson } from "@/lib/dev/client";
import { formatPhone } from "@/lib/dev/supportView";
import DevDialog from "./DevDialog";

type Blacklist = { contacts: { phone: string; created_at: string }[] };

export default function SupportBlacklistDialog({ onClose }: { onClose: () => void }) {
    const [data, setData] = useState<Blacklist | null>(null);
    const [phone, setPhone] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        devJson<Blacklist>("/api/dev/support?section=blacklist")
            .then(value => { if (active) setData(value); })
            .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar a blacklist."); });
        return () => { active = false; };
    }, []);

    async function update(action: "add_blacklist" | "remove_blacklist", value: string) {
        if (busy) return;
        setBusy(true);
        setError("");
        try {
            setData(await devJson<Blacklist>("/api/dev/support", {
                method: "POST",
                body: JSON.stringify({ action, phone: value }),
            }));
            if (action === "add_blacklist") setPhone("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível atualizar a blacklist.");
        } finally {
            setBusy(false);
        }
    }

    return <DevDialog title="Blacklist" open onClose={() => { if (!busy) onClose(); }}>
        <div className="space-y-4 p-5 sm:p-6">
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {!data ? (!error && <PageLoader />) : <>
                <form className="flex items-end gap-2" onSubmit={event => { event.preventDefault(); void update("add_blacklist", phone); }}>
                    <div className="min-w-0 flex-1">
                        <label htmlFor="blacklist-phone" className="mb-2 block text-sm font-medium">Número de WhatsApp</label>
                        <Input id="blacklist-phone" type="tel" placeholder="(11) 99999-9999" value={phone} onChange={event => setPhone(event.target.value)} disabled={busy} />
                    </div>
                    <Button type="submit" disabled={!phone.trim() || busy}>Bloquear</Button>
                </form>
                <DataTable rows={data.contacts} rowKey={contact => contact.phone} emptyMessage="Nenhum contato na blacklist." columns={[
                    { key: "phone", label: "WhatsApp", render: contact => formatPhone(contact.phone) },
                    { key: "actions", label: "", render: contact => <div className="flex justify-end"><Button variant="secondary" disabled={busy} onClick={() => void update("remove_blacklist", contact.phone)}>Desbloquear</Button></div> },
                ]} />
            </>}
        </div>
    </DevDialog>;
}
