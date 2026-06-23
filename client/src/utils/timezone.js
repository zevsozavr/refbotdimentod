const KYIV_OFFSET = '+03:00';

export const toLocalDatetime = (isoString) => {
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${mins}`;
};

export const withTimezone = (localDatetime) => {
  if (!localDatetime) return localDatetime;
  return localDatetime + KYIV_OFFSET;
};
