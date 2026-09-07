import "../env.js";
import { foldDayIntoBaseline } from "../services/store.js";
import { generateMockDay } from "../mockData.js";

async function main() {
  const days = 14;
  console.log(`Seeding ${days} days of mock household activity into the baseline...`);
  for (let i = days; i >= 1; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dayEvents = generateMockDay(date);
    await foldDayIntoBaseline(dayEvents);
  }
  console.log("Done. check_household_activity_pattern now has a baseline to compare against.");
  console.log("Run the MCP server and try: \"has it been quieter than usual this morning?\"");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
