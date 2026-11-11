import {createHash} from 'node:crypto';
import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
import {readCodeAsset, isAllowedCodeAssetFileName} from './code-asset-store.mjs';
import {loadCodeAssetManifest} from './code-asset-manifest.mjs';

const maximumBytes = 8 * 1024 * 1024;
export function codeFigureName(value) {
  const url = new URL(value, 'https://per.codes');
  if (!['per.codes','www.per.codes'].includes(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port) return null;
  const name = decodeURIComponent(url.pathname.replace(/^.*\/(?:assets)\//, ''));
  return /\/(?:assets)\//.test(url.pathname) && isAllowedCodeAssetFileName(name) ? name : null;
}
export function isPublicImageAddress(address) {
  if (isIP(address) === 4) {
    const [a,b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && [0,168].includes(b) ||
      a === 100 && b >= 64 && b <= 127 || a === 198 && [18,19].includes(b));
  }
  // Only globally routed IPv6 unicast; reject mapped, loopback, local and multicast.
  return isIP(address) === 6 && /^[23]/i.test(address) && !/^2001:db8:/i.test(address);
}
async function remoteImage(value, redirects = 0) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.port && url.port !== '443') throw Error('Report images require a public HTTPS URL.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{address:hostname,family:isIP(hostname)}] : await lookup(hostname,{all:true});
  if (!addresses.length || addresses.some(({address}) => !isPublicImageAddress(address))) throw Error('Report images require a public internet address.');
  // Pin the validated address for this connection, including each redirect.
  const pinned = addresses[0];
  return new Promise((resolve,reject) => {
    const req = request(url, {lookup:(_host,options,done) => options.all ? done(null,[pinned]) : done(null,pinned.address,pinned.family), signal:AbortSignal.timeout(15_000),
      headers:{accept:'image/png,image/jpeg,image/webp,image/gif,image/svg+xml'}, agent:false}, response => {
      if ([301,302,303,307,308].includes(response.statusCode)) {
        response.resume();
        if (redirects >= 3 || !response.headers.location) return reject(Error('The Report image redirected too many times.'));
        remoteImage(new URL(response.headers.location,url).href,redirects+1).then(resolve,reject); return;
      }
      if (response.statusCode !== 200) {response.resume();reject(Error('The embedded image could not be downloaded. Check its URL or upload the file.'));return;}
      const contentType = String(response.headers['content-type'] || '').split(';')[0];
      if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(contentType) || Number(response.headers['content-length']) > maximumBytes) {
        response.resume();reject(Error('The embedded image must be PNG, JPEG, WebP, GIF or SVG, up to 8 MB.'));return;
      }
      const chunks=[];let bytes=0;
      response.on('data',chunk=>{bytes+=chunk.length;if(bytes>maximumBytes) req.destroy(Error('The embedded image exceeds 8 MB.'));else chunks.push(chunk);});
      response.on('error',reject);
      response.on('end',()=>resolve({body:Buffer.concat(chunks),contentType}));
    });
    req.setTimeout(15_000,()=>req.destroy(Error('The embedded image download timed out.')));
    req.on('error',reject);req.end();
  });
}
export async function reportImageMaterial(url, expectedHash = '') {
  const name = codeFigureName(url);
  let image;
  if (name) {
    const manifest = await loadCodeAssetManifest(), entry = manifest.assets[name];
    const revision = new URL(url,'https://per.codes').searchParams.get('assetRevision');
    if (!entry || revision && revision !== manifest.assetRevision && !expectedHash) throw Error('This code figure edition is unavailable. Reopen its source before exporting.');
    const asset = await readCodeAsset(name);
    if (!asset.body || asset.body.length > maximumBytes) throw Error('This code figure is unavailable.');
    image = {body:asset.body,contentType:asset.mediaType};
    expectedHash ||= entry.sha256;
  } else image = await remoteImage(url);
  const contentHash = createHash('sha256').update(image.body).digest('hex');
  if (expectedHash && contentHash !== expectedHash) throw Error('This code figure no longer matches its immutable source hash.');
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(image.body,{limitInputPixels:40_000_000,animated:false}).metadata();
  if (!metadata.width || !metadata.height || metadata.width*metadata.height>40_000_000) throw Error('This Report image exceeds the supported image dimensions.');
  const body = ['image/png','image/jpeg'].includes(image.contentType) ? image.body :
    await sharp(image.body,{limitInputPixels:40_000_000,animated:false}).rotate().png().toBuffer();
  return {body,contentType:['image/png','image/jpeg'].includes(image.contentType)?image.contentType:'image/png',contentHash};
}
