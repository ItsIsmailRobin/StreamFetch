import { useEffect, useMemo, useState } from "react";

const REFRESH_MS = 15_000;
const WORKFLOW_FILE = "update-stream.yml";
const GITHUB_OWNER = "ItsIsmailRobin";
const GITHUB_REPO = "StreamFetch";
const GITHUB_BRANCH = "main";

export default function App() {
  const [streamUrl, setStreamUrl] = useState("");
  const [heartbeat, setHeartbeat] = useState("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const streamTxtPath = "/stream.txt";

  const triggerWorkflow = async () => {
    try {
      setActionMessage("");
      if (GITHUB_OWNER === "YOUR_GITHUB_USERNAME" || GITHUB_REPO === "YOUR_REPO_NAME") {
        setActionMessage("Set GITHUB_OWNER and GITHUB_REPO in src/App.tsx first.");
        return;
      }

      const savedToken = window.localStorage.getItem("github_pat") ?? "";
      const token = window.prompt("Enter your GitHub PAT (workflow scope). It stays only in your browser.", savedToken);
      if (!token) {
        setActionMessage("Action cancelled.");
        return;
      }

      window.localStorage.setItem("github_pat", token);
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ref: GITHUB_BRANCH }),
        }
      );

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`GitHub API error ${response.status}: ${body || response.statusText}`);
      }

      setActionMessage("Workflow triggered. Wait 10-30 seconds, then refresh to see the new heartbeat.");
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Failed to trigger workflow.");
    }
  };

  const humanCheckedAt = useMemo(() => {
    if (!lastChecked) return "Never";
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(lastChecked);
  }, [lastChecked]);

  useEffect(() => {
    let active = true;

    const loadStream = async () => {
      try {
        if (active) {
          setError("");
        }

        const response = await fetch(`${streamTxtPath}?t=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load stream.txt (${response.status})`);
        }

        const content = (await response.text()).trim();
        const heartbeatResponse = await fetch(`/LastCheck.txt?t=${Date.now()}`, { cache: "no-store" });
        const heartbeatText = heartbeatResponse.ok ? (await heartbeatResponse.text()).trim() : "";
        if (active) {
          setStreamUrl(content);
          setHeartbeat(heartbeatText);
          setLastChecked(new Date());
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Unknown error");
          setLoading(false);
          setLastChecked(new Date());
        }
      }
    };

    loadStream();
    const intervalId = window.setInterval(loadStream, REFRESH_MS);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-20 md:px-10">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-400">FifaLive Stream Watcher</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">Live URL mirror from GitHub Actions</h1>
        <p className="mt-4 max-w-3xl text-zinc-300 md:text-lg">
          This page reads <code className="text-zinc-100">/stream.txt</code>, which is auto-updated by your workflow when the
          source video link changes.
        </p>

        <div className="mt-10 border border-zinc-800 bg-zinc-900/50 p-5 font-mono text-sm leading-relaxed break-all md:text-base">
          {loading ? "Loading latest stream URL..." : streamUrl || "Stream.txt is empty."}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
          <span>Last checked: {humanCheckedAt}</span>
          {heartbeat ? <span>Workflow heartbeat: {heartbeat}</span> : null}
          {error ? <span className="text-rose-400">Error: {error}</span> : null}
          {actionMessage ? <span className="text-amber-300">{actionMessage}</span> : null}
          {streamUrl ? (
            <a
              href={streamUrl}
              target="_blank"
              rel="noreferrer"
              className="border border-zinc-700 px-4 py-2 text-zinc-100 transition hover:border-zinc-500"
            >
              Open Stream URL
            </a>
          ) : null}
          <button
            type="button"
            onClick={triggerWorkflow}
            className="border border-zinc-700 px-4 py-2 text-zinc-100 transition hover:border-zinc-500"
          >
            Fetch Stream
          </button>
          <a href={streamTxtPath} target="_blank" rel="noreferrer" className="border border-zinc-700 px-4 py-2 transition hover:border-zinc-500">
            Open /stream.txt
          </a>
        </div>
      </section>
    </main>
  );
}
