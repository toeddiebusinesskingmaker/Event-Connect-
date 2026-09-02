import fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /  res\.json\(\{\n    eventName: event\.name,\n    eventCode: event\.checkInCode,\n    activeCheckIns,\n    totalAttendance,\n    totalPhotos,\n    flaggedPhotos,\n    eventConnections,\n    interestTags: sortedTags,\n    attendees: attendeesData\n  \}\);\n\}\);/g;

const newCode = `  const timelineMap = new Map<string, number>();
  checkins.sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime())
    .forEach(c => {
      const d = new Date(c.checkedInAt);
      const minutes = Math.floor(d.getMinutes() / 15) * 15;
      d.setMinutes(minutes, 0, 0);
      const timeLabel = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      timelineMap.set(timeLabel, (timelineMap.get(timeLabel) || 0) + 1);
    });

  const timelineData: { time: string; count: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (const [time, count] of timelineMap.entries()) {
    cumulative += count;
    timelineData.push({ time, count, cumulative });
  }

  res.json({
    eventName: event.name,
    eventCode: event.checkInCode,
    activeCheckIns,
    totalAttendance,
    totalPhotos,
    flaggedPhotos,
    eventConnections,
    interestTags: sortedTags,
    attendees: attendeesData,
    checkInTimeline: timelineData
  });
});`;

code = code.replace(regex, newCode);
fs.writeFileSync('server.ts', code);
console.log('server.ts updated');
