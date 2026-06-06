
const dateStr = '2026-06-06';
const targetDate = new Date(dateStr);
console.log('Date string:', dateStr);
console.log('Parsed date (ISO):', targetDate.toISOString());
console.log('getUTCDay():', targetDate.getUTCDay());

const targetDateUTC = new Date(`${dateStr}T00:00:00.000Z`);
console.log('Forced UTC Parsed date (ISO):', targetDateUTC.toISOString());
console.log('getUTCDay() for forced UTC:', targetDateUTC.getUTCDay());

const daysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
console.log('Day of week (targetDate):', daysMap[targetDate.getUTCDay()]);
console.log('Day of week (targetDateUTC):', daysMap[targetDateUTC.getUTCDay()]);
