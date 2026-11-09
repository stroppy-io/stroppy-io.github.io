import ToolPage from '@site/src/components/tools/ToolPage';
import {DOCS, REPOS} from '@site/src/components/tools/tools';

// Graphene CI: facts and examples from its documentation (graphene-ci.github.io/docs:
// the home page, sdk/main, start/first-look) and how stroppy-cloud's pipelines
// use it (stroppy-cloud/pipelines).

export default function GraphenePage() {
  return (
    <ToolPage
      tool="graphene"
      tagline="Pipelines are typed Go programs; the machines, containers and files they need are resources a run owns."
      intro={
        <p>
          CI tools track only steps; infrastructure tools track only desired state. Graphene keeps both in one model, so a run knows what it
          brought up, cleans it up when it ends, and can leave a failed environment standing for you to look at.
        </p>
      }
      actions={[
        {label: 'Read the docs', href: DOCS.graphene},
        {label: 'GitHub', href: REPOS.graphene},
      ]}
      sections={[
        {
          id: 'model',
          title: 'How it works',
          lead: 'A pipeline is a Go program with one entry point: its id, a typed run function, and its triggers. Resources come from libraries (Docker, Kubernetes and Crossplane, Git, files) and belong to the run.',
          points: [
            'A run owns a tree of resources; they are finalized when the run ends.',
            'A failed environment can be handed over to a stand for investigation, with an optional time to live.',
            'Agents connect outward, so a remote or existing machine needs no inbound port.',
            'After a worker crash, execution resumes against the recorded resources instead of recreating them.',
          ],
          code: {
            language: 'go',
            title: 'main.go',
            text: [
              'func main() {',
              '\tpipeline.Main("perf-nightly", run,',
              '\t\tpipeline.WithTriggers(',
              '\t\t\ttrigger.Cron("0 3 * * *",',
              '\t\t\t\ttrigger.Params(map[string]any{...})),',
              '\t\t\ttrigger.Webhook("push", trigger.HookSecret("gh-hook")),',
              '\t\t),',
              '\t\tpipeline.WithConcurrency(pipeline.Queue),',
              '\t)',
              '}',
              '',
              'func run(ctx pipeline.Context, params Params) (Result, error) { ... }',
            ].join('\n'),
          },
          links: [
            {label: 'Concepts', href: DOCS.grapheneDoc('concepts/architecture')},
            {label: 'Main', href: DOCS.grapheneDoc('sdk/main')},
            {label: 'Resource libraries', href: DOCS.grapheneDoc('libraries')},
          ],
        },
        {
          id: 'stroppy',
          title: 'In Stroppy Cloud',
          lead: 'Every Stroppy Cloud run is a Graphene pipeline, and the stand it brings up belongs to that run. A suite is a pipeline of runs compared together.',
          example: (
            <ol className="tl-list">
              <li>
                <b>Stand</b>
                <span>machines come up in your cloud account through Crossplane</span>
              </li>
              <li>
                <b>Database</b>
                <span>deployed and tuned for the machine it got</span>
              </li>
              <li>
                <b>Load</b>
                <span>Stroppy runs the workload; you watch it live</span>
              </li>
              <li>
                <b>Report</b>
                <span>collected and kept after the run</span>
              </li>
              <li>
                <b>Teardown</b>
                <span>the stand goes, or stays for a set time to look into a failure</span>
              </li>
            </ol>
          ),
          links: [
            {label: 'How Stroppy Cloud works', href: '/how'},
            {label: 'Stroppy Cloud', href: '/tools/cloud'},
          ],
        },
        {
          id: 'start',
          title: 'Get started',
          lead: 'Build a plan from the full example without a server, then bring up the development stack and drive it with graphenectl, Studio or the Management API. The repository is a development installation, not a hardened production distribution.',
          code: {
            language: 'bash',
            title: 'Terminal',
            text: [
              'git clone https://github.com/graphene-ci/examples.git',
              'cd examples/full && go run . plan',
              '',
              'git clone https://github.com/graphene-ci/graphene.git',
              'cd graphene && make configure && make compose-up',
              'go build -o bin/graphenectl ./cmd/graphenectl',
              "printf '%s\\n' dev-admin-token | bin/graphenectl login \\",
              '  --server 127.0.0.1:7233 --token-stdin --insecure',
              'bin/graphenectl get pipeline',
            ].join('\n'),
          },
          links: [
            {label: 'Current state', href: DOCS.grapheneDoc('start/current-state')},
            {label: 'First local plan', href: DOCS.grapheneDoc('start/first-look')},
            {label: 'graphenectl', href: DOCS.grapheneDoc('graphenectl')},
            {label: 'Studio', href: DOCS.grapheneDoc('studio')},
          ],
        },
      ]}
    />
  );
}
