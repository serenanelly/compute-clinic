export function formatDurationSimple(isoDuration) {
  const hours = isoDuration.match(/(\d+)H/)?.[1] || 0;
  const minutes = isoDuration.match(/(\d+)M/)?.[1] || 0;

  return `${hours}:${minutes}`;
}

export function formatDateToTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}



export function formatFullDateTime(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(dateString));
}

export function formatDateOnly(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}


export function formatDateOnlyWithoutWeekDay(dateString) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(dateString));
}


export function combineToISOString(date, time) {
  const combinedDateTime = new Date(`${date}T${time}`);
  combinedDateTime.setHours(combinedDateTime.getHours() + 1);
  return combinedDateTime.toISOString();
}
