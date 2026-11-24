import { faFileInvoice } from "@fortawesome/free-solid-svg-icons";
import { createLucideIcon } from "lucide-react";

const [width, height, , , data] = faFileInvoice.icon;
const scale = 24 / Math.max(width, height);
const x = (24 - width * scale) / 2;
const y = (24 - height * scale) / 2;

// Preserve the existing fiscal invoice glyph while accepting Lucide sizing props.
export const NfceIcon = createLucideIcon("NfceIcon", (Array.isArray(data) ? data : [data]).map((d, index) => [
    "path",
    { d, key: String(index), transform: `translate(${x} ${y}) scale(${scale})`, fill: "currentColor", stroke: "none" },
]));
