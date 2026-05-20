import { ECSClient, RunTaskCommand } from '@aws-sdk/client-ecs';
import {
  buildRunTaskCommandInput,
  readWorkerTaskConfig,
  type StartRecordingWorkerTaskInput
} from '@/utils/ecs-task-utils.js';

export async function startRecordingWorkerTask(input: StartRecordingWorkerTaskInput): Promise<string> {
  console.log('Start Recording Worker Task');
  const ecsClient = new ECSClient({ region: process.env.AWS_REGION || 'us-west-2' });
  const config = readWorkerTaskConfig();

  const response = await ecsClient.send(
    new RunTaskCommand(buildRunTaskCommandInput(input, config))
  );

  console.log('Response from start recording worker task', response);

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
