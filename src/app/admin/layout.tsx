import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
    title: "BitTask Admin",
    description: "Super Admin Panel — BitTask SaaS",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return children;
}
