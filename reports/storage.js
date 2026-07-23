// reports/storage.js
import { BlobServiceClient } from "@azure/storage-blob";

const STORAGE_ACCOUNT = process.env.STORAGE_ACCOUNT_NAME;
const CONTAINER = process.env.STORAGE_CONTAINER_REPORTES;

function getBlobClient(blobName) {
  const blobService = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING
  );
  return blobService.getContainerClient(CONTAINER).getBlockBlobClient(blobName);
}

export function blobUrl(blobName) {
  return `https://${STORAGE_ACCOUNT}.blob.core.windows.net/${CONTAINER}/${blobName}`;
}

export async function existeBlob(blobName) {
  try {
    return await getBlobClient(blobName).exists();
  } catch {
    return false;
  }
}

export async function subirBuffer(blobName, buffer, contentType = "application/pdf") {
  const client = getBlobClient(blobName);
  await client.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: contentType },
    overwrite: true,
  });
}