"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LifeBuoy, Menu, MessageSquare, Settings, UserRound } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Wordmark } from "./wordmark";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/accounts", label: "Accounts" },
  { href: "/activity", label: "Activity" },
  { href: "/transfers", label: "Transfers" },
  { href: "/documents", label: "Documents" },
  { href: "/goals", label: "Goals" },
  { href: "/messages", label: "Messages" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalHeader({
  viewerName,
  householdName,
  unreadMessages,
  advisorName,
}: {
  viewerName: string;
  householdName: string;
  unreadMessages: number;
  advisorName: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links = (onNavigate?: () => void, vertical = false) =>
    NAV.map((item) => {
      const active = isActive(pathname, item.href);
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            vertical
              ? "flex items-center justify-between rounded-md px-3 py-2.5 text-[14px] font-medium"
              : "relative flex h-full items-center px-3 text-[13.5px] font-medium transition-colors",
            vertical
              ? active
                ? "bg-forest-100 text-forest-900"
                : "text-foreground hover:bg-muted"
              : active
                ? "text-white after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t after:bg-[#d8c393]"
                : "text-[#cfdcd4] hover:text-white",
          )}
        >
          {item.label}
          {item.href === "/messages" && unreadMessages > 0 && (
            <span
              className={cn(
                "ml-1.5 inline-flex min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold leading-[18px]",
                vertical ? "bg-forest-800 text-white" : "bg-[#d8c393] text-forest-950",
              )}
              aria-label={`${unreadMessages} unread`}
            >
              {unreadMessages}
            </span>
          )}
        </Link>
      );
    });

  return (
    <header className="sticky top-0 z-40 bg-forest-900 shadow-[0_1px_0_rgba(0,0,0,0.25)]">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-6 px-4 sm:px-6">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/10 hover:text-white lg:hidden" aria-label="Open menu">
              <Menu className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-cream-50">
            <SheetHeader>
              <SheetTitle className="font-serif text-lg">Edward Jones</SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-3" aria-label="Main">
              {links(() => setOpen(false), true)}
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className="mt-2 rounded-md px-3 py-2.5 text-[14px] font-medium text-foreground hover:bg-muted"
              >
                Profile & settings
              </Link>
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" aria-label="Edward Jones Online Access home" className="shrink-0">
          <Wordmark />
        </Link>

        <nav className="hidden h-full items-stretch lg:flex" aria-label="Main">
          {links()}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 text-left text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#d8c393]"
              >
                <Avatar className="size-8">
                  <AvatarFallback className="bg-[#d8c393] text-[12px] font-semibold text-forest-950">{initials(viewerName)}</AvatarFallback>
                </Avatar>
                <span className="hidden flex-col leading-tight sm:flex">
                  <span className="text-[13px] font-medium">{viewerName}</span>
                  <span className="text-[11px] text-[#cfdcd4]">{householdName}</span>
                </span>
                <ChevronDown className="size-4 text-[#cfdcd4]" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="font-normal">
                <div className="text-[13px] font-medium">{viewerName}</div>
                <div className="text-[12px] text-muted-foreground">{householdName}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserRound /> Profile & contact info
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/profile#preferences">
                  <Settings /> Paperless & alerts
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/messages/new">
                  <MessageSquare /> Message {advisorName.split(" ")[0]}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile#help">
                  <LifeBuoy /> Help & support
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
