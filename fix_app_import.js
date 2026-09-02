import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const importRegex = /import \{ motion, AnimatePresence \} from 'motion\/react';/;
const newImport = `import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';`;

if (!code.includes('recharts')) {
  code = code.replace(importRegex, newImport);
  fs.writeFileSync('src/App.tsx', code);
  console.log('src/App.tsx imports updated');
} else {
  console.log('recharts already imported');
}
