const fs = require('fs');

function swapSections(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  const topTagsRegex = /( {2,4}csvContent \+= '--- TOP ATTENDEE INTEREST TAGS ---\\n';\n(?: {2,4}.*\n)+? {2,4}csvContent \+= '\\n';\n\n)/;
  const liveStatsRegex = /( {2,4}csvContent \+= '--- LIVE STATS SUMMARY ---\\n';\n(?: {2,4}csvContent \+= `.*\n){5}\n)/;

  const topTagsMatch = content.match(topTagsRegex);
  const liveStatsMatch = content.match(liveStatsRegex);

  if (topTagsMatch && liveStatsMatch) {
    const topTagsCode = topTagsMatch[1];
    const liveStatsCode = liveStatsMatch[1];

    content = content.replace(topTagsCode, '');
    content = content.replace(liveStatsCode, '');

    const generatedAtRegex = /( {2,4}csvContent \+= `Generated At:.*\n\n)/;
    const privacyRegex = /( {2,4}csvContent \+= 'Event Connect GDPR & Privacy compliant recap\.\\n';)/;

    content = content.replace(generatedAtRegex, `$1${liveStatsCode}`);
    content = content.replace(privacyRegex, `${topTagsCode}$1`);

    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`Could not find sections in ${filePath}`);
  }
}

swapSections('src/App.tsx');
swapSections('server.ts');
