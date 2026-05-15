"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { GestifyMark } from "@/components/brand/GestifyMark";
import { TenantSummary } from "@/components/tenant/TenantSummary";
import {
  menuSections,
  type MenuSectionConfig,
  type MenuSectionKey,
  type MenuSubItem,
} from "@/components/layout/menu-items";

interface SidebarProps {
  className?: string;
  modulePermissions?: Partial<Record<MenuSectionKey, boolean>>;
}

const SUBMENU_VIEWPORT_MARGIN = 16;
const SUBMENU_BRIDGE_HEIGHT = 56;

export function Sidebar({ className, modulePermissions }: SidebarProps) {
  const pathname = usePathname();

  const allowedMenuSections = useMemo(() => {
    if (!modulePermissions) return menuSections;
    return menuSections.filter((section) => modulePermissions[section.key]);
  }, [modulePermissions]);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopHovered, setDesktopHovered] = useState(false);
  const [previewSectionKey, setPreviewSectionKey] =
    useState<MenuSectionKey | null>(null);
  const [mobileExpandedSection, setMobileExpandedSection] =
    useState<MenuSectionKey | null>(null);
  const [submenuTop, setSubmenuTop] = useState(0);
  const [submenuMaxHeight, setSubmenuMaxHeight] = useState<number | null>(null);

  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const desktopContainerRef = useRef<HTMLDivElement | null>(null);
  const submenuPanelRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<
    Partial<Record<MenuSectionKey, HTMLDivElement | null>>
  >({});

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  const currentSectionKey = useMemo(() => {
    return (
      allowedMenuSections.find((section) =>
        section.items.some((item) => isActive(item.href))
      )?.key ?? allowedMenuSections[0]?.key ?? null
    );
  }, [pathname, allowedMenuSections]);

  const displayedSectionKey = previewSectionKey ?? currentSectionKey;
  const displayedSection = useMemo(
    () =>
      allowedMenuSections.find((section) => section.key === displayedSectionKey) ??
      null,
    [displayedSectionKey, allowedMenuSections]
  );

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();

    closeTimerRef.current = setTimeout(() => {
      setDesktopHovered(false);
      setPreviewSectionKey(null);
    }, 140);
  };

  const updateSubmenuPosition = (sectionKey: MenuSectionKey) => {
    const container = desktopContainerRef.current;
    const sectionElement = sectionRefs.current[sectionKey];
    const submenuElement = submenuPanelRef.current;

    if (!container || !sectionElement) return;

    const containerRect = container.getBoundingClientRect();
    const sectionRect = sectionElement.getBoundingClientRect();

    const viewportTop = SUBMENU_VIEWPORT_MARGIN;
    const viewportBottom = window.innerHeight - SUBMENU_VIEWPORT_MARGIN;
    const availableHeight = Math.max(160, viewportBottom - viewportTop);

    const naturalTop = sectionRect.top - containerRect.top;
    const submenuHeight =
      submenuElement?.getBoundingClientRect().height ?? availableHeight;

    let adjustedTop = naturalTop;

    const submenuViewportTop = containerRect.top + adjustedTop;
    const submenuViewportBottom = submenuViewportTop + submenuHeight;

    if (submenuViewportBottom > viewportBottom) {
      adjustedTop -= submenuViewportBottom - viewportBottom;
    }

    const adjustedViewportTop = containerRect.top + adjustedTop;

    if (adjustedViewportTop < viewportTop) {
      adjustedTop += viewportTop - adjustedViewportTop;
    }

    setSubmenuTop(Math.max(0, adjustedTop));
    setSubmenuMaxHeight(availableHeight);
  };

  const openDesktopMenu = () => {
    if (allowedMenuSections.length === 0) return;

    clearCloseTimer();
    setDesktopHovered(true);

    const nextSectionKey = currentSectionKey ?? allowedMenuSections[0]?.key ?? null;
    setPreviewSectionKey(nextSectionKey);

    if (nextSectionKey) {
      requestAnimationFrame(() => {
        updateSubmenuPosition(nextSectionKey);
      });
    }
  };

  const keepDesktopMenuOpen = () => {
    clearCloseTimer();
    setDesktopHovered(true);
  };

  const handleSectionEnter = (sectionKey: MenuSectionKey) => {
    clearCloseTimer();
    setDesktopHovered(true);
    setPreviewSectionKey(sectionKey);

    requestAnimationFrame(() => {
      updateSubmenuPosition(sectionKey);
    });
  };

  const handleDesktopNavigate = () => {
    clearCloseTimer();
    setDesktopHovered(false);
    setPreviewSectionKey(null);
  };

  const handleMobileSectionToggle = (sectionKey: MenuSectionKey) => {
    setMobileExpandedSection((current) =>
      current === sectionKey ? null : sectionKey
    );
  };

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidebar-w", desktopHovered ? "15rem" : "5rem");
  }, [desktopHovered]);

  useEffect(() => {
    setMobileOpen(false);
    setDesktopHovered(false);
    setPreviewSectionKey(null);
    setMobileExpandedSection(currentSectionKey);
    clearCloseTimer();
  }, [pathname, currentSectionKey]);

  useEffect(() => {
    if (mobileOpen && currentSectionKey) {
      setMobileExpandedSection(currentSectionKey);
    }
  }, [mobileOpen, currentSectionKey]);

  useEffect(() => {
    if (desktopHovered && displayedSectionKey) {
      requestAnimationFrame(() => {
        updateSubmenuPosition(displayedSectionKey);
      });
    }
  }, [desktopHovered, displayedSectionKey]);

  useEffect(() => {
    const handleResize = () => {
      if (desktopHovered && displayedSectionKey) {
        updateSubmenuPosition(displayedSectionKey);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [desktopHovered, displayedSectionKey]);

  useEffect(() => {
    return () => {
      clearCloseTimer();
    };
  }, []);

  function renderSubItem(
    item: MenuSubItem,
    variant: "desktop" | "mobile",
    index = 0
  ) {
    const active = isActive(item.href);
    const Icon = item.icon;

    return (
      <div
        key={item.href}
        className={cn(
          "transition-all duration-200 ease-out",
          variant === "desktop" && desktopHovered
            ? "translate-x-0 opacity-100"
            : "translate-x-0 opacity-100"
        )}
        style={
          variant === "desktop"
            ? { transitionDelay: `${index * 35}ms` }
            : undefined
        }
      >
        <Link
          href={item.href}
          onClick={() => {
            if (variant === "mobile") {
              setMobileOpen(false);
              return;
            }

            handleDesktopNavigate();
          }}
        >
          <Button
            variant="ghost"
            className={cn(
              "h-12 w-full justify-start gap-3 rounded-xl border px-4 transition-all duration-200",
              active
                ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-800"
                : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </Button>
        </Link>
      </div>
    );
  }

  function renderSectionButton(
    section: MenuSectionConfig,
    variant: "desktop" | "mobile"
  ) {
    const Icon = section.icon;
    const hasActiveChild = section.items.some((item) => isActive(item.href));
    const isDesktop = variant === "desktop";
    const isPreviewed = displayedSectionKey === section.key;
    const isMobileExpanded = mobileExpandedSection === section.key;

    return (
      <button
        type="button"
        onClick={() => {
          if (!isDesktop) {
            handleMobileSectionToggle(section.key);
          }
        }}
        className={cn(
          "group flex h-12 w-full items-center rounded-xl border transition-all duration-200",
          isDesktop
            ? desktopHovered
              ? "justify-start gap-3 px-4"
              : "justify-center px-3"
            : "justify-between px-4",
          hasActiveChild || isPreviewed || isMobileExpanded
            ? "border-blue-200 bg-blue-50 text-blue-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            : "border-transparent text-gray-700 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100"
        )}
        aria-label={section.label}
        aria-expanded={!isDesktop ? isMobileExpanded : undefined}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            isDesktop
              ? desktopHovered
                ? "gap-3"
                : "justify-center"
              : "gap-3"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />

          <span
            className={cn(
              "overflow-hidden whitespace-nowrap text-sm font-medium transition-all duration-200 ease-out",
              isDesktop
                ? desktopHovered
                  ? "max-w-[160px] translate-x-0 opacity-100"
                  : "max-w-0 -translate-x-1 opacity-0"
                : "max-w-[200px] translate-x-0 opacity-100"
            )}
          >
            {section.label}
          </span>
        </div>

        {!isDesktop && (
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 transition-transform duration-200",
              isMobileExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        )}
      </button>
    );
  }

  function SidebarContent({ variant }: { variant: "desktop" | "mobile" }) {
    const isDesktop = variant === "desktop";

    return (
      <div
        className={cn(
          "flex h-full flex-col bg-white text-gray-900 dark:bg-slate-950 dark:text-slate-100",
          isDesktop
            ? "min-h-screen w-[var(--sidebar-w)] border-r border-gray-200 transition-[width] duration-200 ease-out dark:border-slate-800"
            : "h-[100dvh] w-full"
        )}
      >
        <div
          className={cn(
            "flex h-16 shrink-0 items-center border-b border-gray-200 px-4 dark:border-slate-800",
            isDesktop
              ? desktopHovered
                ? "justify-start"
                : "justify-center"
              : "justify-start"
          )}
        >
          <div
            className={cn(
              "flex min-w-0 items-center transition-all duration-200",
              isDesktop && !desktopHovered ? "justify-center" : ""
            )}
          >
            <GestifyMark size={40} compact={isDesktop && !desktopHovered} />
          </div>
        </div>

        {!isDesktop && (
          <div className="border-b border-gray-200 px-4 py-3 dark:border-slate-800">
            <TenantSummary compact />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 [webkit-overflow-scrolling:touch]">
          <div className="space-y-3">
            {allowedMenuSections.map((section, index) => {
              const isMobileExpanded = mobileExpandedSection === section.key;

              return (
                <div
                  key={section.key}
                  ref={(element) => {
                    sectionRefs.current[section.key] = element;
                  }}
                  className="space-y-2"
                  onMouseEnter={() => {
                    if (isDesktop) handleSectionEnter(section.key);
                  }}
                  onFocusCapture={() => {
                    if (isDesktop) handleSectionEnter(section.key);
                  }}
                >
                  {renderSectionButton(section, variant)}

                  {!isDesktop && isMobileExpanded && (
                    <div className="space-y-2 pl-3">
                      {section.items.map((item, itemIndex) =>
                        renderSubItem(item, "mobile", itemIndex)
                      )}
                    </div>
                  )}

                  {index < allowedMenuSections.length - 1 && (
                    <div className="pt-2">
                      <Separator className="bg-gray-200 dark:bg-slate-800" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </div>
    );
  }

  return (
    <>
      <div className="md:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent
            side="left"
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="w-[300px] border-r border-gray-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950"
          >
            <SidebarContent variant="mobile" />
          </SheetContent>
        </Sheet>
      </div>

      <div
        ref={desktopContainerRef}
        className={cn("relative hidden md:block", className)}
        onMouseEnter={openDesktopMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="relative z-20">
          <SidebarContent variant="desktop" />
        </div>

        {desktopHovered && displayedSection && (
          <>
            <div
              className="absolute z-20"
              style={{
                top: `${submenuTop}px`,
                left: "calc(var(--sidebar-w) - 0.25rem)",
                width: "1.25rem",
                height: `${SUBMENU_BRIDGE_HEIGHT}px`,
              }}
              onMouseEnter={keepDesktopMenuOpen}
              onMouseLeave={scheduleClose}
            />

            <div
              className="absolute z-30"
              style={{
                top: `${submenuTop}px`,
                left: "calc(var(--sidebar-w) - 0.35rem)",
              }}
              onMouseEnter={keepDesktopMenuOpen}
              onMouseLeave={scheduleClose}
            >
              <div
                ref={submenuPanelRef}
                className="ml-2 w-80 overflow-y-auto rounded-2xl border border-gray-200 bg-white p-3 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
                style={{
                  maxHeight: submenuMaxHeight
                    ? `${submenuMaxHeight}px`
                    : undefined,
                }}
              >
                <div className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
                  {displayedSection.label}
                </div>

                <div className="space-y-2">
                  {displayedSection.items.map((item, index) =>
                    renderSubItem(item, "desktop", index)
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
