import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Upload video to S3 (filePath is currently hard coded)
export async function uploadVideoToS3(bucketName: string, key: string, filePath: string) {
  try {
    if (!bucketName || !key || !filePath) {
      throw new Error('Missing parameters (bucketName, key, filePath)');
    }
    // TODO: Using a hard coded video path rn, will update to actual capture source
    const fileStream = fs.createReadStream(
      'C:/Users/grace/All Programming/ai-guided-exercise/guided_exercise_backend/src/services/AWS/testvideo30sec.mp4'
    );

    if (!fileStream) {
      throw new Error('Unable to read video file.');
    }

    const upload = new Upload({
      client: new S3Client({}),
      params: {
        Bucket: bucketName,
        Key: key,
        Body: fileStream
      }
    });

    await upload.done();
  } catch (err) {
    throw err;
  }
}

export async function getVideoFromS3(bucketName: string, key: string) {
  try {
    const s3Client = new S3Client({});

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    // TODO: Url for 5 days is way too long
    const fiveDaysInSeconds = 5 * 24 * 60 * 60;
    const url = await getSignedUrl(s3Client, command, { expiresIn: fiveDaysInSeconds });

    return url;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    throw err;
  }
}
