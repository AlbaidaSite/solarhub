import { eventTypeClasses } from "@/lib/eventTypeClasses";
import type { EventOccurrence } from "@/types/events";

interface BirthdayPillsProps {
  birthdays: EventOccurrence[];
}

// Pastillas de cumpleaños, banda superior. No son interactivas: son <div>,
// no <button>, y no llevan tabindex — un cumpleaños nunca abre modal de
// detalle. El recorte de texto (overflow/ellipsis) es visual; el nombre
// completo sigue en el DOM y `title` da el tooltip de ratón.
export default function BirthdayPills({ birthdays }: BirthdayPillsProps) {
  if (birthdays.length === 0) return null;

  return (
    <div className="ev-pills absolute top-1.5 left-0 right-0">
      {birthdays.map((birthday) => {
        const classes = eventTypeClasses(birthday.eventType.color);
        return (
          <div
            key={birthday.id}
            title={birthday.title}
            className={`ev-pill overflow-hidden text-ellipsis whitespace-nowrap rounded-full px-2 py-0.5 text-center text-[10px] font-medium text-black/80 ${classes.pill}`}
          >
            {birthday.title}
          </div>
        );
      })}
    </div>
  );
}
