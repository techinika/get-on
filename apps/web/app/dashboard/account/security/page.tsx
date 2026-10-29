"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { maskEmail } from "@/lib/security/otp";
import { Button } from "@/components/ui/button";

export default function SecurityPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = React.useState("");

  useEffect(() => {
    const params = useSearchParams();
    setEmail(params.get("email") || "");
  }, [searchParams]);

  return (
    <div className="space-y-4">
      <h1>Security</h1>
      <p>We email a code to {maskEmail(email)} each time you sign in.</p>
      <p>Policy: recommended</p>
      <p>No active sessions</p>
    </div>
  );
}