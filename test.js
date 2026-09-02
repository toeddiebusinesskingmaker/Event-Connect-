const checkins = [
  { checkedInAt: '2026-08-10T15:16:30.000Z' },
  { checkedInAt: '2026-08-10T15:20:30.000Z' },
  { checkedInAt: '2026-08-10T16:16:30.000Z' },
];

const timeline = checkins.map(c => c.checkedInAt).sort();
console.log(timeline);
