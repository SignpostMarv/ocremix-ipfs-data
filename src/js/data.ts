import {
	SupportedExtensionUpperOrLower,
	SupportedExtensionLower,
	Album,
	Track,
	SrcsetSource,
} from '../module';
import {GetIpfsInstance} from './ipfs.js';
import {mimeType} from './mimeType.js';

const cids: Promise<{[path: string]: string}> = new Promise((yup) => {
	(async(): Promise<void> => {
		yup(await fetch(
			'../data/ocremix-cids.json'
		).then((r) => {
			return r.json();
		}));
	})();
});

const blobs: {[key: string]: Promise<Blob>} = {};
const urls: WeakMap<Track|SrcsetSource, Promise<string>> = new WeakMap();

export async function pathCID(path: string): Promise<string>
{
	const ocremix = await(cids);

	if ( ! (path in ocremix)) {
		throw new Error(
			'album + track combo not found in ocremix payload!'
		);
	}

	return ocremix[path];
}

export async function fetchBlobViaCacheOrIpfs(
	path: string,
	skipCache = false
): Promise<Blob> {
	const match = /.(mp3|png|jpe?g)$/i.exec(path);
	const cid = await pathCID(path);
	const buffs: Array<Uint8Array> = [];

	if ( ! match) {
		throw new Error('Unsupported file type requested!');
	}

	const [, EXT] = match;

	const ext = (
		(
			EXT as SupportedExtensionUpperOrLower
		).toLowerCase() as SupportedExtensionLower
	);

	if ('caches' in window && ! skipCache) {
		const [
			cache,
			ocremix,
		] = await Promise.all([
			caches.open('ocremix-ipfs-by-cid'),
			cids,
		]);
		const url = '/ipfs/' + ocremix[path];
		const faux = new Request(url);
		const maybe: Response|undefined = await cache.match(faux);

		const cacheBlob = maybe
			? await maybe.blob()
			: await fetchBlobViaCacheOrIpfs(path, true)

		if ( ! maybe) {
			await cache.put(url, new Response(cacheBlob));
		}

		return cacheBlob;
	}

	for await (const buff of (await GetIpfsInstance()).cat(cid)) {
		buffs.push(buff);
	}

	return new Blob(buffs, {type: mimeType(ext)});
}

export async function albumTrackCID(
	album: Album,
	track: Track
): Promise<string> {
	return await pathCID(album.path + track.subpath);
}

export async function blob(path: string): Promise<Blob> {
	const cid = await pathCID(path);

	if ( ! (cid in blobs)) {
		blobs[cid] = new Promise((yup, nope) => {
			try {
				(async (): Promise<Blob> => {
					return await fetchBlobViaCacheOrIpfs(path);
				})().then(yup);
			} catch (err) {
				nope(err);
			}
		});
	}

	return await blobs[cid];
}

export async function url(path: string): Promise<string> {
	return URL.createObjectURL(await blob(path));
}

export async function urlForThing(
	thing: Track|SrcsetSource,
	path: string
): Promise<string> {
	if ( ! urls.has(thing)) {
		urls.set(thing, url(path));
	}

	return await (urls.get(thing) as Promise<string>);
}
