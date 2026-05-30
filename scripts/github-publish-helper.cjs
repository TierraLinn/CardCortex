const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const owner = process.env.GITHUB_OWNER || "TierraLinn";
const repo = process.env.GITHUB_REPO || "CardCortex";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const ignoredDirs = new Set([".git", "node_modules", ".vercel", ".netlify"]);
const ignoredFiles = new Set([".env.admin.local"]);

function walk(dir) {
  const files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, item.name);
    const rel = path.relative(root, fullPath).replace(/\\/g, "/");
    if (item.isDirectory()) {
      if (ignoredDirs.has(item.name)) continue;
      files.push(...walk(fullPath));
      continue;
    }
    if (ignoredFiles.has(item.name)) continue;
    if (/\.log$|\.zip$/.test(item.name)) continue;
    if (/^\.env/.test(item.name) && item.name !== ".env.example") continue;
    files.push(rel);
  }
  return files.sort();
}

async function github(pathname, options = {}) {
  if (!token) throw new Error("Missing GITHUB_TOKEN or GH_TOKEN.");
  const response = await fetch(`https://api.github.com${pathname}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${body?.message || text}`);
  return body;
}

async function getRef() {
  return github(`/repos/${owner}/${repo}/git/ref/heads/${branch}`);
}

async function createBlob(content) {
  return github(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: content.toString("base64"), encoding: "base64" }),
  });
}

async function createTree(baseTree, files) {
  const remoteTree = await github(`/repos/${owner}/${repo}/git/trees/${baseTree}?recursive=1`);
  const localSet = new Set(files);
  const tree = [];
  for (const entry of remoteTree.tree || []) {
    if (entry.type !== "blob") continue;
    if (!localSet.has(entry.path)) tree.push({ path: entry.path, mode: "100644", type: "blob", sha: null });
  }
  for (const file of files) {
    const content = fs.readFileSync(path.join(root, file));
    const blob = await createBlob(content);
    tree.push({ path: file, mode: "100644", type: "blob", sha: blob.sha });
  }
  return github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTree, tree }),
  });
}

async function createCommit(message, treeSha, parentSha) {
  return github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
  });
}

async function updateRef(commitSha) {
  return github(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSha, force: false }),
  });
}

function packageFingerprint(files) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(fs.readFileSync(path.join(root, file)));
  }
  return hash.digest("hex");
}

async function publish() {
  const files = walk(root);
  const fingerprint = packageFingerprint(files);
  console.log(`Publishing ${files.length} files to ${owner}/${repo}@${branch}`);
  console.log(`Package sha256 ${fingerprint}`);
  const ref = await getRef();
  const parentSha = ref.object.sha;
  const parentCommit = await github(`/repos/${owner}/${repo}/git/commits/${parentSha}`);
  const tree = await createTree(parentCommit.tree.sha, files);
  const commit = await createCommit(`Publish CardCortex production package\n\nPackage sha256: ${fingerprint}`, tree.sha, parentSha);
  await updateRef(commit.sha);
  console.log(`Published commit ${commit.sha}`);
}

async function checkAccess() {
  const repoInfo = await github(`/repos/${owner}/${repo}`);
  console.log(`${repoInfo.full_name} permissions: ${JSON.stringify(repoInfo.permissions || {})}`);
}

const command = process.argv[2] || "check";
if (command === "check") checkAccess().catch(fail);
else if (command === "publish") publish().catch(fail);
else fail(new Error(`Unknown command: ${command}`));

function fail(error) {
  console.error(error.message);
  process.exit(1);
}
