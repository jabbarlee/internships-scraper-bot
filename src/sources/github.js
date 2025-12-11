import axios from "axios";

const GITHUB_RAW_URL =
  "https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/dev/README.md";

// Locations to filter by
const ALLOWED_LOCATIONS = [
  "New York",
  "San Francisco",
  "Boston",
  "Houston",
  "Remote",
];

// Role keywords to filter by
const ROLE_KEYWORDS = ["Software", "Engineer"];

/**
 * Fetches and parses internship listings from the GitHub README
 * @returns {Promise<Array<{company: string, role: string, location: string, link: string, source: string}>>}
 */
async function scrapeGitHubInternships() {
  try {
    // Fetch the raw Markdown content
    const response = await axios.get(GITHUB_RAW_URL);
    const markdown = response.data;

    // Parse the HTML table from markdown
    const internships = parseMarkdownTable(markdown);

    // Filter internships based on role and location criteria
    const filteredInternships = filterInternships(internships);

    return filteredInternships;
  } catch (error) {
    console.error("Error fetching GitHub internships:", error.message);
    throw error;
  }
}

/**
 * Parses the HTML table from the Markdown content
 * @param {string} markdown - Raw markdown content
 * @returns {Array<{company: string, role: string, location: string, link: string}>}
 */
function parseMarkdownTable(markdown) {
  const internships = [];

  // The table uses HTML format with <tr> rows
  // Match all table rows in tbody
  const rowRegex = /<tr>\s*([\s\S]*?)\s*<\/tr>/gi;
  const rows = markdown.match(rowRegex) || [];

  let lastCompany = ""; // Track last company for rows that use ↳ symbol

  for (const row of rows) {
    // Skip header rows
    if (row.includes("<th>")) continue;

    // Extract table cells
    const cellRegex = /<td>([\s\S]*?)<\/td>/gi;
    const cells = [];
    let match;

    while ((match = cellRegex.exec(row)) !== null) {
      cells.push(match[1].trim());
    }

    // We expect at least 4 cells: Company, Role, Location, Application, (Date Posted)
    if (cells.length < 4) continue;

    const [companyCell, roleCell, locationCell, applicationCell, datePostedCell] = cells;

    // Parse company name
    let company = extractCompanyName(companyCell);

    // Handle continuation rows (↳ symbol means same company as previous)
    if (company === "↳" || company === "") {
      company = lastCompany;
    } else {
      lastCompany = company;
    }

    // Parse role
    const role = cleanText(roleCell);

    // Parse location (handle multiple locations and <details> tags)
    const location = extractLocation(locationCell);

    // Parse application link
    const link = extractApplicationLink(applicationCell);

    // Parse date posted (5th column in Summer 2026 repo)
    const datePosted = datePostedCell ? cleanText(datePostedCell) : "";

    // Skip if essential fields are missing or application is closed (🔒)
    if (!company || !role || !link || link === "🔒") continue;

    internships.push({
      company,
      role,
      location,
      link,
      datePosted,
      source: "GitHub",
    });
  }

  return internships;
}

/**
 * Extracts company name from cell content
 * @param {string} cellContent - HTML content of company cell
 * @returns {string}
 */
function extractCompanyName(cellContent) {
  // Check for ↳ symbol (continuation of previous company)
  if (cellContent.trim() === "↳") {
    return "↳";
  }

  // Extract text from anchor tag if present
  const linkMatch = cellContent.match(/<a[^>]*>([^<]+)<\/a>/i);
  if (linkMatch) {
    return cleanText(linkMatch[1]);
  }

  // Extract from <strong> tag
  const strongMatch = cellContent.match(
    /<strong[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?<\/strong>/i
  );
  if (strongMatch) {
    return cleanText(strongMatch[1]);
  }

  return cleanText(cellContent);
}

/**
 * Extracts location from cell content, handling multiple formats
 * @param {string} cellContent - HTML content of location cell
 * @returns {string}
 */
function extractLocation(cellContent) {
  // Handle <details> tag for multiple locations
  const detailsMatch = cellContent.match(
    /<details>[\s\S]*?<summary>[\s\S]*?<strong>(\d+\s+locations)<\/strong>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/i
  );
  if (detailsMatch) {
    const locationList = detailsMatch[2];
    // Extract individual locations, they're separated by </br>
    const locations = locationList
      .split(/<\/br>|<br\s*\/?>|\n/i)
      .map((loc) => cleanText(loc))
      .filter((loc) => loc.length > 0);
    return locations.join(", ");
  }

  // Handle locations separated by </br>
  const locations = cellContent
    .split(/<\/br>|<br\s*\/?>|\n/i)
    .map((loc) => cleanText(loc))
    .filter((loc) => loc.length > 0);

  return locations.join(", ");
}

/**
 * Extracts the application link from cell content
 * @param {string} cellContent - HTML content of application cell
 * @returns {string}
 */
function extractApplicationLink(cellContent) {
  // Look for the first href that's not a Simplify link
  const linkMatches = cellContent.matchAll(/<a\s+href="([^"]+)"/gi);

  for (const match of linkMatches) {
    const href = match[1];
    // Skip simplify.jobs links, we want the direct application link
    if (!href.includes("simplify.jobs")) {
      // Clean up tracking parameters
      return href.split("?utm_source")[0];
    }
  }

  // If only Simplify link exists, return it
  const anyLink = cellContent.match(/<a\s+href="([^"]+)"/i);
  return anyLink ? anyLink[1] : "";
}

/**
 * Removes HTML tags and cleans whitespace from text
 * @param {string} text - Text to clean
 * @returns {string}
 */
function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Filters internships based on role and location criteria
 * @param {Array} internships - Array of internship objects
 * @returns {Array}
 */
function filterInternships(internships) {
  return internships.filter((internship) => {
    // Check if role contains "Software" or "Engineer" (case-insensitive)
    const roleMatches = ROLE_KEYWORDS.some((keyword) =>
      internship.role.toLowerCase().includes(keyword.toLowerCase())
    );

    // Check if location contains any of the allowed locations (case-insensitive)
    const locationMatches = ALLOWED_LOCATIONS.some((location) =>
      internship.location.toLowerCase().includes(location.toLowerCase())
    );

    return roleMatches && locationMatches;
  });
}

// Main execution - run when script is called directly
async function main() {
  console.log("🔍 Fetching internships from GitHub...\n");

  try {
    const internships = await scrapeGitHubInternships();

    console.log(`✅ Found ${internships.length} matching internships:\n`);

    internships.forEach((internship, index) => {
      console.log(`${index + 1}. ${internship.company}`);
      console.log(`   Role: ${internship.role}`);
      console.log(`   Location: ${internship.location}`);
      console.log(`   Link: ${internship.link}`);
      console.log("");
    });

    return internships;
  } catch (error) {
    console.error("❌ Failed to scrape internships:", error.message);
    process.exit(1);
  }
}

// Run main function
main();

// Export for use as module
export { scrapeGitHubInternships, parseMarkdownTable, filterInternships };
