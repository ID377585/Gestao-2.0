"use client";

import { useEffect, useState } from "react";

import { UserMusicPlayer } from "@/components/layout/UserMusicPlayer";

const OPEN_MUSIC_PLAYER_EVENT = "gestify:music-player:open";

export function openUserMusicPlayer() {
  window.dispatchEvent(new Event(OPEN_MUSIC_PLAYER_EVENT));
}

export function MusicPlayerHost() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => {
      setMounted(true);
      setOpen(false);
    };

    window.addEventListener(OPEN_MUSIC_PLAYER_EVENT, handleOpen);

    return () => {
      window.removeEventListener(OPEN_MUSIC_PLAYER_EVENT, handleOpen);
    };
  }, []);

  if (!mounted) return null;

  return <UserMusicPlayer open={open} onOpenChange={setOpen} />;
}
