import mime from 'mime-types';

export function getMimeFromFilename(name: string): string {
  const mimetype = mime.lookup(name);
  return typeof mimetype === 'string' ? mimetype : 'application/octet-stream';
}