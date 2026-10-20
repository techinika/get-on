"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";

/** Shows a friendly toast when the browser goes offline (spec §9). */
export function OfflineListener() {
  const { toast } = useToast();

  React.useEffect(() => {
    function onOffline() {
      toast(
        "You seem to be offline. We will keep your changes and save them when you are back.",
        "info",
      );
    }
    window.addEventListener("offline", onOffline);
    return () => window.removeEventListener("offline", onOffline);
  }, [toast]);

  return null;
}
