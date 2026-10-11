/** Single place for Asia/Kuwait date formatting. All display times use this zone. */
import { toKuwaitCivil } from './dashboard/periods';

export const KUWAIT_TIME_ZONE = 'Asia/Kuwait';

const longDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: KUWAIT_TIME_ZONE,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const shortDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: KUWAIT_TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const monthFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: KUWAIT_TIME_ZONE,
  month: 'long',
  year: 'numeric',
});

const weekdayDayFormat = new Intl.DateTimeFormat('en-GB', { timeZone: KUWAIT_TIME_ZONE, weekday: 'short', day: 'numeric' });
const dayMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: KUWAIT_TIME_ZONE, weekday: 'short', day: 'numeric', month: 'short' });
const dayOfMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: KUWAIT_TIME_ZONE, day: 'numeric' });
const shortMonthFormat = new Intl.DateTimeFormat('en-GB', { timeZone: KUWAIT_TIME_ZONE, month: 'short' });
const yearFormat = new Intl.DateTimeFormat('en-GB', { timeZone: KUWAIT_TIME_ZONE, year: 'numeric' });

type DateInput = Date | string;
const toDate = (value: DateInput) => (typeof value === 'string' ? new Date(value) : value);

/** 12-hour clock parts in Kuwait time: 0 → 12 AM, 12 → 12 PM. */
function kuwaitHour12(value: DateInput) {
  const { hour, minute } = toKuwaitCivil(toDate(value).getTime());
  return { hour12: hour % 12 === 0 ? 12 : hour % 12, minute, meridiem: hour < 12 ? 'AM' : 'PM' };
}

/**
 * "1:05 PM", "12:00 AM" (midnight), "12:00 PM" (noon). Built from Kuwait civil time
 * rather than locale output, so the format is identical on every browser.
 */
export const formatKuwaitTime = (value: DateInput) => {
  const { hour12, minute, meridiem } = kuwaitHour12(value);
  return `${hour12}:${String(minute).padStart(2, '0')} ${meridiem}`;
};
/** "6 AM" — hour only, for chart axes. */
export const formatKuwaitHour = (value: DateInput) => {
  const { hour12, meridiem } = kuwaitHour12(value);
  return `${hour12} ${meridiem}`;
};
/** "Sunday 11 October 2026" */
export const formatKuwaitLongDate = (value: DateInput) =>
  longDateFormat.format(toDate(value)).replace(',', '');
/** "Sun 11 Oct 2026" */
export const formatKuwaitShortDate = (value: DateInput) =>
  shortDateFormat.format(toDate(value)).replace(',', '');
/** "Sun 11" */
export const formatKuwaitWeekdayDay = (value: DateInput) => weekdayDayFormat.format(toDate(value));
/** "Sun 11 Oct" */
export const formatKuwaitDayMonth = (value: DateInput) => dayMonthFormat.format(toDate(value)).replace(',', '');
/** "11" */
export const formatKuwaitDayOfMonth = (value: DateInput) => dayOfMonthFormat.format(toDate(value));
/** "Oct" */
export const formatKuwaitShortMonth = (value: DateInput) => shortMonthFormat.format(toDate(value));
/** "October 2026" */
export const formatKuwaitMonthYear = (value: DateInput) => monthFormat.format(toDate(value));
/** "2026" */
export const formatKuwaitYear = (value: DateInput) => yearFormat.format(toDate(value));

/** "October 2026" from "2026-10" (mid-month avoids any zone edge). */
export const formatMonth = (yyyyMm: string) =>
  monthFormat.format(new Date(`${yyyyMm}-15T12:00:00+03:00`));
