import { describe, expect, it } from 'vitest';
import {
  buildContainerEnvironment,
  buildRunTaskCommandInput,
  optionalEnv,
  readWorkerTaskConfig,
  requireEnv,
  splitCsvEnv,
  toStartedBy,
  type StartRecordingWorkerTaskInput
} from './ecs-task-utils.js';

const baseInput: StartRecordingWorkerTaskInput = {
  recordingId: 'recording-123',
  rawS3Prefix: 's3://ivs-bucket/session/raw-prefix',
  userId: 'user-123',
  recordingStart: 1779230050000,
  timestamps: [
    {
      sessionId: 'session-123',
      exercise: 'pushup',
      starttime: 1779230050887,
      endtime: 1779230092521
    }
  ]
};

const baseEnv: NodeJS.ProcessEnv = {
  AWS_REGION: 'us-west-2',
  ECS_CLUSTER_ARN: 'arn:aws:ecs:us-west-2:123:cluster/feedback-component',
  ECS_TASK_DEFINITION: 'feedback-component-task',
  ECS_CONTAINER_NAME: 'feedback-component',
  ECS_SUBNET_IDS: ' subnet-1,subnet-2, ,subnet-3 ',
  ECS_SECURITY_GROUP_IDS: ' sg-1, sg-2 ',
  ECS_ASSIGN_PUBLIC_IP: 'disabled',
  WORKER_OUTPUT_BUCKET: 'processed-bucket',
  WORKER_CALLBACK_URL: 'https://backend.example.com/api/recordings/worker-complete',
  ADD_CLIP_CALLBACK_URL: 'https://backend.example.com/api/firebase/addClip',
  ADD_FEEDBACK_CALLBACK_URL: 'https://backend.example.com/api/firebase/addFeedback',
  WORKER_SHARED_SECRET: 'worker-secret',
  GOOGLE_API_KEY: 'google-key'
};

function environmentMap(env: ReturnType<typeof buildContainerEnvironment>) {
  return Object.fromEntries(env.map(({ name, value }) => [name, value]));
}

