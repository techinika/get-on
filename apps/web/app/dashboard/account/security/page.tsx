"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SecurityPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");

  // Initialize email from URL params once on mount
  useEffect(() => {
    const emailFromParam = searchParams.get("email") || "";
    setEmail(emailFromParam);
  }, []);

  return (
    <div className="space-y-4">
      <h1>Security</h1>
      <p>We email a code to {email} each time you sign in.</p>
      <p>Policy: recommended</p>
      <p>No active sessions</p>
    </div>
  );
}