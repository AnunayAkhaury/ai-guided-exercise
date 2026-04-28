import { ECSClient, RunTaskCommand, type AssignPublicIp, type KeyValuePair } from '@aws-sdk/client-ecs';

type StartRecordingWorkerTaskInput = {
  recordingId: string;
  rawS3Prefix: string;
  userId: string;
};

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalEnv(name: string): string | null {
  return process.env[name]?.trim() || null;
}

function splitCsvEnv(name: string): string[] {
  return requireEnv(name)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function buildContainerEnvironment(input: StartRecordingWorkerTaskInput): KeyValuePair[] {
  const entries: Array<[string, string | null]> = [
    ['AWS_REGION', process.env.AWS_REGION || 'us-west-2'],
    ['RECORDING_ID', input.recordingId],
    ['RAW_S3_PREFIX', input.rawS3Prefix],
    ['USER_ID', input.userId],
    ['OUTPUT_BUCKET', optionalEnv('WORKER_OUTPUT_BUCKET')],
    ['BACKEND_UPDATE_URL', optionalEnv('WORKER_CALLBACK_URL')],
    ['WORKER_SECRET', optionalEnv('WORKER_SHARED_SECRET')]
  ];

  return entries.filter(([, value]) => Boolean(value)).map(([name, value]) => ({ name, value: value! }));
}

function toStartedBy(recordingId: string): string {
  const normalized = recordingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return `recording-${normalized || 'worker'}`;
}

export async function startRecordingWorkerTask(input: StartRecordingWorkerTaskInput): Promise<string> {
  const ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'us-west-2' });

  const cluster = requireEnv('ECS_CLUSTER_ARN');
  const taskDefinition = requireEnv('ECS_TASK_DEFINITION');
  const containerName = requireEnv('ECS_CONTAINER_NAME');
  const subnets = splitCsvEnv('ECS_SUBNET_IDS');
  const securityGroups = splitCsvEnv('ECS_SECURITY_GROUP_IDS');
  const assignPublicIp = (process.env.ECS_ASSIGN_PUBLIC_IP?.trim().toUpperCase() || 'ENABLED') as AssignPublicIp;

  const response = await ecsClient.send(
    new RunTaskCommand({
      cluster,
      taskDefinition,
      launchType: 'FARGATE',
      startedBy: toStartedBy(input.recordingId),
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets,
          securityGroups,
          assignPublicIp
        }
      },
      overrides: {
        containerOverrides: [
          {
            name: containerName,
            environment: buildContainerEnvironment(input)
          }
        ]
      }
    })
  );

  if (response.failures?.length) {
    const failure = response.failures[0];
    throw new Error(
      `ECS RunTask failed: ${failure?.reason || 'Unknown failure'}${failure?.detail ? ` (${failure.detail})` : ''}`
    );
  }

  const taskArn = response.tasks?.[0]?.taskArn;
  if (!taskArn) {
    throw new Error('ECS RunTask did not return a taskArn.');
  }

  return taskArn;
}