describe('ecs task utils', () => {
  describe('env readers', () => {
    it('requires non-empty environment variables', () => {
      expect(requireEnv({ VALUE: ' abc ' }, 'VALUE')).toBe('abc');
      expect(() => requireEnv({}, 'MISSING')).toThrow('MISSING is required.');
      expect(() => requireEnv({ EMPTY: '   ' }, 'EMPTY')).toThrow('EMPTY is required.');
    });

    it('returns optional env values as trimmed strings or null', () => {
      expect(optionalEnv({ VALUE: ' abc ' }, 'VALUE')).toBe('abc');
      expect(optionalEnv({ VALUE: '   ' }, 'VALUE')).toBeNull();
      expect(optionalEnv({}, 'VALUE')).toBeNull();
    });

    it('splits comma-separated env lists and removes blanks', () => {
      expect(splitCsvEnv({ IDS: ' one, two,, three ' }, 'IDS')).toEqual(['one', 'two', 'three']);
    });
  });

  describe('buildContainerEnvironment', () => {
    it('builds the worker task environment including callbacks and serialized timestamps', () => {
      const result = environmentMap(buildContainerEnvironment(baseInput, baseEnv));

      expect(result).toMatchObject({
        AWS_REGION: 'us-west-2',
        RECORDING_ID: 'recording-123',
        RAW_S3_PREFIX: 's3://ivs-bucket/session/raw-prefix',
        USER_ID: 'user-123',
        OUTPUT_BUCKET: 'processed-bucket',
        BACKEND_UPDATE_URL: 'https://backend.example.com/api/recordings/worker-complete',
        BACKEND_ADD_CLIP_URL: 'https://backend.example.com/api/firebase/addClip',
        BACKEND_ADD_FEEDBACK_URL: 'https://backend.example.com/api/firebase/addFeedback',
        WORKER_SECRET: 'worker-secret',
        RECORDING_START_MS: '1779230050000',
        GOOGLE_API_KEY: 'google-key'
      });
      expect(JSON.parse(result.TIMESTAMPS_JSON!)).toEqual(baseInput.timestamps);
    });

    it('omits optional values when they are not configured', () => {
      const result = environmentMap(
        buildContainerEnvironment(
          {
            recordingId: 'recording-123',
            rawS3Prefix: 'bucket/prefix',
            userId: 'user-123'
          },
          {}
        )
      );

      expect(result).toEqual({
        AWS_REGION: 'us-west-2',
        RECORDING_ID: 'recording-123',
        RAW_S3_PREFIX: 'bucket/prefix',
        USER_ID: 'user-123'
      });
    });
  });

  describe('toStartedBy', () => {
    it('sanitizes and caps startedBy values for ECS', () => {
      expect(toStartedBy('abc/def gh!')).toBe('recording-abcdefgh');
      expect(toStartedBy('')).toBe('recording-worker');
      expect(toStartedBy('a'.repeat(80))).toBe(`recording-${'a'.repeat(48)}`);
    });
  });

  describe('readWorkerTaskConfig', () => {
    it('reads required ECS task configuration and defaults assignPublicIp', () => {
      expect(readWorkerTaskConfig({ ...baseEnv, ECS_ASSIGN_PUBLIC_IP: undefined })).toEqual({
        awsRegion: 'us-west-2',
        cluster: 'arn:aws:ecs:us-west-2:123:cluster/feedback-component',
        taskDefinition: 'feedback-component-task',
        containerName: 'feedback-component',
        subnets: ['subnet-1', 'subnet-2', 'subnet-3'],
        securityGroups: ['sg-1', 'sg-2'],
        assignPublicIp: 'ENABLED'
      });
    });

    it('throws when required ECS task configuration is missing', () => {
      expect(() => readWorkerTaskConfig({ ...baseEnv, ECS_CLUSTER_ARN: undefined })).toThrow('ECS_CLUSTER_ARN is required.');
      expect(() => readWorkerTaskConfig({ ...baseEnv, ECS_TASK_DEFINITION: undefined })).toThrow('ECS_TASK_DEFINITION is required.');
      expect(() => readWorkerTaskConfig({ ...baseEnv, ECS_CONTAINER_NAME: undefined })).toThrow('ECS_CONTAINER_NAME is required.');
      expect(() => readWorkerTaskConfig({ ...baseEnv, ECS_SUBNET_IDS: undefined })).toThrow('ECS_SUBNET_IDS is required.');
      expect(() => readWorkerTaskConfig({ ...baseEnv, ECS_SECURITY_GROUP_IDS: undefined })).toThrow(
        'ECS_SECURITY_GROUP_IDS is required.'
      );
    });
  });

  describe('buildRunTaskCommandInput', () => {
    it('builds the Fargate RunTask input used by the backend', () => {
      const config = readWorkerTaskConfig(baseEnv);
      const commandInput = buildRunTaskCommandInput(baseInput, config, baseEnv);

      expect(commandInput).toMatchObject({
        cluster: baseEnv.ECS_CLUSTER_ARN,
        taskDefinition: baseEnv.ECS_TASK_DEFINITION,
        launchType: 'FARGATE',
        startedBy: 'recording-recording-123',
        networkConfiguration: {
          awsvpcConfiguration: {
            subnets: ['subnet-1', 'subnet-2', 'subnet-3'],
            securityGroups: ['sg-1', 'sg-2'],
            assignPublicIp: 'DISABLED'
          }
        },
        overrides: {
          containerOverrides: [
            {
              name: 'feedback-component'
            }
          ]
        }
      });

      const containerOverrides = commandInput.overrides?.containerOverrides;
      expect(containerOverrides).toHaveLength(1);
      expect(environmentMap(containerOverrides![0]!.environment!)).toMatchObject({
        RECORDING_ID: 'recording-123',
        BACKEND_ADD_CLIP_URL: 'https://backend.example.com/api/firebase/addClip'
      });
    });
  });
});
