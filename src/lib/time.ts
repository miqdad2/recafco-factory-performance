/** Single place for Asia/Kuwait date formatting. All display times use this zone. */
export const KUWAIT_TIME_ZONE = 'Asia/Kuwait';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: KUWAIT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

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

/** "14:05" */
export const formatKuwaitTime = (value: DateInput) => timeFormat.format(toDate(value));
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
