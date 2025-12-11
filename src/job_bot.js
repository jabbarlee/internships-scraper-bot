import { scrapeGitHubInternships } from "./sources/github.js";
import { addToSheet } from "./sheets.js";

async function main() {
  console.log("🤖 Job Bot starting...\n");

  try {
    // Run the GitHub scraper
    console.log("🔍 Scraping internships from GitHub...");
    const jobs = await scrapeGitHubInternships();
    console.log(`📋 Found ${jobs.length} jobs.\n`);

    // Send jobs to the sheet
    console.log("📤 Sending jobs to Google Sheets...");
    const result = await addToSheet(jobs);

    console.log(
      `\n🎉 Success: Added ${result.added} new jobs to the spreadsheet.`
    );

    if (result.duplicates > 0) {
      console.log(`   (${result.duplicates} duplicates were skipped)`);
    }
  } catch (error) {
    console.error("❌ Job Bot failed:", error.message);
    process.exit(1);
  }
}

main();
