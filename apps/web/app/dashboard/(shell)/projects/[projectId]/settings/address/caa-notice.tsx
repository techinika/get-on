import { CopyValue } from "@/components/app/copy-value";
import { InfoBox } from "@/components/app/info-box";
import type { DnsRecord } from "@/lib/domains/types";

export function CaaNotice({
  records,
  registrable,
}: {
  records: DnsRecord[];
  registrable: string;
}) {
  if (records.length === 0) return null;
  return (
    <InfoBox variant="warning" className="mt-4">
      <p className="font-semibold">
        Your domain only lets some companies issue padlocks.
      </p>
      <p className="mt-1">
        Add these records so yours can be issued. Keep any other CAA records you
        still need.
      </p>
      <ul className="mt-3 grid gap-3">
        {records.map((record) => (
          <li key={`${record.name}-${record.value}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-text-muted">
              CAA · {record.name === "@" ? registrable : `${record.name}.${registrable}`}
            </p>
            <CopyValue value={record.value} label="CAA value" />
          </li>
        ))}
      </ul>
    </InfoBox>
  );
}
