import "dotenv/config";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const endpointRaw = (process.env.R2_ENDPOINT ?? "").replace(/\/+$/, "");
const bucket = process.env.R2_BUCKET ?? "";
const endpoint = endpointRaw.endsWith(`/${bucket}`)
  ? endpointRaw.slice(0, -bucket.length - 1)
  : endpointRaw;

const accessKey = process.env.R2_ACCESS_KEY_ID ?? "";
const secretKey = process.env.R2_SECRET_ACCESS_KEY ?? "";

if (!endpoint || !accessKey || !secretKey || !bucket) {
  throw new Error("R2 credentials not configured — R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET are required");
}

const client = new S3Client({
  region: "auto",
  endpoint,
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
});

const publicUrlBase = (process.env.R2_PUBLIC_URL ?? "").replace(/\/+$/, "");

export async function uploadResumePdf(
  userId: string,
  matchId: number,
  pdfBuffer: Buffer,
): Promise<string> {
  const key = `resumes/${userId}/${matchId}.pdf`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    }),
  );

  return publicUrlBase ? `${publicUrlBase}/${key}` : `s3://${bucket}/${key}`;
}
