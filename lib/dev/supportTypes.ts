export type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";

export type BlastCampaign = {
    id: string;
    sender: "blast" | "support";
    message: string;
    image_path: string | null;
    daily_limit: number | null;
    status: "running" | "paused" | "cancelled" | "completed";
    total: number;
    sent: number;
    failed: number;
    skipped: number;
    pending: number;
    created_at: string;
    completed_at: string | null;
};

export type BlastRecipient = {
    id: number;
    phone: string;
    status: string;
    error: string | null;
    scheduled_at: string;
    sent_at: string | null;
};

export type Connection = {
    session_name: string;
    desired_state: "connected" | "disconnected";
    status: string;
    phone: string | null;
    push_name: string | null;
    qr_code_data: string | null;
    last_connected_at: string | null;
    last_error: string | null;
    bot_enabled: boolean;
};

export type Stats = {
    conversations_today: number;
    ai_replies_today: number;
    human_conversations: number;
    knowledge_entries: number;
};

export type KnowledgeEntry = {
    id: string;
    title: string;
    content: string;
    enabled: boolean;
    updated_at: string;
};

export type Conversation = {
    id: string;
    phone: string | null;
    customer_name: string | null;
    restaurant_id: string | null;
    restaurant_name: string | null;
    mode: "ai" | "human";
    updated_at: string;
    human_started_at?: string | null;
    last_human_reply_at?: string | null;
    last_message: string | null;
};

export type DashboardData = {
    connection: Connection;
    blastConnection: Connection;
    stats: Stats;
    knowledge: KnowledgeEntry[];
    conversations: Conversation[];
    handedOff: Conversation[];
};
