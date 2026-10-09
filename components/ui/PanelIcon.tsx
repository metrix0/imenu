"use client";

import {
    FontAwesomeIcon,
    type FontAwesomeIconProps,
} from "@fortawesome/react-fontawesome";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
    ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Armchair, Banknote,
    Bell, BellOff, Bike, Trash2, CalendarDays, Camera, ChartNoAxesCombined,
    Check, Circle, CircleCheck, CircleHelp, Clock, CloudDownload, Copy,
    CreditCard, Crosshair, DollarSign, DoorOpen, Download, ExternalLink,
    Eye, Gift, Globe, GripHorizontal, GripVertical, House, Image,
    Info, Crown, Layers, Link, LoaderCircle, Lock, LogOut, Mail, MapPin, Menu,
    MessageCircle, Minus, Package, PackageOpen, Palette, Pencil,
    Percent, Phone, Plus, Power, Printer, Puzzle, QrCode, Receipt,
    RotateCcw, RotateCw, Rocket, Route, Search, Send, Settings, Share2,
    ShoppingBag, Smartphone, Sparkles, Square, SquareCheck, Star,
    Store, Target, TriangleAlert, TrendingUp, Truck, User, Users, Utensils,
    Volume2, ZoomIn, ZoomOut, ChevronDown, ChevronLeft, ChevronRight,
    ChevronUp, X, Bot, ConciergeBell, createLucideIcon, type LucideIcon,
} from "lucide-react";
import { usePanelAppearance } from "./PanelAppearance";

const MotorRacingHelmet = createLucideIcon("MotorRacingHelmet", [
    ["path", { d: "M22 12.2a10 10 0 1 0-19.4 3.2c.2.5.8 1.1 1.3 1.3l13.2 5.1c.5.2 1.2 0 1.6-.3l2.6-2.6c.4-.4.7-1.2.7-1.7Z", key: "helmet-shell" }],
    ["path", { d: "m21.8 18-10.5-4a2 2.06 0 0 1 .7-4h9.8", key: "helmet-visor" }],
]);

export const faMotorRacingHelmet = {
    prefix: "fas",
    iconName: "motor-racing-helmet",
    icon: [24, 24, [], "e000", ""],
} as IconDefinition;

// Keep existing icon definitions and call sites; only the panel's visual glyph changes.
const panelIcons: Record<string, LucideIcon> = {
    "arrow-down": ArrowDown, "arrow-left": ArrowLeft, "arrow-right": ArrowRight,
    "arrow-up": ArrowUp, "arrow-trend-up": TrendingUp, "arrow-rotate-left": RotateCcw, "rotate-left": RotateCcw,
    "bag-shopping": ShoppingBag, bars: Menu, bell: Bell, "bell-slash": BellOff,
    "bell-concierge": ConciergeBell, box: Package, "box-open": PackageOpen,
    bullseye: Target, "calendar-days": CalendarDays, camera: Camera, chair: Armchair,
    "chart-line": ChartNoAxesCombined, check: Check, "circle-check": CircleCheck,
    "square-check": SquareCheck, "chevron-down": ChevronDown,
    "chevron-left": ChevronLeft, "chevron-right": ChevronRight, "chevron-up": ChevronUp,
    "circle-info": Info, "circle-question": CircleHelp, clock: Clock,
    "cloud-arrow-down": CloudDownload, copy: Copy, "credit-card": CreditCard,
    "dollar-sign": DollarSign, "door-open": DoorOpen, download: Download,
    "pen-to-square": Pencil, envelope: Mail, "triangle-exclamation": TriangleAlert,
    "up-right-from-square": ExternalLink, eye: Eye, gear: Settings, gift: Gift,
    globe: Globe, "grip-lines": GripHorizontal, "grip-vertical": GripVertical,
    house: House, image: Image, crown: Crown, "layer-group": Layers, link: Link,
    "location-crosshairs": Crosshair, "location-dot": MapPin, lock: Lock,
    "magnifying-glass": Search, minus: Minus, "mobile-screen-button": Smartphone,
    "money-bill": Banknote, "money-bill-wave": Banknote, motorcycle: Bike,
    "motor-racing-helmet": MotorRacingHelmet,
    palette: Palette, "paper-plane": Send, pen: Pencil, percent: Percent,
    "person-biking": Bike, phone: Phone, plus: Plus, "power-off": Power,
    print: Printer, "puzzle-piece": Puzzle, qrcode: QrCode, receipt: Receipt,
    robot: Bot, rocket: Rocket, rotate: RotateCw, route: Route, "magnifying-glass-minus": ZoomOut,
    "magnifying-glass-plus": ZoomIn, "share-nodes": Share2,
    "right-from-bracket": LogOut, spinner: LoaderCircle, square: Square, star: Star,
    store: Store, trash: Trash2, "trash-can": Trash2, truck: Truck, user: User, users: Users,
    utensils: Utensils, "volume-high": Volume2, "wand-magic-sparkles": Sparkles,
    xmark: X, circle: Circle, comment: MessageCircle, "clock-rotate-left": RotateCcw,
};

export function PanelIcon(props: FontAwesomeIconProps) {
    const panel = usePanelAppearance();
    const { icon, className = "", size, spin, pulse, title, style, ...rest } = props;
    const name = typeof icon === "object" && "iconName" in icon ? icon.iconName : null;
    const prefix = typeof icon === "object" && "prefix" in icon ? icon.prefix : null;
    const Icon = name ? panelIcons[name] : undefined;

    const isCustomPanelIcon = name === "motor-racing-helmet";
    if ((!panel && !isCustomPanelIcon) || prefix === "fab" || !Icon || props.mask || props.transform || props.symbol) return <FontAwesomeIcon {...props} />;

    const { mask: _mask, transform: _transform, symbol: _symbol, ...svgProps } = rest;

    return (
        <Icon
            {...svgProps}
            className={`panel-icon ${spin || pulse ? "animate-spin" : ""} ${className}`}
            size="1em"
            strokeWidth={1.75}
            style={{ ...(size === "2x" ? { fontSize: "2em" } : {}), ...style }}
            aria-hidden={title || props["aria-label"] ? undefined : true}
            aria-label={props["aria-label"] || title}
            role={title || props["aria-label"] ? "img" : undefined}
        />
    );
}
