"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ToolIcon } from "@/components/tool-icon";
import { CATEGORY_ORDER, TOOLS } from "@/lib/tools-registry";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { openAuthModal } from "@/lib/auth-modal";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isModK) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    function openHandler() {
      setOpen(true);
    }
    document.addEventListener("keydown", handler);
    window.addEventListener("genifysuite:open-command-palette", openHandler);
    return () => {
      document.removeEventListener("keydown", handler);
      window.removeEventListener("genifysuite:open-command-palette", openHandler);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function toggleTheme() {
    setOpen(false);
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    if (isLight) {
      document.documentElement.removeAttribute("data-theme");
      try {
        localStorage.setItem(THEME_STORAGE_KEY, "dark");
      } catch {
        // ignore
      }
    } else {
      document.documentElement.setAttribute("data-theme", "light");
      try {
        localStorage.setItem(THEME_STORAGE_KEY, "light");
      } catch {
        // ignore
      }
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/60 px-4 pt-[12vh] backdrop-blur-md"
      onClick={() => setOpen(false)}
    >
      <Command
        loop
        label="Command palette"
        className="glass w-full max-w-xl overflow-hidden rounded-2xl shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        <Command.Input
          autoFocus
          placeholder="Jump to a tool or action…"
          className="focus-ring w-full border-b border-ink-line bg-transparent px-4 py-3.5 text-sm text-paper placeholder:text-paper-faint"
        />
        <Command.List className="max-h-[60vh] overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-paper-faint">
            No matches.
          </Command.Empty>

          {CATEGORY_ORDER.map((category) => (
            <Command.Group
              key={category}
              heading={category}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-paper-faint"
            >
              {TOOLS.filter((t) => t.category === category).map((tool) => (
                <Command.Item
                  key={tool.slug}
                  value={`${tool.name} ${tool.description}`}
                  onSelect={() => go(`/tools/${tool.slug}`)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
                >
                  <ToolIcon name={tool.icon} className="text-paper-dim" />
                  {tool.name}
                </Command.Item>
              ))}
            </Command.Group>
          ))}

          <Command.Group
            heading="Go to"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-paper-faint"
          >
            <Command.Item
              value="home"
              onSelect={() => go("/")}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
            >
              Home
            </Command.Item>
            <Command.Item
              value="all tools"
              onSelect={() => go("/tools")}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
            >
              All tools
            </Command.Item>
            {status === "authenticated" && (
              <>
                <Command.Item
                  value="dashboard history"
                  onSelect={() => go("/dashboard")}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
                >
                  Dashboard
                </Command.Item>
                <Command.Item
                  value="settings ai keys"
                  onSelect={() => go("/settings/ai")}
                  className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
                >
                  Settings
                </Command.Item>
              </>
            )}
            <Command.Item
              value="toggle theme dark light"
              onSelect={toggleTheme}
              className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
            >
              Toggle theme
            </Command.Item>
            {status === "authenticated" ? (
              <Command.Item
                value="sign out"
                onSelect={() => {
                  setOpen(false);
                  signOut({ callbackUrl: "/" });
                }}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-rust data-[selected=true]:bg-rust/10"
              >
                Sign out
              </Command.Item>
            ) : (
              <Command.Item
                value="sign in"
                onSelect={() => {
                  setOpen(false);
                  openAuthModal({ mode: "login" });
                }}
                className="cursor-pointer rounded-lg px-2.5 py-2 text-sm text-paper data-[selected=true]:bg-brass/10"
              >
                Sign in
              </Command.Item>
            )}
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
