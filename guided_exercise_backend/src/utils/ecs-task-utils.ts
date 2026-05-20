import type { AssignPublicIp, KeyValuePair, RunTaskCommandInput } from '@aws-sdk/client-ecs';

export type StartRecordingWorkerTaskInput = {
  recordingId: string;
  rawS3Prefix: string;
  userId: string;
  recordingStart?: number;
  timestamps?: any[];
};

type WorkerTaskConfig = {
  awsRegion: string;
  cluster: string;
  taskDefinition: string;
  containerName: string;
  subnets: string[];
  securityGroups: string[];
  assignPublicIp: AssignPublicIp;
};

export function requireEnv(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function optionalEnv(env: NodeJS.ProcessEnv, name: string): string | null {
  return env[name]?.trim() || null;
}

export function splitCsvEnv(env: NodeJS.ProcessEnv, name: string): string[] {
  return requireEnv(env, name)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function buildContainerEnvironment(
  input: StartRecordingWorkerTaskInput,
  env: NodeJS.ProcessEnv = process.env
): KeyValuePair[] {
  const entries: Array<[string, string | null]> = [
    ['AWS_REGION', env.AWS_REGION || 'us-west-2'],
    ['RECORDING_ID', input.recordingId],
    ['RAW_S3_PREFIX', input.rawS3Prefix],
    ['USER_ID', input.userId],
    ['OUTPUT_BUCKET', optionalEnv(env, 'WORKER_OUTPUT_BUCKET')],
    ['BACKEND_UPDATE_URL', optionalEnv(env, 'WORKER_CALLBACK_URL')],
    ['BACKEND_ADD_CLIP_URL', optionalEnv(env, 'ADD_CLIP_CALLBACK_URL')],
    ['BACKEND_ADD_FEEDBACK_URL', optionalEnv(env, 'ADD_FEEDBACK_CALLBACK_URL')],
    ['WORKER_SECRET', optionalEnv(env, 'WORKER_SHARED_SECRET')],
    ['RECORDING_START_MS', input.recordingStart?.toString() ?? null],
    ['TIMESTAMPS_JSON', input.timestamps ? JSON.stringify(input.timestamps) : null],
    ['GOOGLE_API_KEY', env.GOOGLE_API_KEY || null]
  ];

  return entries.filter(([, value]) => Boolean(value)).map(([name, value]) => ({ name, value: value! }));
}

export function toStartedBy(recordingId: string): string {
  const normalized = recordingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
  return `recording-${normalized || 'worker'}`;
}

export function readWorkerTaskConfig(env: NodeJS.ProcessEnv = process.env): WorkerTaskConfig {
  return {
    awsRegion: env.AWS_REGION || 'us-west-2',
    cluster: requireEnv(env, 'ECS_CLUSTER_ARN'),
    taskDefinition: requireEnv(env, 'ECS_TASK_DEFINITION'),
    containerName: requireEnv(env, 'ECS_CONTAINER_NAME'),
    subnets: splitCsvEnv(env, 'ECS_SUBNET_IDS'),
    securityGroups: splitCsvEnv(env, 'ECS_SECURITY_GROUP_IDS'),
    assignPublicIp: (env.ECS_ASSIGN_PUBLIC_IP?.trim().toUpperCase() || 'ENABLED') as AssignPublicIp
  };
}

export function buildRunTaskCommandInput(
  input: StartRecordingWorkerTaskInput,
  config: WorkerTaskConfig,
  env: NodeJS.ProcessEnv = process.env
): RunTaskCommandInput {
  return {
    cluster: config.cluster,
    taskDefinition: config.taskDefinition,
    launchType: 'FARGATE',
    startedBy: toStartedBy(input.recordingId),
    networkConfiguration: {
      awsvpcConfiguration: {
        subnets: config.subnets,
        securityGroups: config.securityGroups,
        assignPublicIp: config.assignPublicIp
      }
    },
    overrides: {
      containerOverrides: [
        {
          name: config.containerName,
          environment: buildContainerEnvironment(input, env)
        }
      ]
    }
  };
}
