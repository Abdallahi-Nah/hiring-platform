import { getI18n } from "@/i18n/server";
import { DatePicker } from "./DatePicker";

// Deux calendriers "du / au" pour LiveSearch (noms : from, to).
export async function DateRange({ from, to }: { from: string; to: string }) {
  const { t } = await getI18n();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DatePicker name="from" label={t("common.dateFrom")} defaultValue={from} />
      <DatePicker name="to" label={t("common.dateTo")} defaultValue={to} />
    </div>
  );
}
