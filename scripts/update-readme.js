/**
 * update-readme.js
 *
 * Fetches all public, non-fork repositories for GH_USERNAME from the GitHub
 * API and writes a markdown table into README.md between the
 * <!-- PROJECTS-START --> / <!-- PROJECTS-END --> markers.
 *
 * Runs in CI via .github/workflows/update-readme.yml, or locally with:
 *   GH_USERNAME=0609Abhinav GITHUB_TOKEN=<token> node scripts/update-readme.js
 */

const fs = require("fs");
const path = require("path");

const USERNAME = process.env.GH_USERNAME || "0609Abhinav";
const TOKEN = process.env.GITHUB_TOKEN;
const README_PATH = path.join(__dirname, "..", "README.md");
const START_MARKER = "<!-- PROJECTS-START -->";
const END_MARKER = "<!-- PROJECTS-END -->";

async function fetchAllRepos(username) {
  const repos = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `https://api.github.com/users/${username}/repos?per_page=100&page=${page}&sort=updated`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
        },
      }
    );

    if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (data.length === 0) break;

    repos.push(...data);
    page += 1;
  }

  // Public, non-fork, not the profile README repo itself
  return repos.filter(
    (r) => !r.private && !r.fork && r.name.toLowerCase() !== username.toLowerCase()
  );
}

function buildTable(repos) {
  const header =
    "| Repository | Description | Language | ⭐ Stars | Updated |\n" +
    "|---|---|---|---|---|\n";

  const rows = repos
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
    .map((r) => {
      const name = `[${r.name}](${r.html_url})`;
      const desc = (r.description || "—").replace(/\|/g, "\\|");
      const lang = r.language || "—";
      const stars = r.stargazers_count;
      const updated = new Date(r.pushed_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return `| ${name} | ${desc} | ${lang} | ${stars} | ${updated} |`;
    })
    .join("\n");

  return header + rows + "\n";
}

async function main() {
  const repos = await fetchAllRepos(USERNAME);
  const table = buildTable(repos);

  const readme = fs.readFileSync(README_PATH, "utf8");
  const startIdx = readme.indexOf(START_MARKER);
  const endIdx = readme.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      "Could not find PROJECTS-START / PROJECTS-END markers in README.md"
    );
  }

  const before = readme.slice(0, startIdx + START_MARKER.length);
  const after = readme.slice(endIdx);

  const stamp = `\n> Auto-generated on ${new Date().toISOString().split("T")[0]} — ${repos.length} public repositories.\n\n`;

  const newReadme = `${before}${stamp}${table}\n${after}`;
  fs.writeFileSync(README_PATH, newReadme);

  console.log(`README.md updated with ${repos.length} repositories.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
