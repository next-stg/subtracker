"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Inbox, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { SiteNotification } from "@/lib/types";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<SiteNotification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    async function loadNotifications() {
      try {
        const data = await api.getNotifications();
        if (active) setNotifications(data);
      } catch {
        if (active) setNotifications([]);
      }
    }
    void loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    window.addEventListener("focus", loadNotifications);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadNotifications);
    };
  }, []);

  async function markAsRead(id: string) {
    setNotifications((items) => items.map((item) => item.id === id ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item));
    try {
      await api.updateNotification(id, "read");
    } catch {
      setNotifications(await api.getNotifications().catch(() => []));
    }
  }

  async function dismiss(id: string) {
    setNotifications((items) => items.filter((item) => item.id !== id));
    try {
      await api.updateNotification(id, "dismiss");
    } catch {
      setNotifications(await api.getNotifications().catch(() => []));
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read_at && !notification.dismissed_at).length;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-2 shadow-lg" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold">Notifications</p>
            <span className="text-xs text-muted-foreground">
              {unreadCount} non lue{unreadCount !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.filter((notification) => !notification.dismissed_at).length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
                <Inbox className="size-6" />
                Aucune notification
              </div>
            ) : (
              notifications.filter((notification) => !notification.dismissed_at).map((notification) => (
                <div key={notification.id} className="flex items-center gap-1 rounded-lg hover:bg-accent">
                  <Link
                    href="/subscriptions"
                    onClick={() => {
                      void markAsRead(notification.id);
                      setOpen(false);
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2 text-sm"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${notification.read_at ? "bg-transparent" : "bg-primary"}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{notification.subscription_name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {notification.days_until === 0
                          ? "Renouvellement aujourd'hui"
                          : notification.days_until === 1
                          ? "Renouvellement demain"
                          : notification.days_until > 1
                          ? `Renouvellement dans ${notification.days_until} jours`
                          : `Échéance passée le ${new Date(`${notification.billing_date}T12:00:00`).toLocaleDateString("fr-FR")}`}
                      </span>
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mr-1 size-7"
                    onClick={() => void dismiss(notification.id)}
                    aria-label={`Masquer la notification de ${notification.subscription_name}`}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
