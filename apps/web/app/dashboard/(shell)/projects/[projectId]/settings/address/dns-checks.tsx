import { InfoBox } from "@/components/app/info-box";
import type { HostnameDnsCheck } from "@/lib/domains/diagnostics";

export function DnsChecks({ checks }: { checks: HostnameDnsCheck[] }) {
  const problems = checks.filter(
    (check) => check.wrongCname || check.conflicts.length > 0,
  );
  if (problems.length === 0) return null;

  return (
    <InfoBox variant="warning" className="mt-4">
      <p className="font-semibold">We found other records for this address.</p>
      <ul className="mt-2 grid gap-3">
        {problems.map((check) => (
          <li key={check.hostname}>
            <p className="font-semibold break-all">{check.hostname}</p>
            {check.wrongCname ? (
              <p className="mt-1">
                The connection record points somewhere else. Replace it with the
                value below.
              </p>
            ) : null}
            {check.conflicts.length > 0 ? (
              <p className="mt-1">
                Delete the old address record{check.conflicts.length > 1 ? "s" : ""}{" "}
                ({check.conflicts.join(", ")}) so the connection record can work.
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </InfoBox>
  );
}
