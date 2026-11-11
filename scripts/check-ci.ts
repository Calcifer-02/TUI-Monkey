export {};
const credential = Bun.spawn(['git', 'credential', 'fill'], {stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: {...process.env, GIT_TERMINAL_PROMPT: '0'}});
credential.stdin.write('protocol=https\nhost=github.com\n\n');
credential.stdin.end();
const data = await new Response(credential.stdout).text();
if (await credential.exited !== 0) throw new Error('Авторизация GitHub недоступна.');
const token = data.split('\n').find(line => line.startsWith('password='))?.slice(9).trim();
if (!token) throw new Error('Авторизация GitHub недоступна.');
const headers = {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'TUI-Monkey-build'};
const response = await fetch('https://api.github.com/repos/Calcifer-02/TUI-Monkey/actions/runs?per_page=3', {headers});
if (!response.ok) throw new Error(`GitHub API: ${response.status}`);
const result = await response.json() as {workflow_runs: {id: number; name: string; status: string; conclusion: string; html_url: string}[]};
for (const run of result.workflow_runs) {
  console.log({id: run.id, name: run.name, status: run.status, conclusion: run.conclusion, url: run.html_url});
  const jobs = await (await fetch(`https://api.github.com/repos/Calcifer-02/TUI-Monkey/actions/runs/${run.id}/jobs`, {headers})).json() as {jobs?: {id: number; name: string; status: string; conclusion: string; steps: {name: string; conclusion: string}[]}[]};
  for (const job of jobs.jobs ?? []) console.log({id: job.id, name: job.name, status: job.status, conclusion: job.conclusion, failed: job.steps.filter(s => s.conclusion === 'failure').map(s => s.name)});
}
