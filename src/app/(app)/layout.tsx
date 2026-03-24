import { AppNav } from "@/components/AppNav";
import { ScheduleReminderRunner } from "@/components/ScheduleReminderRunner";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AppNav />
      <ScheduleReminderRunner />
    </>
  );
}
