import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load service account credentials
const serviceAccountPath = join(__dirname, "..", "service_account.json");
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf-8"));

// Get spreadsheet ID from environment
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  throw new Error("SPREADSHEET_ID is not set in .env file");
}

/**
 * Creates a JWT auth client for Google Sheets API
 * @returns {JWT}
 */
function createAuthClient() {
  return new JWT({
    email: serviceAccount.client_email,
    key: serviceAccount.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

/**
 * Adds jobs to Google Sheet with deduplication based on Application Link
 * @param {Array<{company: string, role: string, location: string, link: string, source: string}>} jobsArray
 * @returns {Promise<{added: number, duplicates: number}>}
 */
async function addToSheet(jobsArray) {
  if (!jobsArray || jobsArray.length === 0) {
    console.log("No jobs to add.");
    return { added: 0, duplicates: 0 };
  }

  try {
    // Create auth client and spreadsheet instance
    const authClient = createAuthClient();
    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, authClient);

    // Load document info
    await doc.loadInfo();
    console.log(`📊 Connected to spreadsheet: "${doc.title}"`);

    // Access the first sheet (tab)
    const sheet = doc.sheetsByIndex[0];
    console.log(`📋 Using sheet: "${sheet.title}"`);

    // Fetch all existing rows
    const existingRows = await sheet.getRows();
    console.log(`📥 Found ${existingRows.length} existing rows`);

    // Extract existing application links for deduplication
    const existingLinks = new Set();
    for (const row of existingRows) {
      // Try common column names for the application link
      const link =
        row.get("Application Link") ||
        row.get("Link") ||
        row.get("link") ||
        row.get("URL") ||
        row.get("url");
      if (link) {
        existingLinks.add(link);
      }
    }

    // Filter out duplicates
    const newJobs = jobsArray.filter((job) => !existingLinks.has(job.link));
    const duplicateCount = jobsArray.length - newJobs.length;

    if (newJobs.length === 0) {
      console.log(
        `⏭️  All ${jobsArray.length} jobs already exist in the sheet.`
      );
      return { added: 0, duplicates: duplicateCount };
    }

    console.log(
      `✨ Adding ${newJobs.length} new jobs (${duplicateCount} duplicates skipped)`
    );

    // Prepare rows for insertion
    const rowsToAdd = newJobs.map((job) => ({
      Company: job.company,
      Role: job.role,
      Location: job.location,
      "Application Link": job.link,
      "Date Posted": job.datePosted || "",
      Source: job.source,
      "Date Added": new Date().toISOString().split("T")[0],
    }));

    // Append new rows
    await sheet.addRows(rowsToAdd);

    console.log(`✅ Successfully added ${newJobs.length} new jobs!`);
    return { added: newJobs.length, duplicates: duplicateCount };
  } catch (error) {
    console.error("❌ Error adding to sheet:", error.message);
    throw error;
  }
}

export { addToSheet };

